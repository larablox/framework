import type { JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { JobTarget } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: `Illuminate\Queue\Events\JobQueued`. */
export class JobQueued {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly queue: string | undefined,
        public readonly id: unknown,
        public readonly job: JobTarget,
        public readonly rawPayload: JobPayload,
        public readonly delay: number | undefined,
    ) {}

    /**
     * Get the decoded payload.
     *
     * PHP names the property `$payload` and decodes it here; a payload is
     * already a table, so the raw one is `rawPayload` and this returns it.
     */
    public payload(): JobPayload {
        return this.rawPayload;
    }
}
