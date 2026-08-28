import { Util } from 'Illuminate/Container/Util';

/**
 * PHP: `Illuminate\Support\HigherOrderWhenProxy`.
 *
 * `__get` and `__call` fuse into one `__index` metamethod: the two are told
 * apart by the target's member -- a function-valued one is a method, reached
 * through the returned wrapper, anything else a property. `$condition` and
 * `$negateConditionOnCapture` live beside their methods, so the properties
 * take the leading underscore. `condition()` takes the docblock's `bool`, so
 * the captures normalize through `Util.truthy` before calling it.
 */
export class HigherOrderWhenProxy<TTarget>
{
    /** The condition for proxying. */
    protected _condition = false;

    /** Indicates whether the proxy has a condition. */
    protected hasCondition = false;

    /** Determine whether the condition should be negated. */
    protected _negateConditionOnCapture = false;

    /** Create a new proxy instance. */
    public constructor(protected target: TTarget)
    {
        const classTable = HigherOrderWhenProxy as unknown as Record<string, unknown>;

        setmetatable(this as unknown as object, {
            __index: (proxy: object, key: unknown) => {
                const own = classTable[key as string];

                if (own !== undefined) {
                    return own;
                }

                return (proxy as HigherOrderWhenProxy<TTarget>).pass(key as string);
            },
        } as LuaMetatable<object>);
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

    /** Proxy an access onto the target -- `__get`, or `__call` through the wrapper. */
    protected pass(key: string): unknown
    {
        const value = (this.target as Record<string, unknown>)[key];

        if (typeIs(value, 'function')) {
            // Dot-called: the mapped proxy types declare function-valued
            // fields, so no self arrives -- the target is passed by hand.
            return (...parameters: Array<unknown>) => {
                if (!this.hasCondition) {
                    const condition = Util.truthy((value as Callback)(this.target, ...(parameters as Array<never>)));

                    return this.condition(this._negateConditionOnCapture ? !condition : condition);
                }

                return this._condition
                    ? (value as Callback)(this.target, ...(parameters as Array<never>))
                    : this.target;
            };
        }

        if (!this.hasCondition) {
            const condition = Util.truthy(value);

            return this.condition(this._negateConditionOnCapture ? !condition : condition);
        }

        return this._condition ? value : this.target;
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
