import { Container } from "Illuminate/Container/Container";
import { Dispatcher as BusDispatcher } from "Illuminate/Bus/Dispatcher";
import { InteractsWithQueue } from "Illuminate/Queue/InteractsWithQueue";
import { Serializer } from "Illuminate/Support/Serializer";
import type { Delay } from "Illuminate/Support/InteractsWithTime";

/**
 * PHP: `Illuminate\Bus\Queueable`.
 *
 * A trait in PHP, and one a job always uses beside `InteractsWithQueue`. There
 * is no multiple inheritance here, so the two become one chain: a job extends
 * `Dispatchable`, which extends this, which extends `InteractsWithQueue`.
 *
 * PHP has a `$delay` property beside a `delay()` method; a Luau table holds one
 * value per key, so the property is `delaySeconds`.
 *
 * Not ported: `$chainCatchCallbacks` (a catch callback is a closure, and a
 * closure does not survive serialization), batches inside chains
 * (`ChainedBatch`), and the PHPUnit `assertHasChain` helpers.
 */
export class Queueable extends InteractsWithQueue {
    /** The name of the connection the job should be sent to. */
    public connection?: string;

    /** The name of the queue the job should be sent to. */
    public queue?: string;

    /** The name of the connection the chain should be sent to. */
    public chainConnection?: string;

    /** The name of the queue the chain should be sent to. */
    public chainQueue?: string;

    /** The number of seconds before the job should be made available. */
    public delaySeconds?: Delay;

    /** Indicates whether the job should be dispatched after all database transactions have committed. */
    public afterCommit?: boolean;

    /** The middleware the job should be dispatched through. */
    public middleware = new Array<unknown>();

    /** The jobs that should run if this job is successful, already serialized. */
    public chained = new Array<string>();

    /** Set the desired connection for the job. */
    public onConnection(connection?: string): this {
        this.connection = connection;

        return this;
    }

    /** Set the desired queue for the job. */
    public onQueue(queue?: string): this {
        this.queue = queue;

        return this;
    }

    /** Set the desired connection for the chain. */
    public allOnConnection(connection?: string): this {
        this.chainConnection = connection;
        this.connection = connection;

        return this;
    }

    /** Set the desired queue for the chain. */
    public allOnQueue(queue?: string): this {
        this.chainQueue = queue;
        this.queue = queue;

        return this;
    }

    /** Set the desired delay in seconds for the job. */
    public delay(delay?: Delay): this {
        this.delaySeconds = delay;

        return this;
    }

    /** Set the delay for the job to zero seconds. */
    public withoutDelay(): this {
        this.delaySeconds = 0;

        return this;
    }

    /** Indicate that the job should be dispatched after all database transactions have committed. */
    public afterCommitting(): this {
        this.afterCommit = true;

        return this;
    }

    /** Indicate that the job should not wait until database transactions have been committed. */
    public beforeCommit(): this {
        this.afterCommit = false;

        return this;
    }

    /**
     * Specify the middleware the job should be dispatched through.
     *
     * A plain table is the list; a class or an instance carries a metatable and
     * is the single middleware itself. `Util.isArray()` cannot be used here --
     * it answers for a non-empty list only.
     */
    public through(middleware: unknown | Array<unknown>): this {
        this.middleware =
            typeIs(middleware, "table") &&
            getmetatable(middleware as object) === undefined
                ? (middleware as Array<unknown>)
                : [middleware];

        return this;
    }

    /** Set the jobs that should run if this job is successful. */
    public chain(chain: Array<object>): this {
        this.chained = chain.map((job) => this.serializeJob(job));

        return this;
    }

    /** Prepend a job to the current chain so that it is run after the currently running job. */
    public prependToChain(job: object): this {
        this.chained = [this.serializeJob(job), ...this.chained];

        return this;
    }

    /** Append a job to the end of the current chain. */
    public appendToChain(job: object): this {
        this.chained = [...this.chained, this.serializeJob(job)];

        return this;
    }

    /** Serialize a job for queuing. */
    protected serializeJob(job: object): string {
        return Serializer.serialize(job);
    }

    /** Dispatch the next job on the chain. */
    public dispatchNextJobInChain(): void {
        if (this.chained.size() === 0) {
            return;
        }

        const remaining = [...this.chained];

        const encoded = remaining.shift() as string;

        const following = Serializer.unserialize(encoded) as Queueable;

        following.chained = remaining;

        following.onConnection(following.connection ?? this.chainConnection);
        following.onQueue(following.queue ?? this.chainQueue);

        following.chainConnection = this.chainConnection;
        following.chainQueue = this.chainQueue;

        Container.getInstance()
            .make<BusDispatcher>(BusDispatcher)
            .dispatch(following);
    }
}
