// TS2545/TS2352 escape hatch: roblox-ts's own class emission reserves the
// `__index` metamethod for chaining an instance to its class's method table,
// but it does not restrict *calling* setmetatable -- it is an ordinary Luau
// global, just missing from @rbxts/types. Declaring it here compiles to a
// plain `setmetatable(...)` call (verified against the emitted Luau and run
// under Lune), which is enough to build a second, hand-rolled `__index` that
// forwards a statically-unknown member name -- the one thing a roblox-ts
// `class` cannot do.
declare function setmetatable<T extends object>(t: T, metatable: object): T;

/**
 * PHP's bare `if ($value)` also coerces 0, '', '0' and [] to false; only the
 * scalar cases are handled here -- an empty Array/Map/OrderedMap read as a
 * condition reads as truthy, unlike PHP.
 */
export function truthy(value: unknown): boolean
{
    return value !== undefined && value !== false && value !== 0 && value !== '' && value !== '0';
}

type MemberResult<T, K extends keyof T> = T[K] extends (...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => TReturn | T
    : T[K] | T;

/**
 * The proxy once its condition is already known: the next member accessed on
 * it -- property or method, matching whatever `T[K]` actually is -- forwards
 * to `target` if the condition is truthy, or hands back `target` itself
 * otherwise. Either way this is the *last* hop: what comes back is a real
 * value, never another proxy.
 */
export type ResolvedHigherOrderWhenProxy<T extends object> = {
    [K in keyof T]: MemberResult<T, K>;
};

type PendingMemberResult<T extends object, K extends keyof T> = T[K] extends (...args: infer TArgs) => unknown
    ? (...args: TArgs) => ResolvedHigherOrderWhenProxy<T>
    : ResolvedHigherOrderWhenProxy<T>;

/**
 * The proxy before its condition is known: the next member accessed on it is
 * read (or called) once to *compute* the condition, then hands back a
 * {@link ResolvedHigherOrderWhenProxy} for the member that actually resolves
 * it.
 */
export type HigherOrderWhenProxy<T extends object> = {
    [K in keyof T]: PendingMemberResult<T, K>;
};

interface ProxyState
{
    hasCondition: boolean;
    condition: boolean;
    negateConditionOnCapture: boolean;
}

/**
 * Builds the proxy PHP returns from `Conditionable::when()`/`unless()` when
 * called with fewer than two arguments. `state` is mutated in place as the
 * proxy resolves, mirroring `HigherOrderWhenProxy`'s own `$hasCondition`/
 * `$condition` becoming set the first time a member is captured.
 */
export function makeHigherOrderWhenProxy<T extends object>(target: T, state: ProxyState): T
{
    const resolve = (computed: unknown): unknown => {
        if (!state.hasCondition) {
            const captured = state.negateConditionOnCapture ? !truthy(computed) : truthy(computed);
            state.condition = captured;
            state.hasCondition = true;

            return proxy;
        }

        return state.condition ? computed : target;
    };

    const handler = {
        // A mapped type (`ResolvedHigherOrderWhenProxy`/`HigherOrderWhenProxy`) only
        // ever produces property signatures, never method shorthand, so roblox-ts
        // always compiles a call through one as a plain dot-call (`proxy.activate(x)`,
        // no implicit `self`) rather than the colon-call a real class method gets --
        // verified against the emitted Luau. The wrapper below takes its arguments
        // as-is for that reason; adding a leading `self` parameter here silently eats
        // the first real argument instead.
        __index: (_receiver: unknown, key: string) => {
            const raw = (target as unknown as Record<string, unknown>)[key];

            if (typeIs(raw, 'function')) {
                return (...args: unknown[]) => resolve((raw as (...a: unknown[]) => unknown)(target, ...args));
            }

            return resolve(raw);
        },
    };

    const proxy = setmetatable({}, handler) as T;

    return proxy;
}
