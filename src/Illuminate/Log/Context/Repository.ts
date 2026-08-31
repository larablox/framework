import { ContextDehydrating } from 'Illuminate/Log/Context/Events/ContextDehydrating';
import { ContextHydrated } from 'Illuminate/Log/Context/Events/ContextHydrated';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { RuntimeException } from 'Illuminate/Exception';
import { Util } from 'Illuminate/Container/Util';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';

/** The shape a repository dehydrates into. */
export interface ContextSnapshot
{
    data: Record<string, unknown>;
    hidden: Record<string, unknown>;
}

/**
 * PHP: `Illuminate\Log\Context\Repository`.
 *
 * Two sets of values: `data`, which the log processor attaches to every record,
 * and `hidden`, which it does not.
 *
 * PHP's `dehydrate()` / `hydrate()` serialize the repository into a queue
 * payload and restore it in the worker. There are no queues here, so they take
 * and return a plain snapshot -- useful for carrying context across a
 * `task.spawn` or into a remote handler -- and fire the same events.
 * `SerializesModels`, `Macroable` and `Conditionable` are not ported.
 */
export class Repository
{
    /** The contextual data. */
    protected data: Record<string, unknown> = {};

    /** The hidden contextual data. */
    protected hidden: Record<string, unknown> = {};

    /** Create a new Context instance. */
    public constructor(@Inject('events') protected readonly events: Dispatcher)
    {}

    /** Determine if the given key exists. */
    public has(key: string): boolean
    {
        return this.data[key] !== undefined;
    }

    /** Determine if the given key is missing. */
    public missing(key: string): boolean
    {
        return !this.has(key);
    }

    /** Determine if the given key exists within the hidden context data. */
    public hasHidden(key: string): boolean
    {
        return this.hidden[key] !== undefined;
    }

    /** Determine if the given key is missing within the hidden context data. */
    public missingHidden(key: string): boolean
    {
        return !this.hasHidden(key);
    }

    /** Retrieve all the context data. */
    public all(): Record<string, unknown>
    {
        return this.data;
    }

    /** Retrieve all the hidden context data. */
    public allHidden(): Record<string, unknown>
    {
        return this.hidden;
    }

    /** Retrieve the given key's value. */
    public get(key: string, defaultValue?: unknown): unknown
    {
        return this.data[key] ?? defaultValue;
    }

    /** Retrieve the given key's hidden value. */
    public getHidden(key: string, defaultValue?: unknown): unknown
    {
        return this.hidden[key] ?? defaultValue;
    }

    /** Retrieve the given key's value and then forget it. */
    public pull(key: string, defaultValue?: unknown): unknown
    {
        const value = this.get(key, defaultValue);

        this.forget(key);

        return value;
    }

    /** Retrieve the given key's hidden value and then forget it. */
    public pullHidden(key: string, defaultValue?: unknown): unknown
    {
        const value = this.getHidden(key, defaultValue);

        this.forgetHidden(key);

        return value;
    }

    /** Retrieve only the values of the given keys. */
    public only(keys: Array<string>): Record<string, unknown>
    {
        return Repository.subset(this.data, keys, true);
    }

    /** Retrieve only the hidden values of the given keys. */
    public onlyHidden(keys: Array<string>): Record<string, unknown>
    {
        return Repository.subset(this.hidden, keys, true);
    }

    /** Retrieve all values except the given keys. */
    public except(keys: Array<string>): Record<string, unknown>
    {
        return Repository.subset(this.data, keys, false);
    }

    /** Retrieve all hidden values except the given keys. */
    public exceptHidden(keys: Array<string>): Record<string, unknown>
    {
        return Repository.subset(this.hidden, keys, false);
    }

    /** Add a context value. */
    public add(key: string | Record<string, unknown>, value?: unknown): this
    {
        if (typeIs(key, 'string')) {
            this.data[key] = value;

            return this;
        }

        for (const [name, item] of pairs(key as Record<string, unknown>)) {
            this.data[name as string] = item;
        }

        return this;
    }

