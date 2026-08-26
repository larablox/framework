import { Backoff } from "Illuminate/Queue/Attributes/Backoff";
import { CallQueuedListener } from "Illuminate/Events/CallQueuedListener";
import { Connection } from "Illuminate/Queue/Attributes/Connection";
import { Delay } from "Illuminate/Queue/Attributes/Delay";
import { DeleteWhenMissingModels } from "Illuminate/Queue/Attributes/DeleteWhenMissingModels";
import { FailOnTimeout } from "Illuminate/Queue/Attributes/FailOnTimeout";
import { MaxExceptions } from "Illuminate/Queue/Attributes/MaxExceptions";
import { Queue as QueueAttribute } from "Illuminate/Queue/Attributes/Queue";
import { ReadsClassAttributes } from "Illuminate/Support/Traits/ReadsClassAttributes";
import { RuntimeException } from "Illuminate/Exception";
import { Timeout } from "Illuminate/Queue/Attributes/Timeout";
import { Tries } from "Illuminate/Queue/Attributes/Tries";
import { isShouldQueue } from "Illuminate/Contracts/Queue/ShouldQueue";
import type { Delay as DelayValue } from "Illuminate/Support/InteractsWithTime";
import type { Factory as QueueFactory } from "Illuminate/Contracts/Queue/Factory";
import { BindingResolutionException } from "Illuminate/Contracts/Container/BindingResolutionException";
import { Container } from "Illuminate/Container/Container";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { Reflector } from "Illuminate/Support/Reflector";
import { Str } from "Illuminate/Support/Str";
import { Util } from "Illuminate/Container/Util";
import type { Abstract } from "Illuminate/Container/Types";
import type { Container as ContainerContract } from "Illuminate/Contracts/Container/Container";
import type {
    Dispatcher as DispatcherContract,
    EventName,
    EventPayload,
    Listener,
} from "Illuminate/Contracts/Events/Dispatcher";

/** One dispatch held back while `defer()` runs. */
interface DeferredEvent {
    readonly event: EventName | object;
    readonly payload?: unknown;
    readonly halt: boolean;
}

/**
 * PHP: `Illuminate\Events\Dispatcher`.
 *
 * Broadcasting and database-transaction awareness are not ported: neither
 * subsystem exists. A listener registered against an event's *interfaces* is
 * gone with the interfaces themselves; the port walks the event's class chain
 * instead.
 *
 * A listener class marked `ShouldQueue` is not called but queued, as a
 * `CallQueuedListener` job. `queueable()` and `QueuedClosure` stay out: they
 * queue a closure, and a closure does not serialize.
 */
export class Dispatcher implements DispatcherContract {
    /** The IoC container instance. */
    protected readonly container: ContainerContract;

    /** The registered event listeners. */
    protected listeners = new OrderedMap<EventName, Array<Listener>>();

    /** The wildcard listeners. */
    protected wildcards = new OrderedMap<string, Array<Listener>>();

    /** The cached wildcard listeners. */
    protected wildcardsCache = new Map<string, Array<Callback>>();

    /** The currently deferred events. */
    protected deferredEvents = new Array<DeferredEvent>();

    /** Indicates if events should be deferred. */
    protected deferringEvents = false;

    /** The specific events to defer; undefined means defer all of them. */
    protected eventsToDefer?: Array<EventName>;

    /** The queue resolver instance. */
    protected queueResolver?: () => QueueFactory;

    /** Create a new event dispatcher instance. */
    public constructor(container?: ContainerContract) {
        this.container = container ?? new Container();
    }

    /**
     * Register an event listener with the dispatcher.
     *
     * PHP additionally accepts a closure alone and derives the event from its
     * first parameter's type; parameter types do not survive compilation, so the
     * event must always be named.
     */
    public listen(
        events: EventName | Array<EventName>,
        listener: Listener,
    ): void {
        for (const event of Util.arrayWrap(events)) {
            if (typeIs(event, "string") && Str.contains(event, "*")) {
                this.setupWildcardListen(event, listener);
            } else {
                let registered = this.listeners.get(event);

                if (registered === undefined) {
                    registered = new Array<Listener>();
                    this.listeners.set(event, registered);
                }

                registered.push(listener);
            }
        }
    }

