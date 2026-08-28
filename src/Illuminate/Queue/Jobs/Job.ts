import { JobFailed } from 'Illuminate/Queue/Events/JobFailed';
import { JobName } from 'Illuminate/Queue/Jobs/JobName';
import { ManuallyFailedException } from 'Illuminate/Queue/ManuallyFailedException';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Job as JobContract, JobHandler, JobPayload } from 'Illuminate/Contracts/Queue/Job';

/**
 * PHP: `Illuminate\Queue\Jobs\Job`.
 *
 * `fail()` in PHP also rolls a database transaction back and tells the batch
 * repository about a timed-out batchable job; there is neither a database nor a
 * batch repository, so both branches are gone.
 *
 * PHP has a `$failed` property beside a `failed()` method. A Luau table holds
 * one value per key, so the protected method is `failedJob()` here.
 */
export abstract class Job {
    /** The job handler instance. */
    protected instance?: object;

    /** The IoC container instance. */
    protected container!: Container;

    /** Indicates if the job has been deleted. */
    protected deleted = false;

    /** Indicates if the job has been released. */
    protected released = false;

    /** Indicates if the job has failed. */
    protected failed = false;

    /** The name of the connection the job belongs to. */
    protected connectionName = '';

    /** The name of the queue the job belongs to. */
    protected queue = '';

    /** Get the job identifier. */
    public abstract getJobId(): string;

    /** Get the raw body of the job. */
    public abstract getRawBody(): JobPayload;

    /** Get the number of times the job has been attempted. */
    public abstract attempts(): number;

    /** Get the UUID of the job. */
    public uuid(): string | undefined {
        return this.payload().uuid;
    }

    /** Fire the job. */
    public fire(): void {
        const payload = this.payload();

        const [klass, method] = JobName.parse(payload.job);

        this.instance = this.resolve(klass);

        const handler = (this.instance as Record<string, unknown>)[method] as (
            self: object,
            job: JobContract,
            data: unknown,
        ) => void;

        handler(this.instance, this as unknown as JobContract, payload.data);
    }

    /** Delete the job from the queue. */
    public delete(): void {
        this.deleted = true;
    }

    /** Determine if the job has been deleted. */
    public isDeleted(): boolean {
        return this.deleted;
    }

    /**
     * Release the job back into the queue after (n) seconds.
     *
     * The base only records the flag; a driver overrides this to honour the
     * delay.
     */
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above */
    public release(delay = 0): void {
        this.released = true;
    }

    /** Determine if the job was released back into the queue. */
    public isReleased(): boolean {
        return this.released;
    }

    /** Determine if the job has been deleted or released. */
    public isDeletedOrReleased(): boolean {
        return this.isDeleted() || this.isReleased();
    }

    /** Determine if the job has been marked as a failure. */
    public hasFailed(): boolean {
        return this.failed;
    }

    /** Mark the job as "failed". */
    public markAsFailed(): void {
        this.failed = true;
    }

    /** Delete the job, call the "failed" method, and raise the failed job event. */
    public fail(e?: unknown): void {
        this.markAsFailed();

        if (this.isDeleted()) {
            return;
        }

        try {
            // If the job has failed, we will delete it, call the "failed" method and then call
            // an event indicating the job has failed so it can be logged if needed. This is
            // to allow every developer to better keep monitor of their failed queue jobs.
            this.delete();

            this.failedJob(e);
        } finally {
            // PHP resolves the `Dispatcher` contract; an interface is no key
            // here, and `events` is the alias the contract is bound under.
            const events = this.container.make<Dispatcher>('events');

            events.dispatch(
                new JobFailed(this.connectionName, this as unknown as JobContract, e ?? new ManuallyFailedException()),
            );
        }
    }

    /** Process an exception that caused the job to fail. */
    protected failedJob(e?: unknown): void {
        const payload = this.payload();

        const [klass] = JobName.parse(payload.job);

        this.instance = this.resolve(klass);

        const handler = (this.instance as Record<string, unknown>).failed;

        if (typeIs(handler, 'function')) {
            (handler as (self: object, data: unknown, e: unknown, uuid: string, job: JobContract) => void)(
                this.instance,
                payload.data,
                e,
                payload.uuid,
                this as unknown as JobContract,
            );
        }
    }

    /** Resolve the given class. */
    protected resolve(klass: Abstract): object {
        return this.container.make(klass) as object;
    }

    /** Get the resolved job handler instance. */
    public getResolvedJob(): object | undefined {
        return this.instance;
    }

    /** Get the decoded body of the job. */
    public payload(): JobPayload {
        return this.getRawBody();
    }

    /** Get the number of times to attempt a job. */
    public maxTries(): number | undefined {
        return this.payload().maxTries;
    }

    /** Get the number of times to attempt a job after an exception. */
    public maxExceptions(): number | undefined {
        return this.payload().maxExceptions;
    }

    /** Determine if the job should fail when it timeouts. */
    public shouldFailOnTimeout(): boolean {
        return this.payload().failOnTimeout;
    }

    /** The number of seconds to wait before retrying a job that encountered an uncaught exception. */
    public backoff(): string | number | undefined {
        const payload = this.payload();

        return payload.backoff ?? payload.delay;
    }

    /** Get the number of seconds the job can run. */
    public timeout(): number | undefined {
        return this.payload().timeout;
    }

    /** Get the timestamp indicating when the job should timeout. */
    public retryUntil(): number | undefined {
        return this.payload().retryUntil;
    }

    /** Get the name of the queued job class. */
    public getName(): JobHandler {
        return this.payload().job;
    }

    /** Get the resolved display name of the queued job class. */
    public resolveName(): string {
        return JobName.resolve(this.getName(), this.payload());
    }

    /** Get the class of the queued job. */
    public resolveQueuedJobClass(): Abstract {
        return JobName.resolveClassName(this.getName(), this.payload());
    }

    /** Get the name of the connection the job belongs to. */
    public getConnectionName(): string {
        return this.connectionName;
    }

    /** Get the name of the queue the job belongs to. */
    public getQueue(): string {
        return this.queue;
    }

    /** Get the service container instance. */
    public getContainer(): Container {
        return this.container;
    }
}
