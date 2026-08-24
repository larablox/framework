import { Container } from "Illuminate/Container/Container";
import { Queueable } from "Illuminate/Bus/Queueable";
import type { Batch } from "Illuminate/Bus/Batch";
import type { BatchRepository } from "Illuminate/Bus/BatchRepository";

/**
 * PHP: `Illuminate\Bus\Batchable`.
 *
 * A job opts into batching by using this trait. There is no multiple
 * inheritance here, so it is another link in the chain every job already has:
 * `Dispatchable -> Batchable -> Queueable -> InteractsWithQueue`. Every job is
 * therefore batchable, which costs one unused field on the ones that are not.
 *
 * `withFakeBatch()` is a testing helper with no test runner behind it.
 */
export class Batchable extends Queueable {
    /** The batch ID (if applicable). */
    public batchId?: string;

    /** Get the batch instance for the job, if applicable. */
    public batch(): Batch | undefined {
        if (this.batchId === undefined) {
            return undefined;
        }

        const container = Container.getInstance();

        if (!container.bound("bus.batches")) {
            return undefined;
        }

        return container
            .make<BatchRepository>("bus.batches")
            .find(this.batchId);
    }

    /** Determine if the batch is still active and processing. */
    public batching(): boolean {
        const batch = this.batch();

        return batch !== undefined && !batch.cancelled();
    }

    /** Set the batch ID on the job. */
    public withBatchId(batchId: string): this {
        this.batchId = batchId;

        return this;
    }
}
