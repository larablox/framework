import type { Abstract } from 'Illuminate/Container/Types';

/**
 * PHP: the `job` entry of a payload, a `Class@method` string such as
 * `'Illuminate\Queue\CallQueuedHandler@call'`.
 *
 * Class-strings do not exist here, so the class itself may stand in its place,
 * alone or paired with the method to call. A plain string still works and is
 * split by `JobName.parse()` exactly as in PHP.
 */
export type JobHandler = Abstract | [Abstract, string];

/**
 * PHP: the `data` of a payload built for an object job.
 *
 * `command` holds `serialize($job)` in PHP -- always a string, because the
 * payload always travels through storage. A queue that never leaves the server
 * has nothing to travel through, so the job object is carried as it is and only
 * a storage driver replaces it with what `Support/Serializer` produced.
 */
export interface JobPayloadData {
    /** PHP: `get_class($job)`. */
    commandName: Abstract;

    /** PHP: `serialize(clone $job)`; the object itself for an in-process queue. */
    command: object | string;

    /** The batch the job belongs to, once batches exist. */
    batchId?: string;
}

/**
 * PHP: the array behind `json_decode($job->getRawBody(), true)`.
 *
 * There is no JSON step here -- `getRawBody()` returns this table as it is --
 * so `payload()` and `getRawBody()` are the same value, kept apart because both
 * are public API.
 *
 * `deleteWhenMissingModels` tells the handler to drop a job whose Eloquent
 * models are gone; an `Instance` that no longer resolves is the same thing.
 */
export interface JobPayload {
    uuid: string;
    displayName?: string;
    job: JobHandler;
    maxTries?: number;
    maxExceptions?: number;
    failOnTimeout: boolean;
    backoff?: string;
    timeout?: number;
    retryUntil?: number;
    deleteWhenMissingModels?: boolean;
    delay?: number;

    /**
     * How many times the job has been reserved.
     *
     * Only the drivers that count attempts inside the payload set it -- Redis
     * in PHP, MemoryStore here. A driver with a table of its own keeps the
     * count in a column instead.
     */
    attempts?: number;
    data: unknown;
    createdAt: number;
}

/** PHP: `Illuminate\Contracts\Queue\Job`. */
export interface Job {
    /** Get the UUID of the job. */
    uuid(): string | undefined;

    /** Get the job identifier. */
    getJobId(): string;

    /** Get the decoded body of the job. */
    payload(): JobPayload;

    /** Fire the job. */
    fire(): void;

    /** Release the job back into the queue after (n) seconds. */
    release(delay?: number): void;

    /** Determine if the job was released back into the queue. */
    isReleased(): boolean;

    /** Delete the job from the queue. */
    delete(): void;

    /** Determine if the job has been deleted. */
    isDeleted(): boolean;

    /** Determine if the job has been deleted or released. */
    isDeletedOrReleased(): boolean;

    /** Get the number of times the job has been attempted. */
    attempts(): number;

    /** Determine if the job has been marked as a failure. */
    hasFailed(): boolean;

    /** Mark the job as "failed". */
    markAsFailed(): void;

    /** Delete the job, call the "failed" method, and raise the failed job event. */
    fail(e?: unknown): void;

    /** Get the number of times to attempt a job. */
    maxTries(): number | undefined;

    /** Get the number of times to attempt a job after an exception. */
    maxExceptions(): number | undefined;

    /** Get the number of seconds the job can run. */
    timeout(): number | undefined;

    /** Get the timestamp indicating when the job should timeout. */
    retryUntil(): number | undefined;

    /** Get the name of the queued job class. */
    getName(): JobHandler;

    /** Get the resolved display name of the queued job class. */
    resolveName(): string;

    /** Get the class of the queued job. */
    resolveQueuedJobClass(): Abstract;

    /** Get the name of the connection the job belongs to. */
    getConnectionName(): string;

    /** Get the name of the queue the job belongs to. */
    getQueue(): string;

    /** Get the raw body of the job. */
    getRawBody(): JobPayload;
}
