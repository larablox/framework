import type { Batch } from "Illuminate/Bus/Batch";
import type { PendingBatch } from "Illuminate/Bus/PendingBatch";
import type { UpdatedBatchJobCounts } from "Illuminate/Bus/UpdatedBatchJobCounts";

/**
 * PHP: `Illuminate\Bus\BatchRepository`.
 *
 * Where a batch keeps its counters. The methods that change them have to be
 * atomic: jobs of one batch finish in any order, each decrements
 * `pendingJobs`, and whoever brings it to zero fires the `then` callbacks.
 * PHP gets that from a database transaction with `lockForUpdate()`.
 */
export interface BatchRepository {
    /** Retrieve a list of batches. */
    get(limit: number, before?: string): Array<Batch>;

    /** Retrieve information about an existing batch. */
    find(batchId: string): Batch | undefined;

    /** Store a new pending batch. */
    store(batch: PendingBatch): Batch;

    /** Increment the total jobs count for the batch. */
    incrementTotalJobs(batchId: string, amount: number): void;

    /** Decrement the pending jobs for the batch. */
    decrementPendingJobs(batchId: string, jobId: string): UpdatedBatchJobCounts;

    /** Increment the failed jobs for the batch. */
    incrementFailedJobs(batchId: string, jobId: string): UpdatedBatchJobCounts;

    /** Mark the batch that has the given ID as finished. */
    markAsFinished(batchId: string): void;

    /** Cancel the batch that has the given ID. */
    cancel(batchId: string): void;

    /** Delete the batch that has the given ID. */
    delete(batchId: string): void;

    /** Execute the given callback while the repository is locked. */
    transaction<T>(callback: () => T): T;

    /** Roll back the last database transaction for the connection. */
    rollBack(): void;
}
