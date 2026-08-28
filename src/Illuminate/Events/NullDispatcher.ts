import type { Dispatcher as DispatcherContract, EventName, Listener } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Abstract } from 'Illuminate/Container/Types';

/**
 * PHP: `Illuminate\Events\NullDispatcher`.
 *
 * Wraps a real dispatcher and swallows everything that would fire a listener,
 * while registration and inspection still pass through. `Event::fake()` uses
 * this shape to silence a slice of the application.
 *
 * PHP forwards anything else to the wrapped dispatcher through `__call` and the
 * `ForwardsCalls` trait; Luau has no `__call`, so `getDispatcher()` hands the
 * wrapped instance over instead.
 */
export class NullDispatcher implements DispatcherContract
{
    /** Create a new event dispatcher that does not fire listeners. */
    public constructor(protected readonly dispatcher: DispatcherContract)
    {}

    /* eslint-disable @typescript-eslint/no-unused-vars -- ignoring the
       arguments is the whole point of these three. */

    /** Do not fire an event. */
    public dispatch(event: EventName | object, payload?: unknown, halt?: boolean): unknown
    {
        return undefined;
    }

    /** Do not register an event and payload to be fired later. */
    public push(event: string, payload?: unknown): void
    {
        //
    }

    /** Do not fire an event until the first non-null response is returned. */
    public until(event: EventName | object, payload?: unknown): unknown
    {
        return undefined;
    }

    /* eslint-enable @typescript-eslint/no-unused-vars */

    /** Register an event listener with the dispatcher. */
    public listen(events: EventName | Array<EventName>, listener: Listener): void
    {
        this.dispatcher.listen(events, listener);
    }

    /** Determine if a given event has listeners. */
    public hasListeners(eventName: EventName): boolean
    {
        return this.dispatcher.hasListeners(eventName);
    }

    /** Register an event subscriber with the dispatcher. */
    public subscribe(subscriber: object | Abstract): void
    {
        this.dispatcher.subscribe(subscriber);
    }

    /** Flush a set of pushed events. */
    public flush(event: string): void
    {
        this.dispatcher.flush(event);
    }

    /** Remove a set of listeners from the dispatcher. */
    public forget(event: EventName): void
    {
        this.dispatcher.forget(event);
    }

    /** Forget all of the queued listeners. */
    public forgetPushed(): void
    {
        this.dispatcher.forgetPushed();
    }

    /** Get the dispatcher being wrapped. */
    public getDispatcher(): DispatcherContract
    {
        return this.dispatcher;
    }
}
