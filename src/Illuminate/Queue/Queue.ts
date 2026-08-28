import { Backoff } from 'Illuminate/Queue/Attributes/Backoff';
import { CallQueuedHandler } from 'Illuminate/Queue/CallQueuedHandler';
import { Collection } from 'Illuminate/Support/Collection';
import { DeleteWhenMissingModels } from 'Illuminate/Queue/Attributes/DeleteWhenMissingModels';
import { FailOnTimeout } from 'Illuminate/Queue/Attributes/FailOnTimeout';
import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import { JobQueued } from 'Illuminate/Queue/Events/JobQueued';
import { JobQueueing } from 'Illuminate/Queue/Events/JobQueueing';
import { MaxExceptions } from 'Illuminate/Queue/Attributes/MaxExceptions';
import { ReadsClassAttributes } from 'Illuminate/Support/Traits/ReadsClassAttributes';
import { Reflector } from 'Illuminate/Support/Reflector';
import { Str } from 'Illuminate/Support/Str';
import { Timeout } from 'Illuminate/Queue/Attributes/Timeout';
import { Tries } from 'Illuminate/Queue/Attributes/Tries';
import { Util } from 'Illuminate/Container/Util';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Delay } from 'Illuminate/Support/InteractsWithTime';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Job, JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { JobTarget } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: the `callable` registered through `Queue::createPayloadUsing()`. */
export type CreatePayloadCallback = (
    connection: string,
    queue: string | undefined,
    payload: JobPayload,
) => Partial<JobPayload>;

/** The callback `enqueueUsing()` hands the built payload to. */
export type EnqueueCallback = (payload: JobPayload, queue: string | undefined, delay: Delay | undefined) => unknown;

/**
 * PHP: `Illuminate\Queue\Queue`.
 *
 * The payload is a table rather than a JSON string, and `data.command` holds
 * the job object rather than `serialize($job)`. PHP has no choice -- its
 * payload always travels through storage on its way to another process -- while
 * a queue that stays inside one server has nothing to travel through. A storage
 * driver serialises the payload at its own boundary, through
 * `Support/Serializer`, and `CallQueuedHandler` accepts either form.
 *
 * `jobShouldBeEncrypted()` and `ShouldBeEncrypted` go with the encrypter, which
 * does not exist.
 *
 * `push()`, `later()` and `pop()` are declared abstract here so that the
 * methods below may call them; PHP reaches them through the `Queue` contract
 * that every concrete queue implements.
 */
export abstract class Queue
{
    /** The IoC container instance. */
    protected container!: Container;

    /** The connection name for the queue. */
    protected connectionName = '';

    /** The original configuration for the queue. */
    protected config: ArrayAccessible = {};

    /** Indicates that jobs should be dispatched after all database transactions have committed. */
    protected dispatchAfterCommit?: boolean;

    /** The create payload callbacks. */
    protected static createPayloadCallbacks = new Array<CreatePayloadCallback>();

    /** Push a new job onto the queue. */
    public abstract push(job: JobTarget, data?: unknown, queue?: string): unknown;

    /** Push a new job onto the queue after (n) seconds. */
    public abstract later(delay: Delay, job: JobTarget, data?: unknown, queue?: string): unknown;

    /** Pop the next job off of the queue. */
    public abstract pop(queue?: string): Job | undefined;

    /** Push a new job onto the queue. */
    public pushOn(queue: string, job: JobTarget, data: unknown = ''): unknown
    {
        return this.push(job, data, queue);
    }

    /** Push a new job onto a specific queue after (n) seconds. */
    public laterOn(queue: string, delay: Delay, job: JobTarget, data: unknown = ''): unknown
    {
        return this.later(delay, job, data, queue);
    }

    /** Push an array of jobs onto the queue. */
    public bulk(jobs: JobTarget | Array<JobTarget>, data: unknown = '', queue?: string): void
    {
        for (const job of Util.isArray(jobs) ? (jobs as Array<JobTarget>) : [jobs as JobTarget]) {
            this.push(job, data, queue);
        }
    }

    /** Create a payload from the given job and data. */
    protected createPayload(job: JobTarget, queue: string | undefined, data: unknown = '', delay?: Delay): JobPayload
    {
        const value = this.createPayloadArray(job, queue, data);

        value.delay = delay !== undefined ? InteractsWithTime.secondsUntil(delay) : undefined;

        return value;
    }

