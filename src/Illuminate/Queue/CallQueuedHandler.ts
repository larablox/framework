import { Dispatcher } from 'Illuminate/Bus/Dispatcher';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { InteractsWithQueue } from 'Illuminate/Queue/InteractsWithQueue';
import { InstanceNotFoundException, Serializer } from 'Illuminate/Support/Serializer';
import { Pipeline } from 'Illuminate/Pipeline/Pipeline';
import { UniqueLock } from 'Illuminate/Bus/UniqueLock';
import type { Batchable } from 'Illuminate/Bus/Batchable';
import { isShouldBeUnique } from 'Illuminate/Contracts/Queue/ShouldBeUnique';
import { Reflector } from 'Illuminate/Support/Reflector';
import { Util } from 'Illuminate/Container/Util';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Job, JobPayloadData } from 'Illuminate/Contracts/Queue/Job';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';
import type { Repository as Cache } from 'Illuminate/Cache/Repository';

/**
 * PHP: `Illuminate\Queue\CallQueuedHandler`.
 *
 * The handler every object job travels through: the payload names it, and it
 * unwraps the command and runs it.
 *
 * Debounced jobs are what is still missing: they want a debounce lock.
 * Middleware, chains, unique jobs and batches work.
 *
 * PHP's `ModelNotFoundException` branch is here under another name: a payload
 * that came from storage carries an `Instance` as an identifier, and an
 * identifier that no longer resolves raises `InstanceNotFoundException`.
 */
export class CallQueuedHandler
{
    /** The command currently being processed. */
    protected runningCommand?: object;

    /**
     * Create a new handler instance.
     *
     * The payload names this class, so the container builds it: PHP reads the
     * type hints off the constructor, and `Inject` spells them out.
     */
    public constructor(
        @Inject(Dispatcher) protected readonly dispatcher: Dispatcher,
        @Inject('app') protected readonly container: Container,
    )
    {}

    /** Handle the queued job. */
    public call(job: Job, data: JobPayloadData): void
    {
        let command: object;

        try {
            command = this.setJobInstanceIfNecessary(job, this.getCommand(data));
        } catch (e) {
            if (e instanceof InstanceNotFoundException) {
                return this.handleInstanceNotFound(job, e);
            }

            throw e;
        }

        this.runningCommand = command;

        try {
            this.dispatchThroughMiddleware(job, command);
        } finally {
            this.runningCommand = undefined;
        }

        if (!job.isReleased()) {
            this.ensureUniqueJobLockIsReleased(command);
        }

        if (!job.hasFailed() && !job.isReleased()) {
            this.ensureNextJobInChainIsDispatched(command);
            this.ensureSuccessfulBatchJobIsRecorded(command);
        }

        if (!job.isDeletedOrReleased()) {
            job.delete();
        }
    }

    /**
     * Get the command from the given payload.
     *
     * PHP always unserialises, because the payload always came from storage.
     * Here a command that never left the server is handed back as it is, and
     * only one that did comes back as a string to be read.
     */
    protected getCommand(data: JobPayloadData): object
    {
        if (typeIs(data.command, 'string')) {
            return Serializer.unserialize(data.command) as object;
        }

        return data.command;
    }

    /** Dispatch the given job / command through its specified middleware. */
    protected dispatchThroughMiddleware(job: Job, command: object): unknown
    {
        const pipeline = new Pipeline(this.container).send(command).through(this.middlewareFor(command));

        return pipeline.then((passable) =>
            this.dispatcher.dispatchNow(passable as object, this.resolveHandler(job, passable as object))
        );
    }

    /**
     * The middleware the command declares.
     *
     * PHP merges what `middleware()` returns with the `$middleware` property;
     * a Luau table holds one value per key, so a job declares one or the other.
     */
    protected middlewareFor(command: object): Array<Pipe>
    {
        const declared = (command as { middleware?: unknown; }).middleware;

        if (typeIs(declared, 'function')) {
            return (declared as (self: object) => Array<Pipe>)(command);
        }

        return Util.isArray(declared) ? (declared as Array<Pipe>) : [];
    }

    /** Resolve the handler for the given command. */
    protected resolveHandler(job: Job, command: object): object | undefined
    {
        const handler = this.dispatcher.getCommandHandler(command);

        if (handler !== undefined) {
            this.setJobInstanceIfNecessary(job, handler);
        }

        return handler;
    }

    /** Release the unique lock a job marked `ShouldBeUnique` was holding. */
    protected ensureUniqueJobLockIsReleased(command: object): void
    {
        if (!isShouldBeUnique(command) || !this.container.bound('cache.store')) {
            return;
        }

        new UniqueLock(this.container.make<Cache>('cache.store')).release(command);
    }

    /** Tell the batch this job belongs to that it finished. */
    protected ensureSuccessfulBatchJobIsRecorded(command: object): void
    {
        const batchable = command as Batchable;

        if (!typeIs(batchable.batch, 'function')) {
            return;
        }

        batchable.batch()?.recordSuccessfulJob(batchable.batchId ?? '');
    }

    /** Tell the batch this job belongs to that it failed. */
    protected ensureFailedBatchJobIsRecorded(command: object, e: unknown): void
    {
        const batchable = command as Batchable;

        if (!typeIs(batchable.batch, 'function')) {
            return;
        }

        batchable.batch()?.recordFailedJob(batchable.batchId ?? '', e);
    }

    /** Ensure the next job in the chain is dispatched if applicable. */
    protected ensureNextJobInChainIsDispatched(command: object): void
    {
        const dispatchNext = (command as { dispatchNextJobInChain?: unknown; }).dispatchNextJobInChain;

        if (typeIs(dispatchNext, 'function')) {
            (dispatchNext as (self: object) => void)(command);
        }
    }

    /** Set the job instance of the given class if necessary. */
    protected setJobInstanceIfNecessary(job: Job, instance: object): object
    {
        if (Reflector.isInstanceOf(instance, InteractsWithQueue)) {
            (instance as InteractsWithQueue).setJob(job);
        }

        return instance;
    }

    /**
     * Handle a job whose payload points at something that is no longer there.
     *
     * PHP: `handleModelNotFound()`. The batch bookkeeping it does first waits
     * on batches.
     */
    protected handleInstanceNotFound(job: Job, e: InstanceNotFoundException): void
    {
        if (job.payload().deleteWhenMissingModels === true) {
            job.delete();

            return;
        }

        job.fail(e);
    }

    /**
     * Call the failed method on the job instance.
     *
     * `uuid` identifies the batch and the chain PHP notifies from here.
     */
    public failed(data: JobPayloadData, e: unknown, uuid: string, job?: Job): void
    {
        // The command may be exactly what could not be read back -- that is
        // often why the job failed. PHP gets a `__PHP_Incomplete_Class` and
        // returns early; there is nothing to notify here either.
        const [readable, restored] = pcall(() => this.getCommand(data));

        if (!readable) {
            return;
        }

        let command = restored as object;

        if (job !== undefined) {
            command = this.setJobInstanceIfNecessary(job, command);
        }

        this.ensureFailedBatchJobIsRecorded(command, e);

        const handler = (command as Record<string, unknown>).failed;

        if (typeIs(handler, 'function')) {
            (handler as (self: object, e: unknown) => void)(command, e);
        }
    }

    /** Get the command currently being processed. */
    public getRunningCommand(): object | undefined
    {
        return this.runningCommand;
    }
}
