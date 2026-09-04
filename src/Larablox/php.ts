import { PackedArgs } from 'Larablox/TableArgs';

// Stand-ins for PHP language built-ins the ported code leans on - not
// Laravel helpers. `Illuminate/Support/helpers.ts` mirrors upstream's
// `Support/helpers.php` line for line and must stay that way; anything the
// port itself invents to spell a PHP construct lives here instead.

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
