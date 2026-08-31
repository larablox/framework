import type { WorkerOptions } from 'Illuminate/Queue/WorkerOptions';

/** PHP: `IlluminateQueueEventsWorkerStarting`. */
export class WorkerStarting
{
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly queue: string,
        public readonly workerOptions: WorkerOptions,
    )
    {}
}