    /** Add a hidden context value. */
    public addHidden(key: string | Record<string, unknown>, value?: unknown): this
    {
        if (typeIs(key, 'string')) {
            this.hidden[key] = value;

            return this;
        }

        for (const [name, item] of pairs(key as Record<string, unknown>)) {
            this.hidden[name as string] = item;
        }

        return this;
    }

    /** Add a context value if it does not exist yet. */
    public addIf(key: string, value: unknown): this
    {
        if (!this.has(key)) {
            this.add(key, value);
        }

        return this;
    }

    /** Add a hidden context value if it does not exist yet. */
    public addHiddenIf(key: string, value: unknown): this
    {
        if (!this.hasHidden(key)) {
            this.addHidden(key, value);
        }

        return this;
    }

    /** Get the value for the given key, adding it when it is missing. */
    public remember(key: string, value: unknown): unknown
    {
        if (this.has(key)) {
            return this.get(key);
        }

        const resolved = Util.unwrapIfClosure(value);

        this.add(key, resolved);

        return resolved;
    }

    /** Get the hidden value for the given key, adding it when it is missing. */
    public rememberHidden(key: string, value: unknown): unknown
    {
        if (this.hasHidden(key)) {
            return this.getHidden(key);
        }

        const resolved = Util.unwrapIfClosure(value);

        this.addHidden(key, resolved);

        return resolved;
    }

    /** Forget the given context key. */
    public forget(key: string | Array<string>): this
    {
        for (const name of Util.arrayWrap(key)) {
            delete this.data[name];
        }

        return this;
    }

    /** Forget the given hidden context key. */
    public forgetHidden(key: string | Array<string>): this
    {
        for (const name of Util.arrayWrap(key)) {
            delete this.hidden[name];
        }

        return this;
    }

    /** Push the given values onto the key's stack. */
    public push(key: string, ...values: Array<defined>): this
    {
        if (!this.isStackable(key)) {
            throw new RuntimeException(`Unable to push value onto context stack for key [${key}].`);
        }

        const stack = (this.data[key] ?? []) as Array<defined>;

        for (const value of values) {
            stack.push(value);
        }

        this.data[key] = stack;

        return this;
    }

    /** Pop the latest value from the key's stack. */
    public pop(key: string): unknown
    {
        const stack = this.data[key] as Array<defined> | undefined;

        if (!this.isStackable(key) || stack === undefined || stack.isEmpty()) {
            throw new RuntimeException(`Unable to pop value from context stack for key [${key}].`);
        }

        return stack.pop();
    }

    /** Push the given hidden values onto the key's stack. */
    public pushHidden(key: string, ...values: Array<defined>): this
    {
        if (!this.isHiddenStackable(key)) {
            throw new RuntimeException(`Unable to push value onto hidden context stack for key [${key}].`);
        }

        const stack = (this.hidden[key] ?? []) as Array<defined>;

        for (const value of values) {
            stack.push(value);
        }

        this.hidden[key] = stack;

        return this;
    }

    /** Pop the latest hidden value from the key's stack. */
    public popHidden(key: string): unknown
    {
        const stack = this.hidden[key] as Array<defined> | undefined;

        if (!this.isHiddenStackable(key) || stack === undefined || stack.isEmpty()) {
            throw new RuntimeException(`Unable to pop value from hidden context stack for key [${key}].`);
        }

        return stack.pop();
    }

    /** Increment a context counter. */
    public increment(key: string, amount = 1): this
    {
        return this.add(key, ((tonumber(this.get(key, 0)) ?? 0) as number) + amount);
    }

    /** Decrement a context counter. */
    public decrement(key: string, amount = 1): this
    {
        return this.increment(key, amount * -1);
    }

    /** Determine if the given key's stack contains the given value. */
    public stackContains(key: string, value: unknown): boolean
    {
        if (!this.isStackable(key)) {
            throw new RuntimeException(`Given key [${key}] is not a stack.`);
        }

        return Repository.stackHas(this.data[key] as Array<defined> | undefined, value);
    }

    /** Determine if the given key's hidden stack contains the given value. */
    public hiddenStackContains(key: string, value: unknown): boolean
    {
        if (!this.isHiddenStackable(key)) {
            throw new RuntimeException(`Given key [${key}] is not a stack.`);
        }

        return Repository.stackHas(this.hidden[key] as Array<defined> | undefined, value);
    }

