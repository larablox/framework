import type { JobPayload } from "Illuminate/Contracts/Queue/Job";

/** A failed job as a provider hands it back. */
export interface FailedJobRecord {
    id: string | number;
    connection: string;
    queue: string;
    payload: JobPayload;
    exception: unknown;
    failed_at: number;
}

/** PHP: `Illuminate\Queue\Failed\FailedJobProviderInterface`. */
export interface FailedJobProviderInterface {
    /** Log a failed job into storage. */
    log(
        connection: string,
        queue: string,
        payload: JobPayload,
        exception: unknown,
    ): string | number | undefined;

    /** Get the IDs of all of the failed jobs. */
    ids(queue?: string): Array<string | number>;

    /** Get a list of all of the failed jobs. */
    all(): Array<FailedJobRecord>;

    /** Get a single failed job. */
    find(id: string | number): FailedJobRecord | undefined;

    /** Delete a single failed job from storage. */
    forget(id: string | number): boolean;

    /** Flush all of the failed jobs from storage. */
    flush(hours?: number): void;
}
