import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Bus/Dispatcher";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { Queueable } from "Illuminate/Bus/Queueable";

/**
 * PHP: `Illuminate\Foundation\Bus\PendingChain`.
 *
 * What `Job::withChain([...])` hands back. Unlike `PendingDispatch` this one is
 * sent explicitly, in PHP too: `Job::withChain([...])->dispatch()`.
 *
 * `catch()` is not ported -- a catch callback is a closure, and a closure does
 * not survive serialization.
 */
export class PendingChain<T extends Queueable = Queueable, A extends Array<unknown> = Array<unknown>> {
    /** The connection the chain should run on. */
    protected connection?: string;

    /** The queue the chain should run on. */
    protected queue?: string;

    /** The delay before the first job runs. */
    protected delayFor?: Delay;

    /** Create a new PendingChain instance. */
    public constructor(
        protected readonly job: new (...args: A) => T,
        protected readonly chain: Array<object>,
    ) {}

    /** Set the desired connection for the chain. */
    public onConnection(connection?: string): this {
        this.connection = connection;

        return this;
    }

    /** Set the desired queue for the chain. */
    public onQueue(queue?: string): this {
        this.queue = queue;

        return this;
    }

    /** Set the desired delay for the chain. */
    public delay(delay?: Delay): this {
        this.delayFor = delay;

        return this;
    }

    /** Dispatch the job chain. */
    public dispatch(...args: A): unknown {
        const first = new this.job(...args);

        if (this.connection !== undefined) {
            first.chainConnection = this.connection;
            first.connection = first.connection ?? this.connection;
        }

        if (this.queue !== undefined) {
            first.chainQueue = this.queue;
            first.queue = first.queue ?? this.queue;
        }

        if (this.delayFor !== undefined) {
            first.delaySeconds = first.delaySeconds ?? this.delayFor;
        }

        first.chain(this.chain);

        return Container.getInstance().make<Dispatcher>(Dispatcher).dispatch(first);
    }
}
