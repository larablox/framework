import { Job } from 'Illuminate/Queue/Jobs/Job';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Job as JobContract, JobPayload } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `Illuminate\Queue\Jobs\SyncJob`. */
export class SyncJob extends Job implements JobContract {
    /** The queue message data. */
    protected jobPayload: JobPayload;

    /** Create a new job instance. */
    public constructor(container: Container, payload: JobPayload, connectionName: string, queue: string) {
        super();

        this.queue = queue;
        this.jobPayload = payload;
        this.container = container;
        this.connectionName = connectionName;
    }

    /** Release the job back into the queue after (n) seconds. */
    public release(delay = 0): void {
        super.release(delay);
    }

    /** Get the number of times the job has been attempted. */
    public attempts(): number {
        return 1;
    }

    /** Get the job identifier. */
    public getJobId(): string {
        return '';
    }

    /** Get the raw body string for the job. */
    public getRawBody(): JobPayload {
        return this.jobPayload;
    }

    /** Get the name of the queue the job belongs to. */
    public getQueue(): string {
        return 'sync';
    }
}
