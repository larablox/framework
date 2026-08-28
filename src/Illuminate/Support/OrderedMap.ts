/**
 * An insertion-ordered map.
 *
 * Every associative array in the Laravel sources being ported is ordered: PHP
 * arrays preserve insertion order, and the framework relies on it (service
 * providers boot in registration order, for one). A Luau table iterated with
 * `pairs` has no defined order, so the ported code stores its "arrays" here
 * instead of in a plain `Map`.
 */
export class OrderedMap<K extends defined, V extends defined>
{
    private readonly entriesByKey = new Map<K, V>();

    private readonly insertionOrder = new Array<K>();

    public has(key: K): boolean
    {
        return this.entriesByKey.has(key);
    }

    public get(key: K): V | undefined
    {
        return this.entriesByKey.get(key);
    }

    public set(key: K, value: V): void
    {
        if (!this.entriesByKey.has(key)) {
            this.insertionOrder.push(key);
        }

        this.entriesByKey.set(key, value);
    }

    public delete(key: K): boolean
    {
        if (!this.entriesByKey.has(key)) {
            return false;
        }

        this.entriesByKey.delete(key);

        const index = this.insertionOrder.indexOf(key);

        if (index !== -1) {
            this.insertionOrder.remove(index);
        }

        return true;
    }

    public size(): number
    {
        return this.insertionOrder.size();
    }

    public isEmpty(): boolean
    {
        return this.insertionOrder.isEmpty();
    }

    public clear(): void
    {
        this.entriesByKey.clear();
        this.insertionOrder.clear();
    }

    /** A copy, so callers may mutate the map while walking the result. */
    public keys(): Array<K>
    {
        return table.clone(this.insertionOrder);
    }

    public values(): Array<V>
    {
        const values = new Array<V>();

        for (const key of this.insertionOrder) {
            values.push(this.entriesByKey.get(key) as V);
        }

        return values;
    }

    /**
     * A shallow copy: the same keys in the same order, the same values.
     *
     * What PHP gets for free when an array is assigned or an object holding
     * one is cloned. Nothing here copies by value, so the copy is explicit.
     */
    public clone(): OrderedMap<K, V>
    {
        const copy = new OrderedMap<K, V>();

        for (const key of this.insertionOrder) {
            copy.set(key, this.entriesByKey.get(key) as V);
        }

        return copy;
    }

    public entries(): Array<[K, V]>
    {
        const entries = new Array<[K, V]>();

        for (const key of this.insertionOrder) {
            entries.push([
                key,
                this.entriesByKey.get(key) as V,
            ]);
        }

        return entries;
    }
}
