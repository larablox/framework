/**
 * PHP's bare `if ($value)` also coerces 0, '', '0' and [] to false; only the
 * scalar cases are handled here -- an empty Array/Map/OrderedMap reads as
 * truthy, unlike PHP.
 */
export function truthy(value: unknown): boolean
{
    return value !== undefined && value !== false && value !== 0 && value !== '' && value !== '0';
}

export class HigherOrderWhenProxy<T extends object>
{
    /** The target being conditionally operated on. */
    protected target: T;

    /** The condition for proxying. */
    protected _condition?: unknown;

    /** Indicates whether the proxy has a condition. */
    protected hasCondition = false;

    /** Determine whether the condition should be negated. */
    protected _negateConditionOnCapture?: boolean;

    /** Create a new proxy instance. */
    public constructor(target: T)
    {
        this.target = target;
    }

    /** Set the condition on the proxy. */
    public condition(condition: unknown): this
    {
        [this._condition, this.hasCondition] = [condition, true];

        return this;
    }

    /** Indicate that the condition should be negated. */
    public negateConditionOnCapture(): this
    {
        this._negateConditionOnCapture = true;

        return this;
    }

    /** Proxy accessing an attribute onto the target. */
    public __get(key: string): unknown
    {
        if (!this.hasCondition) {
            const condition = (this.target as unknown as Record<string, unknown>)[key];

            return this.condition(this._negateConditionOnCapture ? !truthy(condition) : condition);
        }

        return truthy(this._condition)
            ? (this.target as unknown as Record<string, unknown>)[key]
            : this.target;
    }

    /** Proxy a method call on the target. */
    public ___call(method: string, parameters: unknown[]): unknown
    {
        if (!this.hasCondition) {
            const condition = ((this.target as unknown as Record<string, unknown>)[method] as (...args: unknown[]) => unknown)(this.target, ...parameters);

            return this.condition(this._negateConditionOnCapture ? !truthy(condition) : condition);
        }

        return truthy(this._condition)
            ? ((this.target as unknown as Record<string, unknown>)[method] as (...args: unknown[]) => unknown)(this.target, ...parameters)
            : this.target;
    }
}

// TS2545/TS2352 escape hatch: roblox-ts's own class emission reserves the
// `__index` metamethod for chaining an instance to its class's method table,
// but it does not restrict *calling* setmetatable -- it is an ordinary Luau
// global, just missing from @rbxts/types. Declaring it here compiles to a
// plain `setmetatable(...)` call (verified against the emitted Luau and run
// under Lune), which is enough to build a second, hand-rolled `__index` that
// routes a statically-unknown member name into `__get`/`___call` -- the
// dispatch PHP's runtime performs on its own and this platform has no
// counterpart for.
declare function setmetatable<T extends object>(t: T, metatable: object): T;

type MemberResult<T, K extends keyof T> = T[K] extends (...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => TReturn | T
    : T[K] | T;

/**
 * The dynamic view of a `HigherOrderWhenProxy` once its condition is already
 * known: the next member accessed on it -- property or method, matching
 * whatever `T[K]` actually is -- forwards to the target if the condition is
 * truthy, or hands back the target itself otherwise. Either way this is the
 * *last* hop: what comes back is a real value, never another proxy.
 */
export type ResolvedHigherOrderWhenProxy<T extends object> = {
    [K in keyof T]: MemberResult<T, K>;
};

type PendingMemberResult<T extends object, K extends keyof T> = T[K] extends (...args: infer TArgs) => unknown
    ? (...args: TArgs) => ResolvedHigherOrderWhenProxy<T>
    : ResolvedHigherOrderWhenProxy<T>;

/**
 * The dynamic view of a `HigherOrderWhenProxy` before its condition is
 * known: the next member accessed on it is read (or called) once to
 * *compute* the condition, then hands back a {@link ResolvedHigherOrderWhenProxy}
 * for the member that actually resolves it.
 */
export type PendingHigherOrderWhenProxy<T extends object> = {
    [K in keyof T]: PendingMemberResult<T, K>;
};

/**
 * Wraps a `HigherOrderWhenProxy` so that an arbitrary, statically-unknown
 * member access on it -- `.save()`, `.isAdmin` -- routes into `__get`/
 * `___call` the way PHP's own `$obj->{$key}` and `$obj->{$method}(...)`
 * do automatically. `proxy` itself is untouched by this -- the wrapper is a
 * second, plain object whose only job is dispatch, so the class's own
 * `__index` (reserved by roblox-ts for its normal methods) is never
 * disturbed. A mapped type at each call site (`PendingHigherOrderWhenProxy`/
 * `ResolvedHigherOrderWhenProxy`) is the only way TypeScript allows calling
 * `.save()` on the result at all -- `unknown` disallows member access
 * entirely, and roblox-ts rejects `any` outright.
 */
export function wrapHigherOrderWhenProxy<T extends object>(target: T, proxy: HigherOrderWhenProxy<T>): unknown
{
    const handler = {
        // A mapped type only ever produces property signatures, never method
        // shorthand, so roblox-ts always compiles a call through one as a
        // plain dot-call (`wrapped.save(x)`, no implicit `self`) rather than
        // the colon-call a real class method gets -- verified against the
        // emitted Luau. The wrapper below takes its arguments as-is for that
        // reason; adding a leading `self` parameter here would silently eat
        // the first real argument instead.
        __index: (_receiver: unknown, key: string) => {
            const raw = (target as unknown as Record<string, unknown>)[key];

            if (typeIs(raw, 'function')) {
                // `___call` returns `this` (the bare instance) when the
                // condition still isn't captured, meaning "keep chaining" --
                // but the bare instance has no dynamic `__index` of its own,
                // only `wrapped` does. Swap it back in so the next hop stays
                // dispatchable, same as PHP's own object identity does for
                // free (there, `$this` returned from `__call` already *is*
                // the one object `__get`/`__call` keep firing on).
                return (...args: unknown[]) => {
                    const result = proxy.___call(key, args);

                    return result === proxy ? wrapped : result;
                };
            }

            const result = proxy.__get(key);

            return result === proxy ? wrapped : result;
        },
    };

    const wrapped = setmetatable({}, handler);

    return wrapped;
}
