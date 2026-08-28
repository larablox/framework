import type { Batch } from 'Illuminate/Bus/Batch';

/** PHP: `Illuminate\Bus\Events\BatchCanceled`. */
export class BatchCanceled {
    /** Create a new event instance. */
    public constructor(
        public readonly batch: Batch,
        public readonly exception?: unknown,
    ) {}
}