    /** Setup a wildcard listener callback. */
    protected setupWildcardListen(event: string, listener: Listener): void {
        let registered = this.wildcards.get(event);

        if (registered === undefined) {
            registered = new Array<Listener>();
            this.wildcards.set(event, registered);
        }

        registered.push(listener);

        this.wildcardsCache.clear();
    }

    /** Determine if a given event has listeners. */
    public hasListeners(eventName: EventName): boolean {
        if (this.listeners.has(eventName)) {
            return true;
        }

        if (typeIs(eventName, "string")) {
            return (
                this.wildcards.has(eventName) ||
                this.hasWildcardListeners(eventName)
            );
        }

        return false;
    }

    /** Determine if the given event has any wildcard listeners. */
    public hasWildcardListeners(eventName: string): boolean {
        for (const key of this.wildcards.keys()) {
            if (Str.is(key, eventName)) {
                return true;
            }
        }

        return false;
    }

    /** Register an event and payload to be fired later. */
    public push(event: string, payload?: unknown): void {
        this.listen(`${event}_pushed`, () => {
            this.dispatch(event, payload);
        });
    }

    /** Flush a set of pushed events. */
    public flush(event: string): void {
        this.dispatch(`${event}_pushed`);
    }

    /** Register an event subscriber with the dispatcher. */
    public subscribe(subscriber: object | Abstract): void {
        const resolved = this.resolveSubscriber(subscriber);

        const subscribe = (resolved as unknown as Record<string, unknown>)
            .subscribe;

        if (!typeIs(subscribe, "function")) {
            throw new BindingResolutionException(
                `Subscriber [${Reflector.className(Reflector.classOf(resolved))}] has no subscribe method.`,
            );
        }

        const events = (subscribe as Callback)(resolved, this) as
            Array<[EventName, Listener | Array<Listener>]> | undefined;

        // PHP wraps the loop below in `if (is_array($events))`, so a
        // `subscribe()` that registers its listeners itself and hands back
        // something else -- or nothing -- is not an error.
        if (!typeIs(events, "table")) {
            return;
        }

        for (const [event, listeners] of events) {
            for (const listener of Util.arrayWrap(listeners)) {
                if (
                    typeIs(listener, "string") &&
                    typeIs(
                        (resolved as Record<string, unknown>)[listener],
                        "function",
                    )
                ) {
                    this.listen(event, [
                        Reflector.classOf(resolved) as Abstract,
                        listener,
                    ]);

                    continue;
                }

                this.listen(event, listener);
            }
        }
    }

    /** Resolve the subscriber instance. */
    protected resolveSubscriber(subscriber: object | Abstract): object {
        if (!Reflector.isInstance(subscriber)) {
            return this.container.make(subscriber as Abstract) as object;
        }

        return subscriber as object;
    }

    /** Fire an event until the first non-null response is returned. */
    public until(event: EventName | object, payload?: unknown): unknown {
        return this.dispatch(event, payload, true);
    }

    /** Fire an event and call the listeners. */
    public dispatch(
        event: EventName | object,
        payload?: unknown,
        halt = false,
    ): unknown {
        // When the given "event" is actually an object, we will assume it is an event
        // object, and use the class as the event name and this event itself as the
        // payload to the handler, which makes object-based events quite simple.
        const [parsedEvent, parsedPayload] = this.parseEventAndPayload(
            event,
            payload,
        );

        if (this.shouldDeferEvent(parsedEvent)) {
            this.deferredEvents.push({ event, payload, halt });

            return undefined;
        }

        return this.invokeListeners(parsedEvent, parsedPayload, halt);
    }

    /**
     * Call the listeners for an event.
     *
     * A listener returning nothing contributes no entry to the response list: a
     * Luau array cannot hold nil, so PHP's null placeholders are dropped.
     */
    protected invokeListeners(
        event: EventName,
        payload: EventPayload,
        halt = false,
    ): unknown {
        const responses = new Array<defined>();

        for (const listener of this.getListeners(event)) {
            const response = listener(event, payload) as unknown;

            // If a response is returned from the listener and event halting is enabled
            // we will just return this response, and not call the rest of the event
            // listeners. Otherwise we will add the response on the response list.
            if (halt && response !== undefined) {
                return response;
            }

            // If a boolean false is returned from a listener, we will stop propagating
            // the event to any further listeners down in the chain, else we keep on
            // looping through the listeners and firing every one in our sequence.
            if (response === false) {
                break;
            }

            if (response !== undefined) {
                responses.push(response as defined);
            }
        }

        return halt ? undefined : responses;
    }

