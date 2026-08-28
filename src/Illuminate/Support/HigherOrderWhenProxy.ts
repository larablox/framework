import { Util } from 'Illuminate/Container/Util';
import { callMethod, methodExists } from 'Illuminate/Container/helpers';

/**
 * PHP: `Illuminate\Support\HigherOrderWhenProxy`.
 *
 * `__get` and `__call` are dispatched off one `__index` metamethod, installed
 * by the constructor: a function-valued target member is a method and takes
 * `__call`'s path through the returned wrapper (dot-called -- the mapped
 * proxy types declare fields, so no self arrives), anything else `__get`'s.
 * `$condition` and `$negateConditionOnCapture` live beside their methods, so
 * the properties take the leading underscore.
 */
export class HigherOrderWhenProxy<TTarget>
{
    /** The target being conditionally operated on. */
    protected target: TTarget;

    /** The condition for proxying. */
    protected _condition = false;

    /** Indicates whether the proxy has a condition. */
    protected hasCondition = false;

    /** Determine whether the condition should be negated. */
    protected _negateConditionOnCapture = false;

    /** The `__get`/`__call` dispatcher every instance shares. */
    private static readonly metatable = {
        __index: (proxy: object, key: unknown) => {
            const own = (HigherOrderWhenProxy as unknown as Record<string, unknown>)[key as string];

            if (own !== undefined) {
                return own;
            }

            const instance = proxy as HigherOrderWhenProxy<unknown>;

            if (methodExists(instance.target, key as string)) {
                return (...parameters: Array<unknown>) => instance.___call(key as string, parameters);
            }

            return instance.__get(key as string);
        },
    } as LuaMetatable<object>;

    /** Create a new proxy instance. */
    public constructor(target: TTarget)
    {
        this.target = target;

        setmetatable(this as unknown as object, HigherOrderWhenProxy.metatable);
    }

    /** Set the condition on the proxy. */
    public condition(condition: boolean): this
    {
        [this._condition, this.hasCondition] = [
            condition,
            true,
        ];

        return this;
    }

    /** Indicate that the condition should be negated. */
    public negateConditionOnCapture(): this
    {
        this._negateConditionOnCapture = true;

        return this;
    }

    /** Proxy accessing an attribute onto the target. */
    protected __get(key: string): unknown
    {
        if (!this.hasCondition) {
            const condition = Util.truthy((this.target as Record<string, unknown>)[key]);

            return this.condition(this._negateConditionOnCapture ? !condition : condition);
        }

        return this._condition
            ? (this.target as Record<string, unknown>)[key]
            : this.target;
    }

    /**
     * Proxy a method call on the target.
     *
     * roblox-ts reserves Lua metamethod names in class definitions, so PHP's
     * `__call` takes the underscore convention one step further.
     */
    protected ___call(method: string, parameters: Array<unknown>): unknown
    {
        if (!this.hasCondition) {
            const condition = Util.truthy(callMethod(this.target, method, ...parameters));

            return this.condition(this._negateConditionOnCapture ? !condition : condition);
        }

        return this._condition
            ? callMethod(this.target, method, ...parameters)
            : this.target;
    }
}

/**
 * The capture phase `when()`/`unless()` return: the first member access
 * becomes the condition. PHP needs no name for either phase -- the proxy is
 * dynamic there; the two aliases carry its typing.
 */
export type WhenProxyCapture<T> =
    & HigherOrderWhenProxy<T>
    & {
        readonly [K in keyof T]: T[K] extends (...args: infer TArgs) => unknown
            ? (...args: TArgs) => WhenProxyConditioned<T>
            : WhenProxyConditioned<T>;
    };

/** The conditioned phase: an access applies to the target, or skips to it. */
export type WhenProxyConditioned<T> =
    & HigherOrderWhenProxy<T>
    & {
        readonly [K in keyof T]: T[K] extends (...args: infer TArgs) => infer TReturn ? (...args: TArgs) => T | TReturn
            : T | T[K];
    };