    /** Create a payload array from the given job and data. */
    protected createPayloadArray(job: JobTarget, queue: string | undefined, data: unknown = ''): JobPayload
    {
        return Reflector.isInstance(job)
            ? this.createObjectPayload(job as object, queue)
            : this.createStringPayload(job, queue, data);
    }

    /** Create a payload for an object-based queue handler. */
    protected createObjectPayload(job: object, queue: string | undefined): JobPayload
    {
        const payload = this.withCreatePayloadHooks(queue, {
            uuid: Str.uuid(),
            displayName: this.getDisplayName(job),
            job: [CallQueuedHandler, 'call'],
            maxTries: this.getJobTries(job) as number | undefined,
            maxExceptions: ReadsClassAttributes.getAttributeValue(job, MaxExceptions, 'maxExceptions') as
                | number
                | undefined,
            failOnTimeout:
                (ReadsClassAttributes.getAttributeValue(job, FailOnTimeout, 'failOnTimeout') as boolean | undefined)
                    ?? false,
            backoff: this.getJobBackoff(job),
            timeout: ReadsClassAttributes.getAttributeValue(job, Timeout, 'timeout') as number | undefined,
            retryUntil: this.getJobExpiration(job),
            deleteWhenMissingModels:
                (ReadsClassAttributes.getAttributeValue(job, DeleteWhenMissingModels, 'deleteWhenMissingModels') as
                    | boolean
                    | undefined) ?? false,
            data: {
                commandName: Reflector.classOf(job) ?? Reflector.className(job),
                command: job,
                batchId: (job as { batchId?: string; }).batchId,
            },
            createdAt: InteractsWithTime.currentTime(),
        });

        // PHP merges the command back into `data` *after* the hooks have run,
        // so a `createPayloadUsing()` callback that hands back a whole new
        // `data` table cannot take the job itself with it -- and the handler
        // still has something to resolve.
        const data: Record<string, unknown> = {};

        if (typeIs(payload.data, 'table')) {
            for (const [key, value] of pairs(payload.data as Record<string, defined>)) {
                data[key as string] = value;
            }
        }

        data.commandName = Reflector.classOf(job) ?? Reflector.className(job);
        data.command = job;

        payload.data = data;

        return payload;
    }

    /** Get the display name for the given job. */
    protected getDisplayName(job: object): string
    {
        const displayName = (job as { displayName?: unknown; }).displayName;

        return typeIs(displayName, 'function')
            ? (displayName as (self: object) => string)(job)
            : Reflector.className(Reflector.classOf(job));
    }

    /** Get the maximum number of attempts for an object-based queue handler. */
    public getJobTries(job: object): unknown
    {
        let tries = ReadsClassAttributes.getAttributeValue(job, Tries, 'tries');

        const method = (job as { tries?: unknown; }).tries;

        if (typeIs(method, 'function')) {
            tries = (method as (self: object) => number)(job);
        }

        return tries;
    }

    /** Get the backoff for an object-based queue handler. */
    public getJobBackoff(job: object): string | undefined
    {
        let backoff = ReadsClassAttributes.getAttributeValue(job, Backoff, 'backoff');

        const method = (job as { backoff?: unknown; }).backoff;

        if (typeIs(method, 'function')) {
            backoff = (method as (self: object) => unknown)(job);
        }

        if (backoff === undefined) {
            return undefined;
        }

        return Collection.wrap(backoff as defined)
            .map((entry) => (typeIs(entry, 'number') ? entry : InteractsWithTime.secondsUntil(entry as Delay)))
            .implode(',');
    }

    /** Get the expiration timestamp for an object-based queue handler. */
    public getJobExpiration(job: object): number | undefined
    {
        const retryUntil = (job as { retryUntil?: unknown; }).retryUntil;

        if (retryUntil === undefined) {
            return undefined;
        }

        const expiration = typeIs(retryUntil, 'function') ? (retryUntil as (self: object) => unknown)(job) : retryUntil;

        return typeIs(expiration, 'number') ? expiration : (expiration as DateTime).UnixTimestamp;
    }

