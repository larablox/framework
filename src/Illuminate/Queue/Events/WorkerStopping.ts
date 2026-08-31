import type { WorkerOptions } from 'Illuminate/Queue/WorkerOptions';
import type { WorkerStopReason } from 'Illuminate/Queue/WorkerStopReason';

/** PHP: `IlluminateQueueEventsWorkerStopping`. */
export class WorkerStopping
{
    /** Create a new event instance. */
    public constructor(
        public readonly status = 0,
        public readonly workerOptions?: WorkerOptions,
        public readonly reason?: WorkerStopReason,
    )
    {}
}
