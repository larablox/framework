import { Collection } from "Illuminate/Support/Collection";
import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { InvalidPayloadException } from "Illuminate/Queue/InvalidPayloadException";
import { MemoryStoreJob } from "Illuminate/Queue/Jobs/MemoryStoreJob";
import { Queue } from "Illuminate/Queue/Queue";
import { Reflector } from "Illuminate/Support/Reflector";
import { RuntimeException } from "Illuminate/Exception";
import { Serializer } from "Illuminate/Support/Serializer";
import { Str } from "Illuminate/Support/Str";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type {
    Job,
    JobPayload,
    JobPayloadData,
} from "Illuminate/Contracts/Queue/Job";
import type {
    JobTarget,
    Queue as QueueContract,
} from "Illuminate/Contracts/Queue/Queue";

const MemoryStoreService = game.GetService("MemoryStoreService");

/** The largest value MemoryStore accepts for one item. */
const MAX_ITEM_BYTES = 32 * 1024;

/** Widest timestamp the delayed key pads to, good until the year 2286. */
const SORT_KEY_DIGITS = 10;

/**
 * PHP: `Illuminate\Queue\RedisQueue`, over `MemoryStoreService`.
 *
 * The one queue here that behaves the way Laravel's do: the payload is
 * serialised, handed to storage shared by every server of the universe, and
 * read back by whichever worker gets to it -- not necessarily the server that
 * queued it.
 *
 * The pieces line up with Redis almost one for one:
 *
 * - a `MemoryStoreQueue` is the list, and its **invisibility timeout** is what
 *   `retry_after` and the `:reserved` sorted set do in PHP: a job that is read
 *   but never removed comes back on its own;
 * - a `MemoryStoreSortedMap` is the `:delayed` sorted set, keyed by the
 *   timestamp the job becomes available, and `migrate()` moves what is due;
 * - `ReadAsync(count, allOrNothing, waitTimeout)` is `BLPOP`: the worker waits
 *   inside the call instead of polling.
 *
 * What Redis gives and this does not: the jobs themselves. The four sizes are
 * real -- `GetSizeAsync` counts a queue, and `excludeInvisible` separates
 * pending from reserved the way the `:reserved` set does in PHP -- but nothing
 * reads a job without also reserving it, so `pendingJobs()` and its siblings
 * answer an empty collection rather than consume the queue to look.
 *
 * Two limits are the platform's, not Laravel's: an item may not exceed 32 KB,
 * and the game's whole memory quota is `64 KB + 1.2 KB * players`.
 */
export class MemoryStoreQueue extends Queue implements QueueContract {
    /** Create a new MemoryStore queue instance. */
    public constructor(
        protected readonly defaultQueue = "default",
        protected readonly retryAfter = 60,
        protected readonly blockFor = 0,
        protected readonly expiration = 604800,
        protected readonly prefix = "queue:",
        dispatchAfterCommit = false,
    ) {
        super();

        this.dispatchAfterCommit = dispatchAfterCommit;
    }

    /** Get the queue or return the default. */
    public getQueue(queue?: string): string {
        return queue ?? this.defaultQueue;
    }

    /** The MemoryStore queue backing the given name. */
    protected queueFor(
        queue?: string,
    ): ReturnType<MemoryStoreService["GetQueue"]> {
        return MemoryStoreService.GetQueue(
            `${this.prefix}${this.getQueue(queue)}`,
            this.retryAfter,
        );
    }

    /** The sorted map holding the jobs that are not due yet. */
    protected delayedFor(queue?: string): MemoryStoreSortedMap {
        return MemoryStoreService.GetSortedMap(
            `${this.prefix}${this.getQueue(queue)}:delayed`,
        );
    }

    /**
     * Get the size of the queue.
     *
     * PHP counts the list, the delayed set and the reserved set in one
     * `EVAL`; there is no scripting here, so this adds up what the two
     * structures report. `GetSizeAsync()` counts pending and reserved
     * together -- an item that was read but not removed is still in the queue,
     * only invisible -- which leaves the delayed map to add.
     */
    public size(queue?: string): number {
        return (
            this.queueFor(queue).GetSizeAsync(false) + this.delayedSize(queue)
        );
    }

