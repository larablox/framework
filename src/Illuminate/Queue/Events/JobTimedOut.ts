import type { Job } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `IlluminateQueueEventsJobTimedOut`. */
export class JobTimedOut {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job: Job,
    ) {}
}
