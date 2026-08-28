import { Job } from 'Illuminate/Queue/Jobs/Job';
import { Serializer } from 'Illuminate/Support/Serializer';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Job as JobContract, JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { MemoryStoreQueue } from 'Illuminate/Queue/MemoryStoreQueue';

/**
 * PHP: `Illuminate\Queue\Jobs\RedisJob`.
 *
 * Holds the string that was stored and the id `ReadAsync` handed back -- the
 * receipt that `RemoveAsync` needs, and the reason a job that is never deleted
 * becomes visible again.
 */
export class MemoryStoreJob extends Job implements JobContract
{
    /** The payload, as it came out of storage. */
    protected readonly decoded: JobPayload;

    /** Create a new job instance. */
    public constructor(
        container: Container,
        protected readonly memoryStore: MemoryStoreQueue,
        protected readonly raw: string,
        protected readonly reservedId: string,
        connectionName: string,
        queue: string,
    )
    {
        super();

        this.queue = queue;
        this.container = container;
        this.connectionName = connectionName;

        this.decoded = Serializer.unserialize(raw) as JobPayload;

        // Reading is reserving: PHP's pop script increments the attempt on the
        // copy it moves to the reserved set, and this is that copy.
        this.decoded.attempts = (this.decoded.attempts ?? 0) + 1;
    }

    /** Release the job back into the queue after (n) seconds. */
    public release(delay = 0): void
    {
        super.release(delay);

        this.memoryStore.deleteAndRelease(this.queue, this, delay);
    }

    /** Delete the job from the queue. */
    public delete(): void
    {
        super.delete();

        this.memoryStore.deleteReserved(this.queue, this);
    }

    /** Get the number of times the job has been attempted. */
    public attempts(): number
    {
        return this.decoded.attempts ?? 1;
    }

    /** Get the job identifier. */
    public getJobId(): string
    {
        return this.decoded.uuid;
    }

    /** Get the raw body of the job. */
    public getRawBody(): JobPayload
    {
        return this.decoded;
    }

    /** Get the string the payload was stored as. */
    public getRawString(): string
    {
        return this.raw;
    }

    /** Get the receipt `RemoveAsync` needs. */
    public getReservedId(): string
    {
        return this.reservedId;
    }
}
