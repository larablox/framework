import { Batch } from "Illuminate/Bus/Batch";
import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { Str } from "Illuminate/Support/Str";
import { UpdatedBatchJobCounts } from "Illuminate/Bus/UpdatedBatchJobCounts";
import type { BatchOptions } from "Illuminate/Bus/Batch";
import type { BatchRepository } from "Illuminate/Bus/BatchRepository";
import type { Factory as QueueFactory } from "Illuminate/Contracts/Queue/Factory";
import type { PendingBatch } from "Illuminate/Bus/PendingBatch";

/** One batch as the repository keeps it. */
interface BatchRecord {
    id: string;
    name: string;
    totalJobs: number;
    pendingJobs: number;
    failedJobs: number;
    failedJobIds: Array<string>;
    options: BatchOptions;
    createdAt: number;
    cancelledAt?: number;
    finishedAt?: number;
}

/**
 * PHP: `Illuminate\Bus\DatabaseBatchRepository`, with the table in memory.
 *
 * Same columns, same bookkeeping, no database. What PHP buys with a
 * transaction and `lockForUpdate()` -- an atomic read-modify-write of the
 * counters -- comes free inside one Luau VM: a coroutine is interrupted only
 * where it yields, and nothing in here does. `transaction()` therefore just
 * runs the callback and `rollBack()` has nothing to undo.
 *
 * The counters live in this server's memory, so a batch belongs to the server
 * that started it. Spreading one across servers needs the counters somewhere
 * both can reach, and callbacks that survive the trip -- neither of which this
 * repository is.
 */
export class ArrayBatchRepository implements BatchRepository {
    /** The batches, keyed by id. */
    protected batches = new OrderedMap<string, BatchRecord>();

    /** Create a new batch repository instance. */
    public constructor(protected readonly queue: QueueFactory) {}

    /** Retrieve a list of batches. */
    public get(limit: number, before?: string): Array<Batch> {
        const found = new Array<Batch>();

        for (const record of this.batches.values()) {
            if (before !== undefined && record.id >= before) {
                continue;
            }

            if (found.size() >= limit) {
                break;
            }

            found.push(this.toBatch(record));
        }

        return found;
    }

    /** Retrieve information about an existing batch. */
    public find(batchId: string): Batch | undefined {
        const record = this.batches.get(batchId);

        return record === undefined ? undefined : this.toBatch(record);
    }

    /** Store a new pending batch. */
    public store(batch: PendingBatch): Batch {
        const record: BatchRecord = {
            id: Str.orderedUuid(),
            name: batch.batchName,
            totalJobs: 0,
            pendingJobs: 0,
            failedJobs: 0,
            failedJobIds: [],
            options: batch.options,
            createdAt: InteractsWithTime.currentTime(),
        };

        this.batches.set(record.id, record);

        return this.toBatch(record);
    }

    /** Increment the total jobs count for the batch. */
    public incrementTotalJobs(batchId: string, amount: number): void {
        const record = this.batches.get(batchId);

        if (record === undefined) {
            return;
        }

        record.totalJobs += amount;
        record.pendingJobs += amount;
        record.finishedAt = undefined;
    }

    /** Decrement the pending jobs for the batch. */
    public decrementPendingJobs(
        batchId: string,
        jobId: string,
    ): UpdatedBatchJobCounts {
        const record = this.batches.get(batchId);

        if (record === undefined) {
            return new UpdatedBatchJobCounts();
        }

        record.pendingJobs -= 1;
        record.failedJobIds = record.failedJobIds.filter((id) => id !== jobId);

        return new UpdatedBatchJobCounts(record.pendingJobs, record.failedJobs);
    }

    /** Increment the failed jobs for the batch. */
    public incrementFailedJobs(
        batchId: string,
        jobId: string,
    ): UpdatedBatchJobCounts {
        const record = this.batches.get(batchId);

        if (record === undefined) {
            return new UpdatedBatchJobCounts();
        }

        record.failedJobs += 1;

        if (!record.failedJobIds.includes(jobId)) {
            record.failedJobIds.push(jobId);
        }

        return new UpdatedBatchJobCounts(record.pendingJobs, record.failedJobs);
    }

    /** Mark the batch that has the given ID as finished. */
    public markAsFinished(batchId: string): void {
        const record = this.batches.get(batchId);

        if (record !== undefined) {
            record.finishedAt = InteractsWithTime.currentTime();
        }
    }

    /** Cancel the batch that has the given ID. */
    public cancel(batchId: string): void {
        const record = this.batches.get(batchId);

        if (record !== undefined) {
            record.cancelledAt = InteractsWithTime.currentTime();
            record.finishedAt = InteractsWithTime.currentTime();
        }
    }

    /** Delete the batch that has the given ID. */
    public delete(batchId: string): void {
        this.batches.delete(batchId);
    }

    /** Execute the given callback: there is nothing to lock. */
    public transaction<T>(callback: () => T): T {
        return callback();
    }

    /** Roll back the last transaction: there was none. */
    public rollBack(): void {
        //
    }

    /** Build a batch instance from a stored record. */
    protected toBatch(record: BatchRecord): Batch {
        return new Batch(
            this.queue,
            this,
            record.id,
            record.name,
            record.totalJobs,
            record.pendingJobs,
            record.failedJobs,
            record.failedJobIds,
            record.options,
            record.createdAt,
            record.cancelledAt,
            record.finishedAt,
        );
    }
}
