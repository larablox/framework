import { MagicDispatch } from 'Larablox/MagicDispatch';
import { truthy } from 'Larablox/php';
import { Callable } from 'Larablox/types';

export class HigherOrderWhenProxy<T extends object>
{
    /** The target being conditionally operated on. */
    protected target: T & Record<string, unknown>;

    /** The condition for proxying. */
    protected _condition?: unknown;

    /** Indicates whether the proxy has a condition. */
    protected hasCondition = false;

    /** Determine whether the condition should be negated. */
    protected _negateConditionOnCapture?: boolean;

    /** Create a new proxy instance. */
    public constructor(target: T)
    {
        this.target = target as T & Record<string, unknown>;
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
            const condition = this.target[key];

            return this.condition(this._negateConditionOnCapture ? !truthy(condition) : condition);
        }

        return truthy(this._condition)
            ? this.target[key]
            : this.target;
    }

    /** Proxy a method call on the target. */
    public ___call(method: string, parameters: unknown[]): unknown
    {
        if (!this.hasCondition) {
            const condition = (this.target[method] as Callable)(this.target, ...parameters);

            return this.condition(this._negateConditionOnCapture ? !truthy(condition) : condition);
        }

        return truthy(this._condition)
            ? (this.target[method] as Callable)(this.target, ...parameters)
            : this.target;
    }
}

type MemberResult<T, K extends keyof T> = T[K] extends (...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => TReturn | T
    : T[K] | T;

/**
 * The view once the condition is known: the next member accessed -
 * property or method, matching whatever `T[K]` actually is - forwards to
 * the target if the condition is truthy, or hands back the target itself
 * otherwise. This is the last hop: what comes back is a real value, never
 * another proxy.
 */
export type ResolvedHigherOrderWhenProxy<T extends object> = MagicDispatch<{
    [K in keyof T]: MemberResult<T, K>;
}>;

type PendingMemberResult<T extends object, K extends keyof T> = T[K] extends (...args: infer TArgs) => unknown
    ? (...args: TArgs) => ResolvedHigherOrderWhenProxy<T>
    : ResolvedHigherOrderWhenProxy<T>;

/**
 * The view before the condition is known: the next member accessed is read
 * (or called) once to *compute* the condition, then hands back a
 * {@link ResolvedHigherOrderWhenProxy} for the member that actually
 * resolves it.
 */
export type PendingHigherOrderWhenProxy<T extends object> = MagicDispatch<{
    [K in keyof T]: PendingMemberResult<T, K>;
}>;
