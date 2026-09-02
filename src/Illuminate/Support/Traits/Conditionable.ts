// TS2545: a mixin base's constructor must accept a single `any[]` rest parameter.
type AnyConstructor<T = object> = new (...args: any[]) => T;

/**
 * PHP's bare `if ($value)` also coerces 0, '', '0' and [] to false; only the
 * scalar cases are handled here to keep this trait free of any dependency --
 * an empty Array/Map/OrderedMap passed as `value` reads as truthy, unlike
 * PHP.
 */
function truthy(value: unknown): boolean
{
    return value !== undefined && value !== false && value !== 0 && value !== '' && value !== '0';
}

/**
 * Add conditional applicability to any class.
 *
 * PHP's `when()`/`unless()` return a `HigherOrderWhenProxy` when called with
 * fewer than two arguments, forwarding whatever method is chained onto it
 * next (`$this->when($cond)->save()`) through `__call`/`__get`. roblox-ts
 * reserves the `__index` metamethod for its own class emission, and exposes
 * no `setmetatable` to build one by hand, so there is no way to intercept an
 * arbitrary, statically-unknown member name the way PHP does -- that
 * proxying form is not ported. `callback` is required here instead of
 * optional for the same reason.
 */
export function Conditionable<TBase extends AnyConstructor>(Base: TBase)
{
    return class extends Base
    {
        /** Apply the callback if the given "value" is (or resolves to) truthy. */
        public when<TValue, TReturn = this>(
            value: TValue | ((instance: this) => TValue),
            callback: (instance: this, value: TValue) => TReturn | void,
            defaultCallback?: (instance: this, value: TValue) => TReturn | void,
        ): this | TReturn
        {
            const resolved = (typeIs(value, 'function') ? (value as (instance: this) => TValue)(this) : value) as TValue;

            if (truthy(resolved)) {
                return (callback(this, resolved) ?? this) as this | TReturn;
            } else if (defaultCallback !== undefined) {
                return (defaultCallback(this, resolved) ?? this) as this | TReturn;
            }

            return this;
        }

        /** Apply the callback if the given "value" is (or resolves to) falsy. */
        public unless<TValue, TReturn = this>(
            value: TValue | ((instance: this) => TValue),
            callback: (instance: this, value: TValue) => TReturn | void,
            defaultCallback?: (instance: this, value: TValue) => TReturn | void,
        ): this | TReturn
        {
            const resolved = (typeIs(value, 'function') ? (value as (instance: this) => TValue)(this) : value) as TValue;

            if (!truthy(resolved)) {
                return (callback(this, resolved) ?? this) as this | TReturn;
            } else if (defaultCallback !== undefined) {
                return (defaultCallback(this, resolved) ?? this) as this | TReturn;
            }

            return this;
        }
    };
}