    /** Create a typical, string based queue payload array. */
    protected createStringPayload(job: JobTarget, queue: string | undefined, data: unknown): JobPayload
    {
        return this.withCreatePayloadHooks(queue, {
            uuid: Str.uuid(),
            displayName: typeIs(job, 'string') ? Str.parseCallback(job)[0] : undefined,
            job: job as JobPayload['job'],
            maxTries: undefined,
            maxExceptions: undefined,
            failOnTimeout: false,
            backoff: undefined,
            timeout: undefined,
            data,
            createdAt: InteractsWithTime.currentTime(),
        });
    }

    /** Register a callback to be executed when creating job payloads. */
    public static createPayloadUsing(callback?: CreatePayloadCallback): void
    {
        if (callback === undefined) {
            Queue.createPayloadCallbacks = new Array<CreatePayloadCallback>();
        } else {
            Queue.createPayloadCallbacks.push(callback);
        }
    }

    /** Create the given payload using any registered payload hooks. */
    protected withCreatePayloadHooks(queue: string | undefined, payload: JobPayload): JobPayload
    {
        for (const callback of Queue.createPayloadCallbacks) {
            const extra = callback(this.getConnectionName(), queue, payload);

            for (const [key, value] of pairs(extra as unknown as Record<string, defined>)) {
                (payload as unknown as Record<string, unknown>)[key as string] = value;
            }
        }

        return payload;
    }

    /**
     * Enqueue a job using the given callback.
     *
     * The `db.transactions` branch is gone with the database: without a
     * transaction manager `shouldDispatchAfterCommit()` has nothing to defer to.
     */
    protected enqueueUsing(
        job: JobTarget,
        payload: JobPayload,
        queue: string | undefined,
        delay: Delay | undefined,
        callback: EnqueueCallback,
    ): unknown
    {
        this.raiseJobQueueingEvent(queue, job, payload, delay);

        const jobId = callback(payload, queue, delay);

        this.raiseJobQueuedEvent(queue, jobId, job, payload, delay);

        return jobId;
    }

    /** Determine if the job should be dispatched after all database transactions have committed. */
    protected shouldDispatchAfterCommit(job: JobTarget): boolean
    {
        if (typeIs(job, 'table')) {
            const afterCommit = (job as { afterCommit?: boolean; }).afterCommit;

            if (afterCommit !== undefined) {
                return afterCommit;
            }
        }

        return this.dispatchAfterCommit ?? false;
    }

    /** Raise the job queueing event. */
    protected raiseJobQueueingEvent(
        queue: string | undefined,
        job: JobTarget,
        payload: JobPayload,
        delay: Delay | undefined,
    ): void
    {
        if (this.container.bound('events')) {
            this.container
                .make<Dispatcher>('events')
                .dispatch(
                    new JobQueueing(
                        this.connectionName,
                        queue,
                        job,
                        payload,
                        delay !== undefined ? InteractsWithTime.secondsUntil(delay) : undefined,
                    ),
                );
        }
    }

    /** Raise the job queued event. */
    protected raiseJobQueuedEvent(
        queue: string | undefined,
        jobId: unknown,
        job: JobTarget,
        payload: JobPayload,
        delay: Delay | undefined,
    ): void
    {
        if (this.container.bound('events')) {
            this.container
                .make<Dispatcher>('events')
                .dispatch(
                    new JobQueued(
                        this.connectionName,
                        queue,
                        jobId,
                        job,
                        payload,
                        delay !== undefined ? InteractsWithTime.secondsUntil(delay) : undefined,
                    ),
                );
        }
    }

    /** Get the connection name for the queue. */
    public getConnectionName(): string
    {
        return this.connectionName;
    }

    /** Set the connection name for the queue. */
    public setConnectionName(name: string): this
    {
        this.connectionName = name;

        return this;
    }

    /** Get the original configuration for the queue. */
    public getConfig(): ArrayAccessible
    {
        return this.config;
    }

    /** Set the original configuration for the queue. */
    public setConfig(config: ArrayAccessible): this
    {
        this.config = config;

        return this;
    }

    /** Get the container instance being used by the connection. */
    public getContainer(): Container
    {
        return this.container;
    }

    /** Set the IoC container instance. */
    public setContainer(container: Container): void
    {
        this.container = container;
    }
}
