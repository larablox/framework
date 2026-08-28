import { Collection } from 'Illuminate/Support/Collection';
import { JobAttempted } from 'Illuminate/Queue/Events/JobAttempted';
import { JobExceptionOccurred } from 'Illuminate/Queue/Events/JobExceptionOccurred';
import { JobProcessed } from 'Illuminate/Queue/Events/JobProcessed';
import { JobProcessing } from 'Illuminate/Queue/Events/JobProcessing';
import { Queue } from 'Illuminate/Queue/Queue';
import { SyncJob } from 'Illuminate/Queue/Jobs/SyncJob';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { Delay } from 'Illuminate/Support/InteractsWithTime';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Job, JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { JobTarget, Queue as QueueContract } from 'Illuminate/Contracts/Queue/Queue';

/**
 * PHP: `Illuminate\Queue\SyncQueue`.
 *
 * Runs the job in the caller's thread, at once. `push()` in PHP first hands the
 * job to the transaction manager when it should wait for a commit; there are no
 * transactions to wait for, so `executeJob()` is reached directly.
 */
export class SyncQueue extends Queue implements QueueContract {
    /** Create a new sync queue instance. */
    public constructor(dispatchAfterCommit = false) {
        super();

        this.dispatchAfterCommit = dispatchAfterCommit;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars -- a sync queue holds
       nothing to count; the parameters are the contract's. */

    /** Get the size of the queue. */
    public size(queue?: string): number {
        return 0;
    }

    /** Get the number of pending jobs. */
    public pendingSize(queue?: string): number {
        return 0;
    }

    /** Get the number of delayed jobs. */
    public delayedSize(queue?: string): number {
        return 0;
    }

    /** Get the number of reserved jobs. */
    public reservedSize(queue?: string): number {
        return 0;
    }

    /** Get the pending jobs for the given queue. */
    public pendingJobs(queue?: string): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get the delayed jobs for the given queue. */
    public delayedJobs(queue?: string): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get the reserved jobs for the given queue. */
    public reservedJobs(queue?: string): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get all pending jobs across every queue. */
    public allPendingJobs(): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get all delayed jobs across every queue. */
    public allDelayedJobs(): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get all reserved jobs across every queue. */
    public allReservedJobs(): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get the creation timestamp of the oldest pending job, excluding delayed jobs. */
    public creationTimeOfOldestPendingJob(queue?: string): number | undefined {
        return undefined;
    }

    /* eslint-enable @typescript-eslint/no-unused-vars */

    /** Push a new job onto the queue. */
    public push(job: JobTarget, data: unknown = '', queue?: string): unknown {
        return this.executeJob(job, data, queue);
    }

    /** Execute a given job synchronously. */
    protected executeJob(job: JobTarget, data: unknown = '', queue?: string): number {
        const queueJob = this.resolveJob(this.createPayload(job, queue, data), queue);

        let exceptionOccurred: unknown;

        try {
            this.raiseBeforeJobEvent(queueJob);

            queueJob.fire();

            this.raiseAfterJobEvent(queueJob);
        } catch (e) {
            exceptionOccurred = e;

            this.handleException(queueJob, e);
        } finally {
            this.raiseJobAttemptedEvent(queueJob, exceptionOccurred);
        }

        return 0;
    }

    /** Resolve a Sync job instance. */
    protected resolveJob(payload: JobPayload, queue?: string): Job {
        return new SyncJob(this.container, payload, this.connectionName, queue ?? '');
    }

    /** Raise the before queue job event. */
    protected raiseBeforeJobEvent(job: Job): void {
        if (this.container.bound('events')) {
            this.container.make<Dispatcher>('events').dispatch(new JobProcessing(this.connectionName, job));
        }
    }

    /** Raise the after queue job event. */
    protected raiseAfterJobEvent(job: Job): void {
        if (this.container.bound('events')) {
            this.container.make<Dispatcher>('events').dispatch(new JobProcessed(this.connectionName, job));
        }
    }

    /** Raise the job attempted event. */
    protected raiseJobAttemptedEvent(job: Job, exceptionOccurred?: unknown): void {
        if (this.container.bound('events')) {
            this.container
                .make<Dispatcher>('events')
                .dispatch(new JobAttempted(this.connectionName, job, exceptionOccurred));
        }
    }

    /** Raise the exception occurred queue job event. */
    protected raiseExceptionOccurredJobEvent(job: Job, e: unknown): void {
        if (this.container.bound('events')) {
            this.container.make<Dispatcher>('events').dispatch(new JobExceptionOccurred(this.connectionName, job, e));
        }
    }

    /** Handle an exception that occurred while processing a job. */
    protected handleException(queueJob: Job, e: unknown): never {
        this.raiseExceptionOccurredJobEvent(queueJob, e);

        queueJob.fail(e);

        throw e;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars -- nothing is stored,
       so there is nothing to write raw and nothing to pop. */

    /** Push a raw payload onto the queue. */
    public pushRaw(payload: JobPayload, queue?: string, options?: ArrayAccessible): unknown {
        return undefined;
    }

    /** Push a new job onto the queue after (n) seconds. */
    public later(delay: Delay, job: JobTarget, data: unknown = '', queue?: string): unknown {
        return this.push(job, data, queue);
    }

    /** Pop the next job off of the queue. */
    public pop(queue?: string): Job | undefined {
        return undefined;
    }

    /* eslint-enable @typescript-eslint/no-unused-vars */
}
