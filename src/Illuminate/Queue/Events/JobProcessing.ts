import type { Job } from "Illuminate/Contracts/Queue/Job";

/** PHP: `Illuminate\Queue\Events\JobProcessing`. */
export class JobProcessing {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly job: Job,
    ) {}
}
