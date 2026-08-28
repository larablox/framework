import type { Abstract } from 'Illuminate/Container/Types';

/**
 * PHP: `string|object $event`. An event is named either by a plain string or by
 * the class of the dispatched event object.
 */
export type EventName = Abstract;

/** The arguments handed to a listener. */
export type EventPayload = Array<defined>;

/**
 * PHP: `\Closure|string|array $listener`. Either a callable, a `[class, method]`
 * pair resolved through the container, a `[instance, method]` pair invoked as
 * is, or a class whose `handle` method is called.
 */
export type Listener = Callback | [Abstract, string] | [object, string] | Abstract;

export interface Dispatcher
{
    /** Register an event listener with the dispatcher. */
    listen(events: EventName | Array<EventName>, listener: Listener): void;

    /** Determine if a given event has listeners. */
    hasListeners(eventName: EventName): boolean;

    /** Register an event subscriber with the dispatcher. */
    subscribe(subscriber: object | Abstract): void;

    /** Dispatch an event until the first non-null response is returned. */
    until(event: EventName | object, payload?: unknown): unknown;

    /** Dispatch an event and call the listeners. */
    dispatch(event: EventName | object, payload?: unknown, halt?: boolean): unknown;

    /** Register an event and payload to be fired later. */
    push(event: string, payload?: unknown): void;

    /** Flush a set of pushed events. */
    flush(event: string): void;

    /** Remove a set of listeners from the dispatcher. */
    forget(event: EventName): void;

    /** Forget all of the queued listeners. */
    forgetPushed(): void;
}
