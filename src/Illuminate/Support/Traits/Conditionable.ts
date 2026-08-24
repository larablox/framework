import { Trait } from "Illuminate/Support/Traits/Trait";
import { Util } from "Illuminate/Container/Util";
import type { Constructor } from "Illuminate/Support/Traits/Trait";

/**
 * PHP: `trait Illuminate\Support\Traits\Conditionable`.
 *
 * `when()` and `unless()` called with no callback return a
 * `HigherOrderWhenProxy`, which captures the condition and applies the next
 * method call through `__get` / `__call`. There is no `__call`, so the
 * callback is required here and the proxy is not ported.
 *
 * `if ($value)` is PHP truthiness, not a null check -- see `Util.truthy`.
 */
export function Conditionable<TBase extends Constructor>(
    Base: TBase = Trait as never,
) {
    return class extends Base {
        /** Apply the callback if the given "value" is (or resolves to) truthy. */
        public when<
            TWhenParameter extends defined,
            TWhenReturn extends defined,
        >(
            value:
                TWhenParameter | ((target: this) => TWhenParameter) | undefined,
            callback: (
                target: this,
                value: TWhenParameter,
            ) => TWhenReturn | undefined,
            defaultCallback?: (
                target: this,
                value: TWhenParameter,
            ) => TWhenReturn | undefined,
        ): this | TWhenReturn {
            const resolved = this.resolveCondition(value);

            if (Util.truthy(resolved)) {
                return callback(this, resolved as TWhenParameter) ?? this;
            }

            if (defaultCallback !== undefined) {
                return (
                    defaultCallback(this, resolved as TWhenParameter) ?? this
                );
            }

            return this;
        }

        /** Apply the callback if the given "value" is (or resolves to) falsy. */
        public unless<
            TUnlessParameter extends defined,
            TUnlessReturn extends defined,
        >(
            value:
                | TUnlessParameter
                | ((target: this) => TUnlessParameter)
                | undefined,
            callback: (
                target: this,
                value: TUnlessParameter,
            ) => TUnlessReturn | undefined,
            defaultCallback?: (
                target: this,
                value: TUnlessParameter,
            ) => TUnlessReturn | undefined,
        ): this | TUnlessReturn {
            const resolved = this.resolveCondition(value);

            if (!Util.truthy(resolved)) {
                return callback(this, resolved as TUnlessParameter) ?? this;
            }

            if (defaultCallback !== undefined) {
                return (
                    defaultCallback(this, resolved as TUnlessParameter) ?? this
                );
            }

            return this;
        }

        /** PHP: `$value instanceof Closure ? $value($this) : $value`. */
        private resolveCondition<TValue extends defined>(
            value: TValue | ((target: this) => TValue) | undefined,
        ): TValue | undefined {
            return typeIs(value, "function")
                ? (value as (target: this) => TValue)(this)
                : value;
        }
    };
}
