import { BatchCanceled } from 'Illuminate/Bus/Events/BatchCanceled';
import { BatchFinished } from 'Illuminate/Bus/Events/BatchFinished';
import { BatchStarted } from 'Illuminate/Bus/Events/BatchStarted';
import { Container } from 'Illuminate/Container/Container';
import { Util } from 'Illuminate/Container/Util';
import type { BatchRepository } from 'Illuminate/Bus/BatchRepository';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Factory as QueueFactory } from 'Illuminate/Contracts/Queue/Factory';
import type { Batchable } from 'Illuminate/Bus/Batchable';
import type { UpdatedBatchJobCounts } from 'Illuminate/Bus/UpdatedBatchJobCounts';

/** A batch callback, as `then()` and friends take it. */
export type BatchCallback = (batch: Batch, e?: unknown) => void;

/** Everything a batch was configured with. */
export interface BatchOptions {
    connection?: string;
    queue?: string;
    allowFailures?: boolean;
    before?: Array<BatchCallback>;
    progress?: Array<BatchCallback>;
    then?: Array<BatchCallback>;
    catch?: Array<BatchCallback>;
    finally?: Array<BatchCallback>;
}

/**
 * PHP: `Illuminate\Bus\Batch`.
 *
 * A group of jobs with counters and callbacks: `then` once every job is done,
 * `catch` on the first failure, `finally` when every job has run exactly once.
 *
 * PHP puts the callbacks through `laravel/serializable-closure` so they survive
 * in the repository. Nothing serialises a Luau function, so the callbacks live
 * in the repository as they are -- which works while the repository is in this
 * server's memory, and is exactly what a cross-server repository will have to
 * solve differently.
 *
 * `toArray()`/`jsonSerialize()` are not ported: there is no JSON surface to
 * serve them to.
 */
export class Batch {
    /** Create a new batch instance. */
    public constructor(
        protected readonly queue: QueueFactory,
        protected readonly repository: BatchRepository,
        public readonly id: string,
        public readonly name: string,
        public readonly totalJobs: number,
        public readonly pendingJobs: number,
        public readonly failedJobs: number,
        public readonly failedJobIds: Array<string>,
        public readonly options: BatchOptions,
        public readonly createdAt: number,
        public readonly cancelledAt?: number,
        public readonly finishedAt?: number,
    ) {}

    /** Get a fresh instance of the batch represented by this ID. */
    public fresh(): Batch | undefined {
        return this.repository.find(this.id);
    }

    /** Add additional jobs to the batch. */
    public add(jobs: Array<Batchable> | Batchable): Batch | undefined {
        const added = Util.isArray(jobs) ? (jobs as Array<Batchable>) : [jobs as Batchable];

        for (const job of added) {
            job.withBatchId(this.id);
        }

        this.repository.transaction(() => {
            this.repository.incrementTotalJobs(this.id, added.size());

            this.queue.connection(this.options.connection).bulk(added, '', this.options.queue);
        });

        return this.fresh();
    }

    /** Get the total number of jobs that have been processed by the batch thus far. */
    public processedJobs(): number {
        return this.totalJobs - this.pendingJobs;
    }

    /** Get the percentage of jobs that have been processed (between 0 and 100). */
    public progress(): number {
        return this.totalJobs > 0 ? math.round((this.processedJobs() / this.totalJobs) * 100) : 0;
    }

    /** Record that a job within the batch finished successfully. */
    public recordSuccessfulJob(jobId: string): void {
        const counts = this.decrementPendingJobs(jobId);

        if (this.isFirstJobProcessed(counts)) {
            this.dispatchEvent(new BatchStarted(this));
        }

        if (this.hasProgressCallbacks()) {
            this.invokeCallbacks('progress');
        }

        if (counts.pendingJobs === 0) {
            this.repository.markAsFinished(this.id);

            this.dispatchEvent(new BatchFinished(this));
        }

        if (counts.pendingJobs === 0 && this.hasThenCallbacks()) {
            this.invokeCallbacks('then');
        }

        if (counts.allJobsHaveRanExactlyOnce() && this.hasFinallyCallbacks()) {
            this.invokeCallbacks('finally');
        }
    }

