import { tap } from 'Illuminate/Support/helpers';
import { HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';
import { AnyConstructor } from 'Illuminate/Support/types';

export function Tappable<TBase extends AnyConstructor>(Base: TBase)
{
    return class extends Base
    {
        /** Call the given Closure with this instance then return the instance. */
        public tap(): HigherOrderTapProxyView<this>;
        public tap(callback: (instance: this) => unknown): this;
        public tap(callback?: (instance: this) => unknown): HigherOrderTapProxyView<this> | this;
        public tap(callback?: (instance: this) => unknown): unknown
        {
            return tap(this, callback);
        }
    };
}
