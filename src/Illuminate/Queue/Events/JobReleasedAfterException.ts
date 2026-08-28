import type { Job } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `IlluminateQueueEventsJobReleasedAfterException`. */
export class JobReleasedAfterException
{
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job: Job,
        public readonly backoff?: number,
    )
    {}
}
