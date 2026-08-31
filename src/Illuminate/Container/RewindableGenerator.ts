import { isCallable } from 'Illuminate/Container/helpers';

/**
 * PHP: `Illuminate\Container\RewindableGenerator`, returned by
 * `Container::tagged()`.
 *
 * The callable is invoked afresh on every `getIterator()`, which is what makes
 * it rewindable, and yields one service at a time -- a tagged binding is only
 * resolved once iteration reaches it.
 */
export class RewindableGenerator<T extends defined = defined>
{
    /** Create a new generator instance. */
    public constructor(
        protected generator: () => Generator<T>,
        protected _count: number | (() => number),
    )
    {}

    /** Get an iterator from the generator. */
    public getIterator(): Generator<T>
    {
        return this.generator();
    }

    /** Get the total number of tagged services. */
    public count(): number
    {
        const count = this._count;

        if (isCallable(count)) {
            this._count = (count as () => number)();
        }

        return this._count as number;
    }

    /**
     * Drain the sequence into an array.
     *
     * Stands in for the `iterator_to_array()` PHP calls at the few places that
     * need a list rather than a lazy sequence.
     */
    public toArray(): Array<T>
    {
        const items = new Array<T>();

        for (const item of this.getIterator()) {
            items.push(item);
        }

        return items;
    }
}
