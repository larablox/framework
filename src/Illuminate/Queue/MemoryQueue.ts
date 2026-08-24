import { Collection } from "Illuminate/Support/Collection";
import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { MemoryJob } from "Illuminate/Queue/Jobs/MemoryJob";
import { Queue } from "Illuminate/Queue/Queue";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { Job, JobPayload } from "Illuminate/Contracts/Queue/Job";
import type {
    JobTarget,
    Queue as QueueContract,
} from "Illuminate/Contracts/Queue/Queue";

/**
 * One row of the table `DatabaseQueue` keeps, held in memory.
 *
 * The column names are the PHP ones in this project's casing: `reserved_at`
 * becomes `reservedAt`, and so on.
 */
export interface MemoryJobRecord {
    id: string;
    queue: string;
    payload: JobPayload;
    attempts: number;
    reservedAt?: number;
    availableAt: number;
    createdAt: number;
}

/**
 * PHP: `Illuminate\Queue\DatabaseQueue`, with the table held in memory.
 *
 * Same mechanics as the database driver -- `available_at` for delays,
 * `reserved_at` plus `retry_after` for a job whose worker died, `attempts` for
 * retries -- minus the database. Everything a transaction and a `FOR UPDATE`
 * lock buy PHP comes free: a Luau coroutine is only ever interrupted where it
 * yields, and nothing here does.
 *
 * The queue lives in one server: pushing and working both happen inside the
 * same Luau VM, so a payload is never serialised and jobs do not outlive the
 * server. `MemoryStoreQueue` is the one that crosses those lines.
 *
 * `block_for` works as it does on the Redis driver: `pop()` waits that many
 * seconds for a job instead of answering "nothing" at once, so a worker sleeps
 * rather than polls and picks a job up the moment it is pushed. Redis waits in
 * `blpop` on a `:notify` list; there is no list to wait on inside one VM, so a
 * push resumes the coroutines parked in `pop()` directly.
 */
export class MemoryQueue extends Queue implements QueueContract {
    /** The table, in the order rows were inserted. */
    protected jobs = new Array<MemoryJobRecord>();

    /** The auto-incrementing primary key. */
    protected nextId = 1;

    /** Everyone parked inside `pop()`, waiting for something to arrive. */
    protected waiting = new Array<() => void>();

    /** Create a new memory queue instance. */
    public constructor(
        protected readonly defaultQueue = "default",
        protected readonly retryAfter = 60,
        protected readonly blockFor = 0,
        dispatchAfterCommit = false,
    ) {
        super();

        this.dispatchAfterCommit = dispatchAfterCommit;
    }

    /** Get the queue or return the default. */
    public getQueue(queue?: string): string {
        return queue ?? this.defaultQueue;
    }

    /** Get the size of the queue. */
    public size(queue?: string): number {
        return this.recordsFor(queue).size();
    }

    /** Get the number of pending jobs. */
    public pendingSize(queue?: string): number {
        return this.pendingRecords(queue).size();
    }

    /** Get the number of delayed jobs. */
    public delayedSize(queue?: string): number {
        return this.delayedRecords(queue).size();
    }

    /** Get the number of reserved jobs. */
    public reservedSize(queue?: string): number {
        return this.reservedRecords(queue).size();
    }

    /** Get the pending jobs for the given queue. */
    public pendingJobs(queue?: string): Collection<number, MemoryJobRecord> {
        return new Collection(this.pendingRecords(queue));
    }

    /** Get the delayed jobs for the given queue. */
    public delayedJobs(queue?: string): Collection<number, MemoryJobRecord> {
        return new Collection(this.delayedRecords(queue));
    }

    /** Get the reserved jobs for the given queue. */
    public reservedJobs(queue?: string): Collection<number, MemoryJobRecord> {
        return new Collection(this.reservedRecords(queue));
    }

    /** Get all pending jobs across every queue. */
    public allPendingJobs(): Collection<number, MemoryJobRecord> {
        return new Collection(
            this.jobs.filter(
                (record) =>
                    record.reservedAt === undefined &&
                    record.availableAt <= InteractsWithTime.currentTime(),
            ),
        );
    }

    /** Get all delayed jobs across every queue. */
    public allDelayedJobs(): Collection<number, MemoryJobRecord> {
        return new Collection(
            this.jobs.filter(
                (record) =>
                    record.reservedAt === undefined &&
                    record.availableAt > InteractsWithTime.currentTime(),
            ),
        );
    }

    /** Get all reserved jobs across every queue. */
    public allReservedJobs(): Collection<number, MemoryJobRecord> {
        return new Collection(
            this.jobs.filter((record) => record.reservedAt !== undefined),
        );
    }

    /** Get the creation timestamp of the oldest pending job, excluding delayed jobs. */
    public creationTimeOfOldestPendingJob(queue?: string): number | undefined {
        const pending = this.pendingRecords(queue);

        return pending.size() > 0 ? pending[0].createdAt : undefined;
    }

    /** Push a new job onto the queue. */
    public push(job: JobTarget, data: unknown = "", queue?: string): unknown {
        return this.enqueueUsing(
            job,
            this.createPayload(job, this.getQueue(queue), data),
            queue,
            undefined,
            (payload, name) => this.pushToStore(name, payload, 0, 0),
        );
    }

