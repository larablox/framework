import { BatchDispatched } from 'Illuminate/Bus/Events/BatchDispatched';
import type { Batch, BatchCallback, BatchOptions } from 'Illuminate/Bus/Batch';
import type { BatchRepository } from 'Illuminate/Bus/BatchRepository';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Batchable } from 'Illuminate/Bus/Batchable';

/**
 * PHP: `Illuminate\Bus\PendingBatch`.
 *
 * The batch as it is being described, before anything is queued.
 *
 * `dispatchAfterResponse()` has no response to come after. Chains inside a
 * batch (`ChainedBatch`) are not ported.
 */
export class PendingBatch
{
    /** The batch name. */
    public batchName = '';

    /** The batch options. */
    public options: BatchOptions = {};

    /** Create a new pending batch instance. */
    public constructor(
        protected readonly container: Container,
        public readonly jobs: Array<Batchable>,
    )
    {}

    /** Add jobs to the batch. */
    public add(jobs: Array<Batchable>): this
    {
        for (const job of jobs) {
            this.jobs.push(job);
        }

        return this;
    }

    /** Add a callback to be executed when the batch is stored. */
    public before(callback: BatchCallback): this
    {
        return this.registerCallback('before', callback);
    }

    /** Add a callback to be executed after a job in the batch has executed. */
    public progress(callback: BatchCallback): this
    {
        return this.registerCallback('progress', callback);
    }

    /** Add a callback to be executed after all jobs have executed successfully. */
    public then(callback: BatchCallback): this
    {
        return this.registerCallback('then', callback);
    }

    /** Add a callback to be executed after the first failing job. */
    public catch(callback: BatchCallback): this
    {
        return this.registerCallback('catch', callback);
    }

    /** Add a callback to be executed after the batch has finished executing. */
    public finally(callback: BatchCallback): this
    {
        return this.registerCallback('finally', callback);
    }

    /** Indicate that the batch should not be cancelled when a job within it fails. */
    public allowFailures(allowFailures = true): this
    {
        this.options.allowFailures = allowFailures;

        return this;
    }

    /** Determine if the pending batch allows jobs to fail without cancelling the batch. */
    public allowsFailures(): boolean
    {
        return this.options.allowFailures === true;
    }

    /** Set the name for the batch. */
    public name(name: string): this
    {
        this.batchName = name;

        return this;
    }

    /** Specify the queue connection that the batched jobs should run on. */
    public onConnection(connection: string): this
    {
        this.options.connection = connection;

        return this;
    }

    /** Get the connection used by the pending batch. */
    public connection(): string | undefined
    {
        return this.options.connection;
    }

    /** Specify the queue that the batched jobs should run on. */
    public onQueue(queue: string): this
    {
        this.options.queue = queue;

        return this;
    }

    /** Get the queue used by the pending batch. */
    public queue(): string | undefined
    {
        return this.options.queue;
    }

    /** Dispatch the batch. */
    public dispatch(): Batch
    {
        const repository = this.container.make<BatchRepository>('bus.batches');

        const stored = repository.store(this);

        const [ok, result] = pcall(() => stored.add(this.jobs));

        if (!ok) {
            repository.delete(stored.id);

            throw result;
        }

        const batch = (result as Batch | undefined) ?? stored;

        if (this.container.bound('events')) {
            this.container.make<Dispatcher>('events').dispatch(new BatchDispatched(batch));
        }

        return batch;
    }

    /** Dispatch the batch if the given truth test passes. */
    public dispatchIf(condition: boolean): Batch | undefined
    {
        return condition ? this.dispatch() : undefined;
    }

    /** Dispatch the batch unless the given truth test passes. */
    public dispatchUnless(condition: boolean): Batch | undefined
    {
        return condition ? undefined : this.dispatch();
    }

    /** Record one of the callbacks against the batch. */
    protected registerCallback(
        kind: 'before' | 'progress' | 'then' | 'catch' | 'finally',
        callback: BatchCallback,
    ): this
    {
        const registered = this.options[kind] ?? new Array<BatchCallback>();

        registered.push(callback);

        this.options[kind] = registered;

        return this;
    }
}