    /** Parse the given event and payload and prepare them for dispatching. */
    protected parseEventAndPayload(
        event: EventName | object,
        payload: unknown,
    ): [EventName, EventPayload] {
        if (Reflector.isInstance(event)) {
            return [
                Reflector.classOf(event as object) as EventName,
                [event as defined],
            ];
        }

        return [
            event as EventName,
            Util.arrayWrap(payload as defined | Array<defined> | undefined),
        ];
    }

    /** Get all of the listeners for a given event name. */
    public getListeners(eventName: EventName): Array<Callback> {
        const listeners = this.prepareListeners(eventName);

        // A class event has no namespace to match on, so a wildcard is tested
        // against its bare name.
        const name = typeIs(eventName, "string")
            ? eventName
            : Reflector.className(eventName);

        const wildcards =
            this.wildcardsCache.get(name) ?? this.getWildcardListeners(name);

        for (const wildcard of wildcards) {
            listeners.push(wildcard);
        }

        return typeIs(eventName, "string")
            ? listeners
            : this.addInterfaceListeners(eventName, listeners);
    }

    /** Get the wildcard listeners for the event. */
    protected getWildcardListeners(eventName: string): Array<Callback> {
        const wildcards = new Array<Callback>();

        for (const [key, listeners] of this.wildcards.entries()) {
            if (Str.is(key, eventName)) {
                for (const listener of listeners) {
                    wildcards.push(this.makeListener(listener, true));
                }
            }
        }

        this.wildcardsCache.set(eventName, wildcards);

        return wildcards;
    }

    /** Prepare the listeners for a given event. */
    protected prepareListeners(eventName: EventName): Array<Callback> {
        const listeners = new Array<Callback>();

        for (const listener of this.listeners.get(eventName) ?? []) {
            listeners.push(this.makeListener(listener));
        }

        return listeners;
    }

    /** Register an event listener with the dispatcher. */
    public makeListener(listener: Listener, wildcard = false): Callback {
        if (
            !typeIs(listener, "function") &&
            !this.isInstanceCallable(listener)
        ) {
            return this.createClassListener(
                listener as Abstract | [Abstract, string],
                wildcard,
            );
        }

        const callable = this.toCallable(
            listener as Callback | [object, string],
        );

        return (event: EventName, payload: EventPayload) =>
            wildcard
                ? callable(event, payload)
                : callable(...(payload as Array<never>));
    }

    /** Create a class based listener using the IoC container. */
    public createClassListener(
        listener: Abstract | [Abstract, string],
        wildcard = false,
    ): Callback {
        return (event: EventName, payload: EventPayload) => {
            const callable = this.createClassCallable(listener);

            return wildcard
                ? callable(event, payload)
                : callable(...(payload as Array<never>));
        };
    }

    /**
     * Create the class based event callable.
     *
     * PHP falls back to `__invoke` when the named method is missing; Luau has no
     * callable objects, so a missing handler is an error.
     */
    protected createClassCallable(
        listener: Abstract | [Abstract, string],
    ): Callback {
        const [klass, method] = Util.isArray(listener)
            ? (listener as [Abstract, string])
            : this.parseClassCallable(listener as Abstract);

        // PHP asks `ReflectionClass::implementsInterface(ShouldQueue)`, which
        // needs nothing but the class name. An interface leaves no runtime
        // trace here, so a string abstract has to be resolved before there is
        // anything to ask -- and the resolved object is then reused for the
        // call rather than resolved a second time, which the container would
        // otherwise report as two `make()`s for one dispatch.
        const resolved = typeIs(klass, "string")
            ? this.container.make(klass)
            : undefined;

        if (this.handlerShouldBeQueued(resolved ?? klass)) {
            return this.createQueuedHandlerCallable(klass, method);
        }

        const instance = (resolved ?? this.container.make(klass)) as Record<
            string,
            unknown
        >;

        return this.toCallable([instance as unknown as object, method]);
    }

    /** Determine if the event handler class should be queued. */
    protected handlerShouldBeQueued(handler: unknown): boolean {
        return isShouldQueue(handler);
    }

    /** Create a callable for putting an event handler on the queue. */
    protected createQueuedHandlerCallable(
        klass: Abstract,
        method: string,
    ): Callback {
        return (...args: Array<unknown>) => {
            if (this.handlerWantsToBeQueued(klass, args)) {
                this.queueHandler(klass, method, args);
            }
        };
    }

