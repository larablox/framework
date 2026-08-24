import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Bus/Dispatcher";
import { PendingChain } from "Illuminate/Foundation/Bus/PendingChain";
import { PendingDispatch } from "Illuminate/Foundation/Bus/PendingDispatch";
import { Batchable } from "Illuminate/Bus/Batchable";
import { Queueable } from "Illuminate/Bus/Queueable";

/**
 * The job class as its own statics see it.
 *
 * PHP writes `new static(...$arguments)` and lets the runtime sort it out. The
 * `this` parameter is how TypeScript says the same thing: it carries the
 * constructor of whichever subclass the static was called on, so the arguments
 * are checked against *that* constructor.
 */
type JobClass<T extends Queueable, A extends Array<unknown>> = new (
    ...args: A
) => T;

/**
 * PHP: `Illuminate\Foundation\Bus\Dispatchable`.
 *
 * The trait that gives a job its `dispatch()` static. PHP mixes it into a job
 * beside `Batchable`, `Queueable` and `InteractsWithQueue`; with one inheritance
 * chain those become one base class, so a job written here reads:
 *
 * ```ts
 * @ShouldQueue()
 * export class SendWelcome extends Dispatchable {
 *     public constructor(private readonly userId: number) { super(); }
 *
 *     public handle(): void {}
 * }
 *
 * SendWelcome.dispatch(userId).onQueue("high");
 * ```
 *
 * `dispatchAfterResponse()` is not ported: there is no response.
 */
export abstract class Dispatchable extends Batchable {
    /** Dispatch the job with the given arguments. */
    public static dispatch<T extends Queueable, A extends Array<unknown>>(
        this: JobClass<T, A>,
        ...args: A
    ): PendingDispatch {
        return new PendingDispatch(new this(...args));
    }

    /** Dispatch the job with the given arguments if the given truth test passes. */
    public static dispatchIf<T extends Queueable, A extends Array<unknown>>(
        this: JobClass<T, A>,
        condition: boolean,
        ...args: A
    ): PendingDispatch | undefined {
        return condition ? new PendingDispatch(new this(...args)) : undefined;
    }

    /** Dispatch the job with the given arguments unless the given truth test passes. */
    public static dispatchUnless<T extends Queueable, A extends Array<unknown>>(
        this: JobClass<T, A>,
        condition: boolean,
        ...args: A
    ): PendingDispatch | undefined {
        return condition ? undefined : new PendingDispatch(new this(...args));
    }

    /** Dispatch a command to its appropriate handler in the current process. */
    public static dispatchSync<T extends Queueable, A extends Array<unknown>>(
        this: JobClass<T, A>,
        ...args: A
    ): unknown {
        return Container.getInstance()
            .make<Dispatcher>(Dispatcher)
            .dispatchSync(new this(...args));
    }

    /** Set the jobs that should run if this job is successful. */
    public static withChain<T extends Queueable, A extends Array<unknown>>(
        this: JobClass<T, A>,
        chain: Array<object>,
    ): PendingChain<T, A> {
        return new PendingChain(this, chain);
    }
}
