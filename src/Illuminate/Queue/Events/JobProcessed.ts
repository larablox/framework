import type { Job } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `Illuminate\Queue\Events\JobProcessed`. */
export class JobProcessed
{
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job: Job,
    )
    {}
}
