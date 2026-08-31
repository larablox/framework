import type { OrderedMap } from 'Illuminate/Support/OrderedMap';

/**
 * PHP: `interface Arrayable`.
 *
 * A PHP array is a list and an ordered map at once, so `toArray()` may hand
 * back either shape here -- a list becomes an `Array`, an associative array an
 * `OrderedMap`. Which one an implementation returns is its own business; the
 * caller narrows.
 */
export interface Arrayable<TKey extends defined = defined, TValue extends defined = defined>
{
    /** Get the instance as an array. */
    toArray(): Array<TValue> | OrderedMap<TKey, TValue>;
}

/**
 * PHP: `$value instanceof Arrayable`.
 *
 * Interfaces are erased, so the check asks for the one method the interface
 * ever required -- the same trade `DeferrableProvider` makes.
 */
export function isArrayable(value: unknown): value is Arrayable
{
    return typeIs(value, 'table') && typeIs((value as Arrayable).toArray, 'function');
}