    /** Push a raw payload onto the queue. */
    public pushRaw(
        payload: JobPayload,
        queue?: string,
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- the database driver reads no options either */
        options?: ArrayAccessible,
    ): unknown {
        return this.pushToStore(queue, payload, 0, 0);
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
                this.pushToStore(name, payload, seconds ?? 0, 0),
        );
    }

    /** Release a reserved job back onto the queue. */
    public release(queue: string, job: MemoryJobRecord, delay: Delay): string {
        return this.pushToStore(queue, job.payload, delay, job.attempts);
    }

    /** Delete a reserved job from the queue and release it. */
    public deleteAndRelease(queue: string, job: MemoryJob, delay: Delay): void {
        const record = job.getJobRecord();

        this.deleteReserved(queue, record.id);

        this.pushToStore(queue, record.payload, delay, record.attempts);
    }

    /** Push a raw payload to the store, returning the new row's id. */
    protected pushToStore(
        queue: string | undefined,
        payload: JobPayload,
        delay: Delay = 0,
        attempts = 0,
    ): string {
        const record = this.buildRecord(
            this.getQueue(queue),
            payload,
            InteractsWithTime.availableAt(delay),
            attempts,
        );

        this.jobs.push(record);

        if (record.availableAt <= InteractsWithTime.currentTime()) {
            this.wakeWaiters();
        } else {
            // A delayed job arrives by the clock, not by a push, so its own
            // wake-up is booked for the moment it becomes due.
            task.delay(
                record.availableAt - InteractsWithTime.currentTime(),
                () => this.wakeWaiters(),
            );
        }

        return record.id;
    }

    /** Create a new row for the given job. */
    protected buildRecord(
        queue: string,
        payload: JobPayload,
        availableAt: number,
        attempts = 0,
    ): MemoryJobRecord {
        const id = tostring(this.nextId);

        this.nextId += 1;

        return {
            id,
            queue,
            attempts,
            reservedAt: undefined,
            availableAt,
            createdAt: InteractsWithTime.currentTime(),
            payload,
        };
    }

    /**
     * Pop the next job off of the queue.
     *
     * Yields for up to `block_for` seconds when there is nothing to take, the
     * way the Redis driver blocks in `blpop`. With `block_for` at zero it
     * answers at once, as the database driver does.
     */
    public pop(queue?: string): Job | undefined {
        const name = this.getQueue(queue);

        const record = this.getNextAvailableJob(name);

        if (record !== undefined) {
            return this.marshalJob(name, record);
        }

        if (this.blockFor <= 0) {
            return undefined;
        }

        this.waitForJob(this.blockFor);

        const arrived = this.getNextAvailableJob(name);

        return arrived !== undefined
            ? this.marshalJob(name, arrived)
            : undefined;
    }

    /** Park the calling coroutine until something is pushed, or time runs out. */
    protected waitForJob(seconds: number): void {
        const parked = coroutine.running();

        let resumed = false;

        const wake = (): void => {
            if (resumed) {
                return;
            }

            resumed = true;

            task.spawn(parked);
        };

        this.waiting.push(wake);

        task.delay(seconds, wake);

        coroutine.yield();
    }

    /** Resume everyone parked in `pop()`. */
    protected wakeWaiters(): void {
        const parked = this.waiting;

        this.waiting = new Array<() => void>();

        for (const wake of parked) {
            wake();
        }
    }

    /** Get the next available job for the queue. */
    protected getNextAvailableJob(queue: string): MemoryJobRecord | undefined {
        const now = InteractsWithTime.currentTime();

        for (const record of this.jobs) {
            if (record.queue !== queue) {
                continue;
            }

            const available =
                record.reservedAt === undefined && record.availableAt <= now;

            const expired =
                record.reservedAt !== undefined &&
                record.reservedAt + this.retryAfter <= now;

            if (available || expired) {
                return record;
            }
        }

        return undefined;
    }

    /** Marshal the reserved job into a job instance. */
    protected marshalJob(queue: string, record: MemoryJobRecord): MemoryJob {
        return new MemoryJob(
            this.container,
            this,
            this.markJobAsReserved(record),
            this.connectionName,
            queue,
        );
    }

    /** Mark the given job as reserved. */
    protected markJobAsReserved(record: MemoryJobRecord): MemoryJobRecord {
        record.reservedAt = InteractsWithTime.currentTime();
        record.attempts += 1;

        return record;
    }

    /** Delete a reserved job from the queue. */
    public deleteReserved(queue: string, id: string): void {
        for (let index = 0; index < this.jobs.size(); index++) {
            if (this.jobs[index].id === id) {
                this.jobs.remove(index);

                return;
            }
        }
    }

    /** Delete all of the jobs from the queue. */
    public clear(queue?: string): number {
        const name = this.getQueue(queue);

        const kept = this.jobs.filter((record) => record.queue !== name);

        const removed = this.jobs.size() - kept.size();

        this.jobs = kept;

        return removed;
    }

    /** Every row of the given queue. */
    protected recordsFor(queue?: string): Array<MemoryJobRecord> {
        const name = this.getQueue(queue);

        return this.jobs.filter((record) => record.queue === name);
    }

    /** Rows waiting to be popped. */
    protected pendingRecords(queue?: string): Array<MemoryJobRecord> {
        const now = InteractsWithTime.currentTime();

        return this.recordsFor(queue).filter(
            (record) =>
                record.reservedAt === undefined && record.availableAt <= now,
        );
    }

    /** Rows that are not available yet. */
    protected delayedRecords(queue?: string): Array<MemoryJobRecord> {
        const now = InteractsWithTime.currentTime();

        return this.recordsFor(queue).filter(
            (record) =>
                record.reservedAt === undefined && record.availableAt > now,
        );
    }

    /** Rows a worker is holding. */
    protected reservedRecords(queue?: string): Array<MemoryJobRecord> {
        return this.recordsFor(queue).filter(
            (record) => record.reservedAt !== undefined,
        );
    }
}
