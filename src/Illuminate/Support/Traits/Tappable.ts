import { Trait } from "Illuminate/Support/Traits/Trait";
import type { Constructor } from "Illuminate/Support/Traits/Trait";

/**
 * PHP: `trait Illuminate\Support\Traits\Tappable`.
 *
 * `tap()` with no callback returns a `HigherOrderTapProxy`, which forwards the
 * next method call to the target and hands the target back through `__call`.
 * There is no `__call`, so the callback is required.
 *
 * PHP delegates to the global `tap()` helper; that helper lives in
 * `Support/Helpers`, which imports the classes using this trait, so the two
 * lines are inlined rather than closing a require cycle.
 */
export function Tappable<TBase extends Constructor>(
    Base: TBase = Trait as never,
) {
    return class extends Base {
        /** Call the given closure with this instance then return the instance. */
        public tap(callback: (target: this) => unknown): this {
            callback(this);

            return this;
        }
    };
}