    /** Decrement the pending jobs for the batch. */
    public decrementPendingJobs(jobId: string): UpdatedBatchJobCounts {
        return this.repository.decrementPendingJobs(this.id, jobId);
    }

    /** Determine if the batch has finished executing. */
    public finished(): boolean {
        return this.finishedAt !== undefined;
    }

    /** Determine if the batch has pending jobs. */
    public hasPendingJobs(): boolean {
        return this.pendingJobs > 0;
    }

    /** Determine if the batch has "progress" callbacks. */
    public hasProgressCallbacks(): boolean {
        return (this.options.progress ?? []).size() > 0;
    }

    /** Determine if the batch has "then" callbacks. */
    public hasThenCallbacks(): boolean {
        return (this.options.then ?? []).size() > 0;
    }

    /** Determine if the batch allows jobs to fail without cancelling the batch. */
    public allowsFailures(): boolean {
        return this.options.allowFailures === true;
    }

    /** Determine if the batch has job failures. */
    public hasFailures(): boolean {
        return this.failedJobs > 0;
    }

    /** Record that a job within the batch failed to finish successfully. */
    public recordFailedJob(jobId: string, e: unknown): void {
        const counts = this.incrementFailedJobs(jobId);

        if (this.isFirstJobProcessed(counts)) {
            this.dispatchEvent(new BatchStarted(this));
        }

        if (counts.failedJobs === 1 && !this.allowsFailures()) {
            this.cancel(e);
        }

        if (this.allowsFailures() && this.hasProgressCallbacks()) {
            this.invokeCallbacks('progress', e);
        }

        if (counts.failedJobs === 1 && this.hasCatchCallbacks()) {
            this.invokeCallbacks('catch', e);
        }

        if (counts.allJobsHaveRanExactlyOnce() && this.hasFinallyCallbacks()) {
            this.invokeCallbacks('finally');
        }
    }

    /** Increment the failed jobs for the batch. */
    public incrementFailedJobs(jobId: string): UpdatedBatchJobCounts {
        return this.repository.incrementFailedJobs(this.id, jobId);
    }

    /** Determine if the batch has "catch" callbacks. */
    public hasCatchCallbacks(): boolean {
        return (this.options.catch ?? []).size() > 0;
    }

    /** Determine if the batch has "finally" callbacks. */
    public hasFinallyCallbacks(): boolean {
        return (this.options.finally ?? []).size() > 0;
    }

    /** Cancel the batch. */
    public cancel(e?: unknown): void {
        this.repository.cancel(this.id);

        this.dispatchEvent(new BatchCanceled(this, e));
    }

    /** Determine if the batch has been cancelled. */
    public cancelled(): boolean {
        return this.cancelledAt !== undefined;
    }

    /** Delete the batch from storage. */
    public delete(): void {
        this.repository.delete(this.id);
    }

    /** Determine if this is the first job processed by the batch. */
    protected isFirstJobProcessed(counts: UpdatedBatchJobCounts): boolean {
        return this.totalJobs - counts.pendingJobs + counts.failedJobs === 1;
    }

    /** Invoke a batch callback handler. */
    protected invokeCallbacks(kind: 'before' | 'progress' | 'then' | 'catch' | 'finally', e?: unknown): void {
        const batch = this.fresh() ?? this;

        for (const callback of this.options[kind] ?? []) {
            callback(batch, e);
        }
    }

    /** Dispatch one of the batch events, when there is a dispatcher to take it. */
    protected dispatchEvent(event: object): void {
        const container = Container.getInstance();

        if (container.bound('events')) {
            container.make<Dispatcher>('events').dispatch(event);
        }
    }
}