    /** Determine if the event handler wants to be queued. */
    protected handlerWantsToBeQueued(
        klass: Abstract,
        args: Array<unknown>,
    ): boolean {
        const instance = this.container.make(klass) as Record<string, unknown>;

        const shouldQueue = instance.shouldQueue;

        if (typeIs(shouldQueue, "function")) {
            return (shouldQueue as (self: object, event: unknown) => boolean)(
                instance as unknown as object,
                args[0],
            );
        }

        return true;
    }

    /** Queue the handler class. */
    protected queueHandler(
        klass: Abstract,
        method: string,
        args: Array<unknown>,
    ): void {
        const [listener, job] = this.createListenerAndJob(klass, method, args);

        const connection = this.resolveQueue().connection(
            this.optionFor(
                listener,
                args,
                "viaConnection",
                Connection,
                "connection",
            ) as string | undefined,
        );

        const queue = this.optionFor(
            listener,
            args,
            "viaQueue",
            QueueAttribute,
            "queue",
        ) as string | undefined;

        const delay = this.optionFor(
            listener,
            args,
            "withDelay",
            Delay,
            "delaySeconds",
        ) as DelayValue | undefined;

        if (delay === undefined) {
            connection.pushOn(queue as string, job);
        } else {
            connection.laterOn(queue as string, delay, job);
        }
    }

    /**
     * Read one queueing option off the listener.
     *
     * PHP asks whether the listener declares `viaQueue()` and falls back to the
     * matching attribute; both spellings are kept.
     */
    protected optionFor(
        listener: object,
        args: Array<unknown>,
        method: string,
        attribute: Callback,
        property: string,
    ): unknown {
        const declared = (listener as Record<string, unknown>)[method];

        if (typeIs(declared, "function")) {
            return (declared as (self: object, event: unknown) => unknown)(
                listener,
                args[0],
            );
        }

        return ReadsClassAttributes.getAttributeValue(
            listener,
            attribute,
            property,
        );
    }

    /**
     * Create the listener and job for a queued listener.
     *
     * PHP builds the listener with `newInstanceWithoutConstructor()`: it exists
     * only to be asked about its options, never to run, and PHP keeps declared
     * property defaults without running a constructor. roblox-ts compiles those
     * defaults *into* the constructor, so a listener built without one would
     * report none of them -- and `tries = 5` on the class is exactly how one is
     * usually written. The container builds it instead, which is what
     * `handlerWantsToBeQueued()` already does a moment earlier.
     */
    protected createListenerAndJob(
        klass: Abstract,
        method: string,
        args: Array<unknown>,
    ): [object, CallQueuedListener] {
        const listener = this.container.make(klass) as object;

        return [
            listener,
            this.propagateListenerOptions(
                listener,
                new CallQueuedListener(klass, method, args as EventPayload),
            ),
        ];
    }

    /**
     * Copy the listener's options onto the job that carries it.
     *
     * The uniqueness, deduplication and message-group options PHP also copies
     * want the cache and SQS.
     */
    protected propagateListenerOptions(
        listener: object,
        job: CallQueuedListener,
    ): CallQueuedListener {
        const read = (attribute: Callback, property: string): unknown =>
            ReadsClassAttributes.getAttributeValue(
                listener,
                attribute,
                property,
            );

        const method = (name: string): unknown => {
            const declared = (listener as Record<string, unknown>)[name];

            return typeIs(declared, "function")
                ? (
                      declared as (
                          self: object,
                          ...data: Array<never>
                      ) => unknown
                  )(listener, ...(job.data as Array<never>))
                : undefined;
        };

        job.tries = (method("tries") ?? read(Tries, "tries")) as
            number | undefined;

        job.backoff = (method("backoff") ?? read(Backoff, "backoff")) as
            number | Array<number> | undefined;

        job.maxExceptions = read(MaxExceptions, "maxExceptions") as
            number | undefined;

        job.retryUntil = method("retryUntil") as number | undefined;

        job.timeout = read(Timeout, "timeout") as number | undefined;

        job.failOnTimeout =
            (read(FailOnTimeout, "failOnTimeout") as boolean | undefined) ??
            false;

        job.deleteWhenMissingModels =
            (read(DeleteWhenMissingModels, "deleteWhenMissingModels") as
                boolean | undefined) ?? false;

        const middleware = method("middleware");

        if (middleware !== undefined) {
            job.through(middleware as Array<unknown>);
        }

        return job;
    }