    /** Determine if a key can be used as a stack. */
    protected isStackable(key: string): boolean
    {
        return !this.has(key) || Util.isArray(this.data[key]);
    }

    /** Determine if a hidden key can be used as a stack. */
    protected isHiddenStackable(key: string): boolean
    {
        return !this.hasHidden(key) || Util.isArray(this.hidden[key]);
    }

    /** Run the callback with the given context, restoring it afterwards. */
    public scope<T>(callback: () => T, data: Record<string, unknown> = {}, hidden: Record<string, unknown> = {}): T
    {
        const dataBefore = Repository.copy(this.data);
        const hiddenBefore = Repository.copy(this.hidden);

        this.add(data);
        this.addHidden(hidden);

        try {
            return callback();
        } finally {
            this.data = dataBefore;
            this.hidden = hiddenBefore;
        }
    }

    /** Determine if the repository holds nothing. */
    public isEmpty(): boolean
    {
        return next(this.data)[0] === undefined && next(this.hidden)[0] === undefined;
    }

    /** Register a callback to run when the context is dehydrating. */
    public dehydrating(callback: (context: Repository) => void): this
    {
        // PHP unwraps the event and hands the callback the repository itself,
        // not the event carrying it.
        this.events.listen(ContextDehydrating, (event: ContextDehydrating) => callback(event.context));

        return this;
    }

    /** Register a callback to run when the context has been hydrated. */
    public hydrated(callback: (context: Repository) => void): this
    {
        this.events.listen(ContextHydrated, (event: ContextHydrated) => callback(event.context));

        return this;
    }

    /** Flush all context data. */
    public flush(): this
    {
        this.data = {};
        this.hidden = {};

        return this;
    }

    /**
     * Take a snapshot of the repository.
     *
     * PHP serializes into a queue payload; without queues, the snapshot is the
     * payload -- hand it to another coroutine or across a remote yourself.
     */
    public dehydrate(): ContextSnapshot | undefined
    {
        // PHP dispatches with a *fresh* repository carrying a copy of this
        // one's values, so a listener that writes to it changes the snapshot
        // and leaves the live repository alone.
        const instance = new Repository(this.events);

        instance.add(Repository.copy(this.data)).addHidden(Repository.copy(this.hidden));

        this.events.dispatch(new ContextDehydrating(instance));

        if (instance.isEmpty()) {
            return undefined;
        }

        return {
            data: Repository.copy(instance.data),
            hidden: Repository.copy(instance.hidden),
        };
    }

    /** Restore the repository from a snapshot. */
    public hydrate(snapshot?: ContextSnapshot): this
    {
        this.flush();

        if (snapshot !== undefined) {
            this.add(snapshot.data);
            this.addHidden(snapshot.hidden);
        }

        this.events.dispatch(new ContextHydrated(this));

        return this;
    }

    /** A shallow copy of the given bag. */
    protected static copy(bag: Record<string, unknown>): Record<string, unknown>
    {
        const copied: Record<string, unknown> = {};

        for (const [key, value] of pairs(bag)) {
            copied[key as string] = value;
        }

        return copied;
    }

    /** Keep, or drop, the given keys. */
    protected static subset(bag: Record<string, unknown>, keys: Array<string>, keep: boolean): Record<string, unknown>
    {
        const result: Record<string, unknown> = {};

        for (const [key, value] of pairs(bag)) {
            // Parenthesised on purpose: `includes()` compiles to
            // `table.find(...) ~= nil`, and `a ~= nil == b` makes luau-lsp
            // ask whether the chain was meant.
            const has = keys.includes(key as string);

            if (has === keep) {
                result[key as string] = value;
            }
        }

        return result;
    }

    /** Determine if the stack holds the value, or matches the predicate. */
    protected static stackHas(stack: Array<defined> | undefined, value: unknown): boolean
    {
        if (stack === undefined) {
            return false;
        }

        for (const item of stack) {
            const matches = typeIs(value, 'function')
                ? ((value as (item: defined) => boolean)(item) as boolean)
                : item === value;

            if (matches) {
                return true;
            }
        }

        return false;
    }
}
