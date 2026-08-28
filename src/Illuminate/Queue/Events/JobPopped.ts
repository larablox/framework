import type { Job } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `IlluminateQueueEventsJobPopped`. */
export class JobPopped
{
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job?: Job,
    )
    {}
}
