import type { Job } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `Illuminate\Queue\Events\JobAttempted`. */
export class JobAttempted {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job: Job,
        public readonly exception?: unknown,
    ) {}

    /** Determine if the job completed with failing or throwing an exception. */
    public successful(): boolean {
        return !this.job.hasFailed() && this.exception === undefined;
    }
}
