import { Job } from 'Illuminate/Queue/Jobs/Job';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Job as JobContract, JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { MemoryJobRecord, MemoryQueue } from 'Illuminate/Queue/MemoryQueue';

/** PHP: `Illuminate\Queue\Jobs\DatabaseJob`, against the in-memory table. */
export class MemoryJob extends Job implements JobContract {
    /** Create a new job instance. */
    public constructor(
        container: Container,
        protected readonly memory: MemoryQueue,
        protected readonly record: MemoryJobRecord,
        connectionName: string,
        queue: string,
    ) {
        super();

        this.queue = queue;
        this.container = container;
        this.connectionName = connectionName;
    }

    /** Release the job back into the queue after (n) seconds. */
    public release(delay = 0): void {
        super.release(delay);

        this.memory.deleteAndRelease(this.queue, this, delay);
    }

    /** Delete the job from the queue. */
    public delete(): void {
        super.delete();

        this.memory.deleteReserved(this.queue, this.record.id);
    }

    /** Get the number of times the job has been attempted. */
    public attempts(): number {
        return this.record.attempts;
    }

    /** Get the job identifier. */
    public getJobId(): string {
        return this.record.id;
    }

    /** Get the raw body of the job. */
    public getRawBody(): JobPayload {
        return this.record.payload;
    }

    /** Get the underlying queue job record. */
    public getJobRecord(): MemoryJobRecord {
        return this.record;
    }
}
