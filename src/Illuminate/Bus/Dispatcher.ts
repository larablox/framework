import { Connection } from 'Illuminate/Queue/Attributes/Connection';
import { Delay } from 'Illuminate/Queue/Attributes/Delay';
import { InteractsWithQueue } from 'Illuminate/Queue/InteractsWithQueue';
import { PendingBatch } from 'Illuminate/Bus/PendingBatch';
import { Pipeline } from 'Illuminate/Pipeline/Pipeline';
import { Queue as QueueAttribute } from 'Illuminate/Queue/Attributes/Queue';
import { ReadsClassAttributes } from 'Illuminate/Support/Traits/ReadsClassAttributes';
import { Reflector } from 'Illuminate/Support/Reflector';
import { RuntimeException } from 'Illuminate/Exception';
import { SyncJob } from 'Illuminate/Queue/Jobs/SyncJob';
import { isShouldQueue } from 'Illuminate/Contracts/Queue/ShouldQueue';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Delay as DelayValue } from 'Illuminate/Support/InteractsWithTime';
import type { JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';
import type { Batch } from 'Illuminate/Bus/Batch';
import type { BatchRepository } from 'Illuminate/Bus/BatchRepository';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';
import type { Batchable } from 'Illuminate/Bus/Batchable';
import type { QueueingDispatcher } from 'Illuminate/Contracts/Bus/Dispatcher';

/** PHP: the `$queueResolver` closure the dispatcher is built with. */
export type QueueResolver = (connection?: string) => Queue;

/** The payload a synchronous job is handed when it has no real one. */
const EMPTY_PAYLOAD: JobPayload = {
    uuid: '',
    job: 'sync',
    failOnTimeout: false,
    data: {},
    createdAt: 0,
};

/**
 * PHP: `Illuminate\Bus\Dispatcher`.
 *
 * Decides whether a command runs now or goes to a queue, and runs it when it is
 * time, sending it through the pipes registered with `pipeThrough()`.
 *
 * `chain()` on the dispatcher returns a `PendingChain`, which a job builds for
 * itself with `withChain()`. `dispatchAfterResponse()` has no response to come
 * after -- `DeferredQueue` is the thing that resembles it here.
 */
export class Dispatcher implements QueueingDispatcher
{
    /** The pipeline instance for the bus. */
    protected readonly pipeline: Pipeline;

    /** The pipes to send commands through before dispatching. */
    protected pipes = new Array<Pipe>();

    /** The command to handler mapping for non-self-handling events. */
    protected handlers = new Array<[object, Abstract]>();

    /** Create a new command dispatcher instance. */
    public constructor(
        protected readonly container: Container,
        protected readonly queueResolver?: QueueResolver,
    )
    {
        this.pipeline = new Pipeline(container);
    }

    /** Dispatch a command to its appropriate handler. */
    public dispatch(command: object): unknown
    {
        return this.queueResolver !== undefined && this.commandShouldBeQueued(command)
            ? this.dispatchToQueue(command)
            : this.dispatchNow(command);
    }

    /**
     * Dispatch a command to its appropriate handler in the current process.
     *
     * Queueable jobs will be dispatched to the "sync" queue.
     */
    public dispatchSync(command: object, handler?: object): unknown
    {
        const onConnection = (command as { onConnection?: unknown; }).onConnection;

        if (
            this.queueResolver !== undefined
            && this.commandShouldBeQueued(command)
            && typeIs(onConnection, 'function')
        ) {
            // Reached through the table rather than the method, so the receiver
            // is passed by hand: a dot call would leave `self` behind.
            return this.dispatchToQueue(
                (onConnection as (self: object, connection: string) => object)(command, 'sync'),
            );
        }

        return this.dispatchNow(command, handler);
    }

    /** Dispatch a command to its appropriate handler in the current process without using the synchronous queue. */
    public dispatchNow(command: object, handler?: object): unknown
    {
        if (Reflector.isInstanceOf(command, InteractsWithQueue) && (command as InteractsWithQueue).job === undefined) {
            (command as InteractsWithQueue).setJob(new SyncJob(this.container, EMPTY_PAYLOAD, 'sync', 'sync'));
        }

        const resolved = handler ?? this.getCommandHandler(command);

        const callback = (passable: unknown): unknown =>
            resolved !== undefined
                ? this.container.call([
                    resolved,
                    this.methodOf(resolved),
                ], [passable])
                : this.container.call([
                    passable as object,
                    this.methodOf(passable as object),
                ]);

        const pipeline = this.pipeline.send(command).through(this.pipes);

        return pipeline.then(callback);
    }

    /** PHP: `method_exists($target, 'handle') ? 'handle' : '__invoke'`. */
    protected methodOf(target: object): string
    {
        return typeIs((target as { handle?: unknown; }).handle, 'function') ? 'handle' : '__invoke';
    }

    /** Determine if the given command has a handler. */
    public hasCommandHandler(command: object): boolean
    {
        return this.handlerFor(command) !== undefined;
    }

    /** Retrieve the handler for a command. */
    public getCommandHandler(command: object): object | undefined
    {
        const handler = this.handlerFor(command);

        return handler !== undefined ? (this.container.make(handler) as object) : undefined;
    }

    /** The registered handler for the command's class, if any. */
    protected handlerFor(command: object): Abstract | undefined
    {
        const klass = Reflector.classOf(command);

        for (const [mapped, handler] of this.handlers) {
            if (mapped === klass) {
                return handler;
            }
        }

        return undefined;
    }

    /** Determine if the given command should be queued. */
    protected commandShouldBeQueued(command: object): boolean
    {
        return isShouldQueue(command);
    }

    /** Dispatch a command to its appropriate handler behind a queue. */
    public dispatchToQueue(command: object): unknown
    {
        const connection = ReadsClassAttributes.getAttributeValue(command, Connection, 'connection') as
            | string
            | undefined;

        const queue = (this.queueResolver as QueueResolver)(connection);

        if (queue === undefined) {
            throw new RuntimeException('Queue resolver did not return a Queue implementation.');
        }

        const custom = (command as { queue?: unknown; }).queue;

        if (typeIs(custom, 'function')) {
            return (custom as (self: object, queue: Queue, command: object) => unknown)(command, queue, command);
        }

        return this.pushCommandToQueue(queue, command);
    }

    /** Push the command onto the given queue instance. */
    protected pushCommandToQueue(queue: Queue, command: object): unknown
    {
        const queueName = ReadsClassAttributes.getAttributeValue(command, QueueAttribute, 'queue') as
            | string
            | undefined;

        const delay = ReadsClassAttributes.getAttributeValue(command, Delay, 'delaySeconds') as DelayValue | undefined;

        if (delay !== undefined) {
            return queue.later(delay, command, '', queueName);
        }

        return queue.push(command, '', queueName);
    }

    /** Create a new batch of queueable jobs. */
    public batch(jobs: Array<Batchable>): PendingBatch
    {
        return new PendingBatch(this.container, jobs);
    }

    /** Attempt to find the batch with the given ID. */
    public findBatch(batchId: string): Batch | undefined
    {
        return this.container.make<BatchRepository>('bus.batches').find(batchId);
    }

    /** Set the pipes through which commands should be piped before dispatching. */
    public pipeThrough(pipes: Array<Pipe>): this
    {
        this.pipes = pipes;

        return this;
    }

    /** Map a command to a handler. */
    public map(map: Array<[object, Abstract]>): this
    {
        for (const entry of map) {
            this.handlers.push(entry);
        }

        return this;
    }
}
