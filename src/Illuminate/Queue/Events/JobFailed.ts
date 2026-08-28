import type { Job } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `Illuminate\Queue\Events\JobFailed`. */
export class JobFailed {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job: Job,
        public readonly exception: unknown,
    ) {}
}
