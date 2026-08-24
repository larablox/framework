import { Container } from "Illuminate/Container/Container";
import { UniqueLock } from "Illuminate/Bus/UniqueLock";
import { isShouldBeUnique } from "Illuminate/Contracts/Queue/ShouldBeUnique";
import { Dispatcher } from "Illuminate/Bus/Dispatcher";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { Queueable } from "Illuminate/Bus/Queueable";
import type { Repository as Cache } from "Illuminate/Cache/Repository";

/**
 * PHP: `Illuminate\Foundation\Bus\PendingDispatch`.
 *
 * What `Job::dispatch()` hands back so the call can be finished off --
 * `->onQueue('high')->delay(30)`. PHP sends the job from `__destruct()`, once
 * the statement is over and nothing else can configure it.
 *
 * There are no destructors here, and the closest thing the platform has to
 * "when this statement is done" is `task.defer`: the job goes to the bus at the
 * end of the current resumption cycle, after every chained call has run. Where
 * the timing matters, `send()` dispatches at once and is safe to call twice.
 *
 * `afterResponse()` is not ported -- there is no response to come after.
 * Debounced jobs are not ported; unique ones are, and are checked here as PHP
 * checks them.
 */
export class PendingDispatch {
    /** Indicates the job has already gone to the bus. */
    protected dispatched = false;

    /** Create a new pending job dispatch. */
    public constructor(protected readonly job: Queueable) {
        task.defer(() => this.send());
    }

    /** Set the desired connection for the job. */
    public onConnection(connection?: string): this {
        this.job.onConnection(connection);

        return this;
    }

    /** Set the desired queue for the job. */
    public onQueue(queue?: string): this {
        this.job.onQueue(queue);

        return this;
    }

    /** Set the desired connection for the chain. */
    public allOnConnection(connection?: string): this {
        this.job.allOnConnection(connection);

        return this;
    }

    /** Set the desired queue for the chain. */
    public allOnQueue(queue?: string): this {
        this.job.allOnQueue(queue);

        return this;
    }

    /** Set the desired delay in seconds for the job. */
    public delay(delay?: Delay): this {
        this.job.delay(delay);

        return this;
    }

    /** Set the delay for the job to zero seconds. */
    public withoutDelay(): this {
        this.job.withoutDelay();

        return this;
    }

    /** Set the jobs that should run if this job is successful. */
    public chain(chain: Array<object>): this {
        this.job.chain(chain);

        return this;
    }

    /** Get the underlying job instance. */
    public getJob(): Queueable {
        return this.job;
    }

    /**
     * Determine if the job should be dispatched.
     *
     * A job marked `ShouldBeUnique` only goes out when it can take the lock;
     * the handler releases it once the job has run.
     */
    protected shouldDispatch(): boolean {
        if (!isShouldBeUnique(this.job)) {
            return true;
        }

        const container = Container.getInstance();

        if (!container.bound("cache.store")) {
            return true;
        }

        return new UniqueLock(container.make<Cache>("cache.store")).acquire(
            this.job,
        );
    }

    /** Hand the job to the bus, now rather than at the end of the cycle. */
    public send(): unknown {
        if (this.dispatched) {
            return undefined;
        }

        this.dispatched = true;

        if (!this.shouldDispatch()) {
            return undefined;
        }

        return Container.getInstance()
            .make<Dispatcher>(Dispatcher)
            .dispatch(this.job);
    }
}
