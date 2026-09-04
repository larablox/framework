import { HigherOrderTapProxy, HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';
import { PackedArgs } from 'Illuminate/Support/TableArgs';

/**
 * PHP's bare `if ($value)` also coerces 0, '', '0' and [] to false; only the
 * scalar cases are handled here - an empty Array/Map/OrderedMap reads as
 * truthy, unlike PHP.
 */
export function truthy(value: unknown): boolean
{
    return value !== undefined && value !== false && value !== 0 && value !== '' && value !== '0';
}

export function func_num_args(args: PackedArgs): number
{
    return args.n;
}

export function func_get_arg(args: PackedArgs, position: number): unknown
{
    return args[position];
}

export function func_get_args(args: PackedArgs): Array<unknown>
{
    return args;
}

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
