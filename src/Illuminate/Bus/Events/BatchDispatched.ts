import type { Batch } from "Illuminate/Bus/Batch";

/** PHP: `IlluminateBusEvents${php}`. */
export class BatchDispatched {
    /** Create a new event instance. */
    public constructor(public readonly batch: Batch) {}
}