    /** Get the number of pending jobs. */
    public pendingSize(queue?: string): number {
        return this.queueFor(queue).GetSizeAsync(true);
    }

    /** Get the number of delayed jobs. */
    public delayedSize(queue?: string): number {
        return this.delayedFor(queue).GetSizeAsync();
    }

    /**
     * Get the number of reserved jobs.
     *
     * Reserved here is what `retry_after` and the `:reserved` sorted set are
     * in PHP: a job `ReadAsync` handed out and nobody removed, held invisible
     * until the invisibility timeout puts it back. `excludeInvisible` is the
     * only place MemoryStore draws that line, so the count is what the two
     * calls differ by.
     */
    public reservedSize(queue?: string): number {
        const memoryStoreQueue = this.queueFor(queue);

        return (
            memoryStoreQueue.GetSizeAsync(false) -
            memoryStoreQueue.GetSizeAsync(true)
        );
    }

    /* eslint-disable @typescript-eslint/no-unused-vars -- a queue reports its
       length, but not its contents: `ReadAsync` is the only way to see a job
       and it reserves what it reads. */

    /** Get the pending jobs for the given queue. */
    public pendingJobs(queue?: string): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get the delayed jobs for the given queue. */
    public delayedJobs(queue?: string): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get the reserved jobs for the given queue. */
    public reservedJobs(queue?: string): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get all pending jobs across every queue. */
    public allPendingJobs(): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get all delayed jobs across every queue. */
    public allDelayedJobs(): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get all reserved jobs across every queue. */
    public allReservedJobs(): Collection<number, defined> {
        return new Collection<number, defined>();
    }

    /** Get the creation timestamp of the oldest pending job, excluding delayed jobs. */
    public creationTimeOfOldestPendingJob(queue?: string): number | undefined {
        return undefined;
    }

    /* eslint-enable @typescript-eslint/no-unused-vars */

    /** Create a payload array, counting attempts the way the Redis driver does. */
    protected createPayloadArray(
        job: JobTarget,
        queue: string | undefined,
        data: unknown = "",
    ): JobPayload {
        const payload = super.createPayloadArray(job, queue, data);

        payload.attempts = 0;

        return payload;
    }

    /**
     * Create a payload for an object-based queue handler.
     *
     * The command is serialised here and travels as a string inside the
     * envelope, exactly as `serialize($job)` does in PHP. That is not a detail
     * of storage: it decides *where* a payload that cannot be read back fails.
     * Reading the envelope has to succeed so the job exists, and reading the
     * command has to fail inside `CallQueuedHandler::call()`, where a missing
     * `Instance` is handled -- rather than inside `pop()`, where it would leave
     * the job in storage to be read again forever.
     */
    protected createObjectPayload(
        job: object,
        queue: string | undefined,
    ): JobPayload {
        const payload = super.createObjectPayload(job, queue);

        const data = payload.data as JobPayloadData;

        const [ok, command] = pcall(() =>
            Serializer.serialize(data.command as object),
        );

        if (!ok) {
            throw new RuntimeException(
                `Failed to serialize job of type [${payload.displayName}]: ${tostring(command)}`,
            );
        }

        payload.data = {
            commandName: Serializer.nameOf(
                Reflector.classOf(job) ?? (job as object),
            ),
            command: command as string,
            batchId: data.batchId,
        };

        return payload;
    }

    /** Push a new job onto the queue. */
    public push(job: JobTarget, data: unknown = "", queue?: string): unknown {
        return this.enqueueUsing(
            job,
            this.createPayload(job, this.getQueue(queue), data),
            queue,
            undefined,
            (payload, name) => this.pushRaw(payload, name),
        );
    }

    /** Push a raw payload onto the queue. */
    public pushRaw(
        payload: JobPayload,
        queue?: string,
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- Redis reads no options here either */
        options?: ArrayAccessible,
    ): unknown {
        this.queueFor(queue).AddAsync(this.encode(payload), this.expiration, 0);

        return payload.uuid;
    }

