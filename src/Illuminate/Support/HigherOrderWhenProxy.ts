import { MagicDispatch } from 'Illuminate/Support/MagicDispatch';

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

type MemberResult<T, K extends keyof T> = T[K] extends (...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => TReturn | T
    : T[K] | T;

/**
 * The dynamic view of a `HigherOrderWhenProxy` once its condition is already
 * known: the next member accessed on it -- property or method, matching
 * whatever `T[K]` actually is -- forwards to the target if the condition is
 * truthy, or hands back the target itself otherwise. Either way this is the
 * *last* hop: what comes back is a real value, never another proxy.
 *
 * `MagicDispatch` marks it for `scripts/build/transform-magic-dispatch.mjs`,
 * which rewrites `.save()`/`.isAdmin` on a value typed this way into direct
 * `___call`/`__get` calls on the `HigherOrderWhenProxy` instance itself --
 * no runtime proxying needed, since both are ordinary methods.
 */
export type ResolvedHigherOrderWhenProxy<T extends object> = MagicDispatch<{
    [K in keyof T]: MemberResult<T, K>;
}>;

type PendingMemberResult<T extends object, K extends keyof T> = T[K] extends (...args: infer TArgs) => unknown
    ? (...args: TArgs) => ResolvedHigherOrderWhenProxy<T>
    : ResolvedHigherOrderWhenProxy<T>;

/**
 * The dynamic view of a `HigherOrderWhenProxy` before its condition is
 * known: the next member accessed on it is read (or called) once to
 * *compute* the condition, then hands back a {@link ResolvedHigherOrderWhenProxy}
 * for the member that actually resolves it.
 */
export type PendingHigherOrderWhenProxy<T extends object> = MagicDispatch<{
    [K in keyof T]: PendingMemberResult<T, K>;
}>;