    /** Resolve the queue implementation. */
    protected resolveQueue(): QueueFactory {
        if (this.queueResolver === undefined) {
            throw new RuntimeException(
                "The queue resolver has not been set on the event dispatcher.",
            );
        }

        return this.queueResolver();
    }

    /** Set the queue resolver implementation. */
    public setQueueResolver(resolver: () => QueueFactory): this {
        this.queueResolver = resolver;

        return this;
    }

    /** Parse the class listener into class and method. */
    protected parseClassCallable(listener: Abstract): [Abstract, string] {
        if (typeIs(listener, "string")) {
            const [target, method] = Str.parseCallback(listener, "handle");

            return [target, method as string];
        }

        return [listener, "handle"];
    }

    /** Determine if the listener is an already resolved `[instance, method]` pair. */
    protected isInstanceCallable(listener: Listener): boolean {
        return (
            Util.isArray(listener) &&
            Reflector.isInstance((listener as [unknown, string])[0])
        );
    }

    /** Turn a callable listener into a plain function. */
    protected toCallable(listener: Callback | [object, string]): Callback {
        if (typeIs(listener, "function")) {
            return listener;
        }

        const [target, method] = listener;
        const fn = (target as unknown as Record<string, unknown>)[method];

        if (!typeIs(fn, "function")) {
            throw new BindingResolutionException(
                `Method [${method}] does not exist on [${Reflector.className(Reflector.classOf(target))}].`,
            );
        }

        return (...args: Array<never>) => (fn as Callback)(target, ...args);
    }

    /** Remove a set of listeners from the dispatcher. */
    public forget(event: EventName): void {
        if (typeIs(event, "string") && Str.contains(event, "*")) {
            this.wildcards.delete(event);
        } else {
            this.listeners.delete(event);
        }

        if (typeIs(event, "string")) {
            for (const [key] of this.wildcardsCache) {
                if (Str.is(event, key)) {
                    this.wildcardsCache.delete(key);
                }
            }
        }
    }

    /** Forget all of the pushed listeners. */
    public forgetPushed(): void {
        for (const key of this.listeners.keys()) {
            if (typeIs(key, "string") && Str.endsWith(key, "_pushed")) {
                this.forget(key);
            }
        }
    }

    /**
     * Add the listeners registered for the event's interfaces.
     *
     * PHP walks `class_implements()`. Interfaces are erased here, so the port
     * walks the class hierarchy instead -- the runtime relationship that does
     * survive. A listener registered on a base event class therefore also runs
     * for its subclasses, which is the shape Laravel gets from interfaces.
     */
    protected addInterfaceListeners(
        eventName: EventName,
        listeners: Array<Callback>,
    ): Array<Callback> {
        if (!typeIs(eventName, "table")) {
            return listeners;
        }

        let current = Reflector.parentClass(eventName as object);

        while (current !== undefined) {
            for (const listener of this.prepareListeners(
                current as EventName,
            )) {
                listeners.push(listener);
            }

            current = Reflector.parentClass(current);
        }

        return listeners;
    }

    /**
     * Hold back the events dispatched while the callback runs, then send them.
     *
     * Passing a list of event names defers only those.
     */
    public defer<T>(callback: () => T, events?: Array<EventName>): T {
        const wasDeferring = this.deferringEvents;
        const previousDeferred = this.deferredEvents;
        const previousToDefer = this.eventsToDefer;

        this.deferringEvents = true;
        this.deferredEvents = new Array<DeferredEvent>();
        this.eventsToDefer = events;

        try {
            const result = callback();

            this.deferringEvents = false;

            for (const deferred of this.deferredEvents) {
                this.dispatch(deferred.event, deferred.payload, deferred.halt);
            }

            return result;
        } finally {
            this.deferringEvents = wasDeferring;
            this.deferredEvents = previousDeferred;
            this.eventsToDefer = previousToDefer;
        }
    }

    /** Determine if the given event should be held back for now. */
    protected shouldDeferEvent(event: EventName): boolean {
        return (
            this.deferringEvents &&
            (this.eventsToDefer === undefined ||
                this.eventsToDefer.includes(event))
        );
    }

    /** Gets the raw, unprepared listeners. */
    public getRawListeners(): Array<[EventName, Array<Listener>]> {
        return this.listeners.entries();
    }
}
