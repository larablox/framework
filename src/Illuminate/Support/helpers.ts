import { PackedArgs } from 'Illuminate/Support/TableArgs';

/**
 * PHP's bare `if ($value)` also coerces 0, '', '0' and [] to false; only the
 * scalar cases are handled here -- an empty Array/Map/OrderedMap reads as
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
