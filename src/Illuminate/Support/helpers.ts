import { HigherOrderTapProxy, HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';

/** Call the given Closure with the given value then return the value. */
export function tap<TValue extends object>(value: TValue): HigherOrderTapProxyView<TValue>;
export function tap<TValue>(value: TValue, callback: (value: TValue) => unknown): TValue;
export function tap<TValue extends object>(value: TValue, callback?: (value: TValue) => unknown): HigherOrderTapProxyView<TValue> | TValue;
export function tap<TValue>(value: TValue, callback?: (value: TValue) => unknown): unknown
{
    if (callback === undefined) {
        return new HigherOrderTapProxy(value as TValue & object);
    }

    callback(value);

    return value;
}
