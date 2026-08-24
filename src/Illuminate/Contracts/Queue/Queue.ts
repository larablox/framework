import type { Abstract } from "Illuminate/Container/Types";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { Job, JobPayload } from "Illuminate/Contracts/Queue/Job";

/**
 * PHP: `\Closure|string|object $job` -- what may be pushed onto a queue.
 *
 * A closure cannot be queued here: `CallQueuedClosure` serialises it, and
 * nothing serialises a Luau function. Left are an object job, a `Class@method`
 * string and the class-plus-method pair that stands in for it.
 */
export type JobTarget = string | object | [Abstract, string];

export type { Delay };

/** PHP: `Illuminate\Contracts\Queue\Queue`. */
export interface Queue {
    /** Get the size of the queue. */
    size(queue?: string): number;

    /** Get the number of pending jobs. */
    pendingSize(queue?: string): number;

    /** Get the number of delayed jobs. */
    delayedSize(queue?: string): number;

    /** Get the number of reserved jobs. */
    reservedSize(queue?: string): number;

    /** Get the creation timestamp of the oldest pending job, excluding delayed jobs. */
    creationTimeOfOldestPendingJob(queue?: string): number | undefined;

    /** Push a new job onto the queue. */
    push(job: JobTarget, data?: unknown, queue?: string): unknown;

    /** Push a new job onto a specific queue. */
    pushOn(queue: string, job: JobTarget, data?: unknown): unknown;

    /** Push a new job onto the queue. */
    pushRaw(
        payload: JobPayload,
        queue?: string,
        options?: ArrayAccessible,
    ): unknown;

    /** Push a new job onto the queue after (n) seconds. */
    later(
        delay: Delay,
        job: JobTarget,
        data?: unknown,
        queue?: string,
    ): unknown;

    /** Push a new job onto a specific queue after (n) seconds. */
    laterOn(
        queue: string,
        delay: Delay,
        job: JobTarget,
        data?: unknown,
    ): unknown;

    /** Push an array of jobs onto the queue. */
    bulk(
        jobs: JobTarget | Array<JobTarget>,
        data?: unknown,
        queue?: string,
    ): void;

    /** Pop the next job off of the queue. */
    pop(queue?: string): Job | undefined;

    /** Get the connection name for the queue. */
    getConnectionName(): string;

    /** Set the connection name for the queue. */
    setConnectionName(name: string): this;
}
