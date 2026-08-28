import type { WorkerOptions } from 'Illuminate/Queue/WorkerOptions';

/** PHP: `IlluminateQueueEventsLooping`. */
export class Looping {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly queue: string,
        public readonly workerOptions?: WorkerOptions,
    ) {}
}
