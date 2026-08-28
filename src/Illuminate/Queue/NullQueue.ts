import { Collection } from "Illuminate/Support/Collection";
import { Queue } from "Illuminate/Queue/Queue";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { Job, JobPayload } from "Illuminate/Contracts/Queue/Job";
import type { JobTarget, Queue as QueueContract } from "Illuminate/Contracts/Queue/Queue";

/**
 * PHP: `Illuminate\Queue\NullQueue`.
 *
 * Swallows everything pushed onto it. The connection the manager falls back to
 * when a name resolves to nothing.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- discarding the arguments
   is the whole point of this driver. */
export class NullQueue extends Queue implements QueueContract {
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

    /** Push a new job onto the queue. */
    public push(job: JobTarget, data: unknown = "", queue?: string): unknown {
        return undefined;
    }

    /** Push a raw payload onto the queue. */
    public pushRaw(payload: JobPayload, queue?: string, options?: ArrayAccessible): unknown {
        return undefined;
    }

    /** Push a new job onto the queue after (n) seconds. */
    public later(delay: Delay, job: JobTarget, data: unknown = "", queue?: string): unknown {
        return undefined;
    }

    /** Pop the next job off of the queue. */
    public pop(queue?: string): Job | undefined {
        return undefined;
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
