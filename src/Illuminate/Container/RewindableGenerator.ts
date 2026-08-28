/**
 * PHP: `Illuminate\Container\RewindableGenerator`, returned by
 * `Container::tagged()`.
 *
 * The callable is invoked afresh on every `getIterator()`, which is what makes
 * it rewindable, and yields one service at a time -- a tagged binding is only
 * resolved once iteration reaches it.
 */
export class RewindableGenerator<T extends defined = defined> {
    private resolvedCount?: number;

    public constructor(
        protected readonly generator: () => Generator<T>,
        protected readonly counter: number | (() => number),
    ) {}

    /** PHP: `getIterator(): Traversable`. */
    public getIterator(): Generator<T> {
        return this.generator();
    }

    /**
     * Drain the sequence into an array.
     *
     * Stands in for the `iterator_to_array()` PHP calls at the few places that
     * need a list rather than a lazy sequence.
     */
    public toArray(): Array<T> {
        const items = new Array<T>();

        for (const item of this.getIterator()) {
            items.push(item);
        }

        return items;
    }

    /** PHP: `count(): int`. */
    public count(): number {
        if (this.resolvedCount === undefined) {
            this.resolvedCount = typeIs(this.counter, 'function') ? this.counter() : this.counter;
        }

        return this.resolvedCount;
    }
}