    /** Push a new job onto the queue after (n) seconds. */
    public later(
        delay: Delay,
        job: JobTarget,
        data: unknown = "",
        queue?: string,
    ): unknown {
        return this.enqueueUsing(
            job,
            this.createPayload(job, this.getQueue(queue), data, delay),
            queue,
            delay,
            (payload, name, seconds) =>
                this.laterRaw(seconds ?? 0, payload, name),
        );
    }

    /** Push a raw payload into the delayed map. */
    protected laterRaw(
        delay: Delay,
        payload: JobPayload,
        queue?: string,
    ): string {
        const availableAt = InteractsWithTime.availableAt(delay);

        this.delayedFor(queue).SetAsync(
            this.delayedKey(availableAt, payload.uuid),
            this.encode(payload),
            this.expiration,
        );

        return payload.uuid;
    }

    /** Release a reserved job back onto the queue. */
    public release(queue: string, payload: JobPayload, delay: Delay): unknown {
        return InteractsWithTime.secondsUntil(delay) > 0
            ? this.laterRaw(delay, payload, queue)
            : this.pushRaw(payload, queue);
    }

    /** Delete a reserved job from the queue. */
    public deleteReserved(queue: string, job: MemoryStoreJob): void {
        this.queueFor(queue).RemoveAsync(job.getReservedId());
    }

    /** Delete a reserved job from the queue and release it. */
    public deleteAndRelease(
        queue: string,
        job: MemoryStoreJob,
        delay: Delay,
    ): void {
        this.deleteReserved(queue, job);

        this.release(queue, job.payload(), delay);
    }

    /** Pop the next job off of the queue. */
    public pop(queue?: string): Job | undefined {
        const name = this.getQueue(queue);

        this.migrate(name);

        // An empty read answers with nothing at all, not an empty list.
        const [read, id] = this.queueFor(name).ReadAsync(
            1,
            false,
            this.blockFor,
        );

        const items = read as Array<string> | undefined;

        if (items === undefined || items.size() === 0) {
            return undefined;
        }

        return new MemoryStoreJob(
            this.container,
            this,
            items[0],
            id,
            this.connectionName,
            name,
        );
    }

    /** Move the delayed jobs that are ready onto the queue. */
    protected migrate(queue: string): void {
        const delayed = this.delayedFor(queue);

        const now = InteractsWithTime.currentTime();

        const due = delayed.GetRangeAsync(
            Enum.SortDirection.Ascending,
            this.migrationBatchSize,
        );

        for (const item of due) {
            const key = item.key as string;

            if (this.timestampOf(key) > now) {
                break;
            }

            // Whoever removes the key owns the job: a second server that reads
            // the same range finds nothing left to take.
            const [removed] = pcall(() => delayed.RemoveAsync(key));

            if (removed) {
                this.queueFor(queue).AddAsync(
                    item.value as string,
                    this.expiration,
                    0,
                );
            }
        }
    }

    /** How many delayed jobs one migration may move. */
    protected migrationBatchSize = 20;

    /** The key a delayed job is stored under, ordered by when it is due. */
    protected delayedKey(availableAt: number, uuid: string): string {
        return `${string.format(`%0${SORT_KEY_DIGITS}d`, availableAt)}:${uuid}`;
    }

    /** Read the timestamp back out of a delayed key. */
    protected timestampOf(key: string): number {
        return tonumber(key.sub(1, SORT_KEY_DIGITS)) ?? 0;
    }

    /** Turn a payload into the string that is stored. */
    protected encode(payload: JobPayload): string {
        const encoded = Serializer.serialize(payload);

        if (encoded.size() > MAX_ITEM_BYTES) {
            throw new InvalidPayloadException(
                `The payload for [${payload.displayName ?? Str.random(8)}] is ${encoded.size()} bytes; MemoryStore accepts at most ${MAX_ITEM_BYTES}.`,
                payload,
            );
        }

        return encoded;
    }
}
