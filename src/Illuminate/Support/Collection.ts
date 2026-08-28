import { Arr } from 'Illuminate/Support/Arr';
import { ItemNotFoundException, MultipleItemsFoundException } from 'Illuminate/Exception';
import { OrderedMap } from 'Illuminate/Support/OrderedMap';
import { Reflector } from 'Illuminate/Support/Reflector';
import { Util } from 'Illuminate/Container/Util';
import { VarDumper } from 'Illuminate/Support/VarDumper';

/** What a collection can be built from. */
export type ArrayableItems<TKey extends defined, TValue extends defined> =
    | Collection<TKey, TValue>
    | OrderedMap<TKey, TValue>
    | Array<TValue>
    | Record<string, TValue>;

/** PHP: `fn ($value, $key)`. */
export type ValueCallback<TKey extends defined, TValue extends defined, TReturn> = (
    value: TValue,
    key: TKey,
) => TReturn;

/** The operators `where()` understands. */
export type WhereOperator = '=' | '==' | '!=' | '<>' | '<' | '<=' | '>' | '>=';

/**
 * PHP: `Illuminate\Support\Collection` (the core of it).
 *
 * A PHP array is an ordered map, and the collection leans on that throughout --
 * `keyBy`, `groupBy`, `mapWithKeys` and `pluck` all produce string-keyed
 * results. A Luau table has neither ordering nor a way to hold `nil`, so the
 * items live in an `OrderedMap` and a value must be `defined`.
 *
 * Not ported: the higher-order proxy (`$collection->map->name`, which needs
 * `__get`), `Macroable`, `dd`, JSON serialization and `LazyCollection`. The
 * remaining ~120 methods of the PHP class are simply not written yet.
 */
export class Collection<TKey extends defined, TValue extends defined>
{
    /** The items contained in the collection. */
    protected items: OrderedMap<TKey, TValue>;

    /** Create a new collection. */
    public constructor(items?: ArrayableItems<TKey, TValue>)
    {
        this.items = Collection.getArrayableItems(items);
    }

    /** Create a new collection instance. */
    public static make<TKey extends defined, TValue extends defined>(
        items?: ArrayableItems<TKey, TValue>,
    ): Collection<TKey, TValue>
    {
        return new Collection(items);
    }

    /** Create a new collection by invoking the callback a given amount of times. */
    public static times<TValue extends defined>(
        count: number,
        callback: (index: number) => TValue,
    ): Collection<number, TValue>
    {
        const items = new OrderedMap<number, TValue>();

        for (let index = 1; index <= count; index++) {
            items.set(index - 1, callback(index));
        }

        return new Collection(items);
    }

    /** Create a collection with the given range. */
    public static range(from: number, to: number, step = 1): Collection<number, number>
    {
        const items = new OrderedMap<number, number>();
        let index = 0;

        for (let value = from; step > 0 ? value <= to : value >= to; value += step) {
            items.set(index, value);
            index += 1;
        }

        return new Collection(items);
    }

    /** Create a new collection instance if the value isn't one already. */
    public static wrap<TValue extends defined>(
        value: Collection<number, TValue> | Array<TValue> | TValue,
    ): Collection<number, TValue>
    {
        if (value instanceof Collection) {
            return value;
        }

        return new Collection(Util.arrayWrap(value as TValue | Array<TValue>));
    }

    /** Get the underlying items from the given collection if applicable. */
    public static unwrap<TValue extends defined>(value: Collection<defined, TValue> | Array<TValue>): Array<TValue>
    {
        return value instanceof Collection ? value.all() : value;
    }

    /** Create a new instance with no items. */
    public static empty<TKey extends defined, TValue extends defined>(): Collection<TKey, TValue>
    {
        return new Collection<TKey, TValue>();
    }

    /**
     * Results array of items from a Collection, OrderedMap, array or table.
     *
     * A plain object literal is accepted for parity with PHP's `['a' => 1]`,
     * but `pairs` has no defined order, so its key order is not preserved.
     */
    protected static getArrayableItems<TKey extends defined, TValue extends defined>(
        items?: ArrayableItems<TKey, TValue>,
    ): OrderedMap<TKey, TValue>
    {
        const result = new OrderedMap<TKey, TValue>();

        if (items === undefined) {
            return result;
        }

        if (items instanceof Collection) {
            for (const [key, value] of (items as Collection<TKey, TValue>).entries()) {
                result.set(key, value);
            }

            return result;
        }

        if (items instanceof OrderedMap) {
            for (const [key, value] of (items as OrderedMap<TKey, TValue>).entries()) {
                result.set(key, value);
            }

            return result;
        }

        if (Util.isArray(items)) {
            const list = items as Array<TValue>;

            for (let index = 0; index < list.size(); index++) {
                result.set(index as unknown as TKey, list[index]);
            }

            return result;
        }

        for (const [key, value] of pairs(items as Record<string, TValue>)) {
            result.set(key as unknown as TKey, value as TValue);
        }

        return result;
    }

    /** Build a collection from already-keyed entries. */
    protected static fromEntries<TKey extends defined, TValue extends defined>(
        entries: Array<[TKey, TValue]>,
    ): Collection<TKey, TValue>
    {
        const items = new OrderedMap<TKey, TValue>();

        for (const [key, value] of entries) {
            items.set(key, value);
        }

        return new Collection(items);
    }

    // -----------------------------------------------------------------
    // Reading
    // -----------------------------------------------------------------

    /**
     * Get all of the items in the collection.
     *
     * PHP returns the key => value array itself; a Luau array cannot carry
     * string keys, so this yields the values in order and `entries()` yields
     * the pairs.
     */
    public all(): Array<TValue>
    {
        return this.items.values();
    }

    /** Get the key / value pairs in order. */
    public entries(): Array<[TKey, TValue]>
    {
        return this.items.entries();
    }

    /** Get the collection of items as a plain array, resolving nested collections. */
    public toArray(): Array<defined>
    {
        const result = new Array<defined>();

        for (const value of this.items.values()) {
            result.push(value instanceof Collection ? (value as Collection<defined, defined>).toArray() : value);
        }

        return result;
    }

    /** Count the number of items in the collection. */
    public count(): number
    {
        return this.items.size();
    }

    /** Determine if the collection is empty or not. */
    public isEmpty(): boolean
    {
        return this.items.size() === 0;
    }

    /** Determine if the collection is not empty. */
    public isNotEmpty(): boolean
    {
        return !this.isEmpty();
    }

    /** Determine if the collection contains a single item. */
    public containsOneItem(): boolean
    {
        return this.count() === 1;
    }

    /** Get the keys of the collection items. */
    public keys(): Collection<number, TKey>
    {
        return new Collection(this.items.keys());
    }

    /** Reset the keys on the underlying array. */
    public values(): Collection<number, TValue>
    {
        return new Collection(this.items.values());
    }

    /** Get an item from the collection by key. */
    public get(key: TKey, defaultValue?: TValue): TValue | undefined
    {
        const value = this.items.get(key);

        return value !== undefined ? value : defaultValue;
    }

    /** Determine if an item exists in the collection by key. */
    public has(keys: TKey | Array<TKey>): boolean
    {
        for (const key of Util.arrayWrap(keys)) {
            if (!this.items.has(key)) {
                return false;
            }
        }

        return true;
    }

    /** Determine if any of the keys exist in the collection. */
    public hasAny(keys: TKey | Array<TKey>): boolean
    {
        for (const key of Util.arrayWrap(keys)) {
            if (this.items.has(key)) {
                return true;
            }
        }

        return false;
    }

    /** Get the first item from the collection passing the given truth test. */
    public first(callback?: ValueCallback<TKey, TValue, boolean>, defaultValue?: TValue): TValue | undefined
    {
        for (const [key, value] of this.items.entries()) {
            if (callback === undefined || callback(value, key)) {
                return value;
            }
        }

        return defaultValue;
    }

    /** Get the first item by the given key value pair. */
    public firstWhere(key: string, operator?: WhereOperator | defined, value?: defined): TValue | undefined
    {
        return this.first(this.operatorForWhere(key, operator, value));
    }

    /** Get the last item from the collection passing the given truth test. */
    public last(callback?: ValueCallback<TKey, TValue, boolean>, defaultValue?: TValue): TValue | undefined
    {
        const entries = this.items.entries();

        for (let index = entries.size() - 1; index >= 0; index--) {
            const [key, value] = entries[index];

            if (callback === undefined || callback(value, key)) {
                return value;
            }
        }

        return defaultValue;
    }

    /** Get the sole item, failing when there is not exactly one match. */
    public sole(callback?: ValueCallback<TKey, TValue, boolean>): TValue
    {
        const matched = callback === undefined ? this : this.filter(callback);

        if (matched.isEmpty()) {
            throw new ItemNotFoundException('No items were found.');
        }

        if (matched.count() > 1) {
            throw new MultipleItemsFoundException(`${matched.count()} items were found.`);
        }

        return matched.first() as TValue;
    }

    /** Get the first item, failing when the collection is empty. */
    public firstOrFail(callback?: ValueCallback<TKey, TValue, boolean>): TValue
    {
        const value = this.first(callback);

        if (value === undefined) {
            throw new ItemNotFoundException('No items were found.');
        }

        return value;
    }

    /** Search the collection for a given value and return the corresponding key. */
    public search(value: TValue | ValueCallback<TKey, TValue, boolean>): TKey | undefined
    {
        for (const [key, item] of this.items.entries()) {
            const matches = typeIs(value, 'function')
                ? ((value as ValueCallback<TKey, TValue, boolean>)(item, key) as boolean)
                : item === value;

            if (matches) {
                return key;
            }
        }

        return undefined;
    }

    /** Determine if an item exists in the collection. */
    public contains(value: TValue | ValueCallback<TKey, TValue, boolean>): boolean
    {
        return this.search(value) !== undefined;
    }

    /** Determine if an item is not contained in the collection. */
    public doesntContain(value: TValue | ValueCallback<TKey, TValue, boolean>): boolean
    {
        return !this.contains(value);
    }

    /** Determine if all items pass the given truth test. */
    public every(callback: ValueCallback<TKey, TValue, boolean>): boolean
    {
        for (const [key, value] of this.items.entries()) {
            if (!callback(value, key)) {
                return false;
            }
        }

        return true;
    }

    // -----------------------------------------------------------------
    // Transforming
    // -----------------------------------------------------------------

    /** Execute a callback over each item. */
    public each(callback: ValueCallback<TKey, TValue, unknown>): this
    {
        for (const [key, value] of this.items.entries()) {
            if (callback(value, key) === false) {
                break;
            }
        }

        return this;
    }

    /** Run a map over each of the items. */
    public map<TResult extends defined>(callback: ValueCallback<TKey, TValue, TResult>): Collection<TKey, TResult>
    {
        const entries = new Array<[TKey, TResult]>();

        for (const [key, value] of this.items.entries()) {
            entries.push([key, callback(value, key)]);
        }

        return Collection.fromEntries(entries);
    }

    /** Run an associative map over each of the items. */
    public mapWithKeys<TMapKey extends defined, TResult extends defined>(
        callback: ValueCallback<TKey, TValue, [TMapKey, TResult]>,
    ): Collection<TMapKey, TResult>
    {
        const entries = new Array<[TMapKey, TResult]>();

        for (const [key, value] of this.items.entries()) {
            entries.push(callback(value, key));
        }

        return Collection.fromEntries(entries);
    }

    /** Map a collection and flatten the result by a single level. */
    public flatMap<TResult extends defined>(
        callback: ValueCallback<TKey, TValue, Array<TResult> | Collection<defined, TResult>>,
    ): Collection<number, TResult>
    {
        const result = new Array<TResult>();

        for (const [key, value] of this.items.entries()) {
            const mapped = callback(value, key);

            for (const item of mapped instanceof Collection ? mapped.all() : mapped) {
                result.push(item);
            }
        }

        return new Collection(result);
    }

    /** Transform each item in the collection in place. */
    public transform(callback: ValueCallback<TKey, TValue, TValue>): this
    {
        for (const [key, value] of this.items.entries()) {
            this.items.set(key, callback(value, key));
        }

        return this;
    }

    /** Run a filter over each of the items. */
    public filter(callback?: ValueCallback<TKey, TValue, boolean>): Collection<TKey, TValue>
    {
        const entries = new Array<[TKey, TValue]>();

        for (const [key, value] of this.items.entries()) {
            const keep = callback === undefined ? Collection.truthy(value) : callback(value, key);

            if (keep) {
                entries.push([key, value]);
            }
        }

        return Collection.fromEntries(entries);
    }

    /** Create a collection of all elements that do not pass a given truth test. */
    public reject(callback: ValueCallback<TKey, TValue, boolean>): Collection<TKey, TValue>
    {
        return this.filter((value, key) => !callback(value, key));
    }

    /** Filter items by the given key value pair. */
    public where(key: string, operator?: WhereOperator | defined, value?: defined): Collection<TKey, TValue>
    {
        return this.filter(this.operatorForWhere(key, operator, value));
    }

    /** Filter items by the given key value pair. */
    public whereIn(key: string, values: Array<defined>): Collection<TKey, TValue>
    {
        return this.filter((item) => values.includes(Collection.dataGet(item, key) as defined));
    }

    /** Filter items by the given key value pair. */
    public whereNotIn(key: string, values: Array<defined>): Collection<TKey, TValue>
    {
        return this.filter((item) => !values.includes(Collection.dataGet(item, key) as defined));
    }

    /** Filter items where the given key is null. */
    public whereNull(key: string): Collection<TKey, TValue>
    {
        return this.filter((item) => Collection.dataGet(item, key) === undefined);
    }

    /** Filter items where the given key is not null. */
    public whereNotNull(key: string): Collection<TKey, TValue>
    {
        return this.filter((item) => Collection.dataGet(item, key) !== undefined);
    }

    /** Filter the items, removing any items that don't match the given type. */
    public whereInstanceOf(klass: object): Collection<TKey, TValue>
    {
        return this.filter((item) => Reflector.isInstanceOf(item, klass));
    }

    /** Get the values of a given key. */
    public pluck<TResult extends defined>(value: string, key?: string): Collection<defined, TResult>
    {
        const entries = new Array<[defined, TResult]>();
        let index = 0;

        for (const item of this.items.values()) {
            const plucked = Collection.dataGet(item, value) as TResult | undefined;

            if (plucked === undefined) {
                continue;
            }

            const pluckedKey = key === undefined ? index : (Collection.dataGet(item, key) as defined);

            entries.push([pluckedKey, plucked]);
            index += 1;
        }

        return Collection.fromEntries(entries);
    }

    /** Key an associative array by a field or using a callback. */
    public keyBy<TNewKey extends defined>(
        keyBy: string | ValueCallback<TKey, TValue, TNewKey>,
    ): Collection<TNewKey, TValue>
    {
        const entries = new Array<[TNewKey, TValue]>();

        for (const [key, value] of this.items.entries()) {
            const newKey = typeIs(keyBy, 'function')
                ? (keyBy as ValueCallback<TKey, TValue, TNewKey>)(value, key)
                : (Collection.dataGet(value, keyBy as string) as TNewKey);

            entries.push([newKey, value]);
        }

        return Collection.fromEntries(entries);
    }

    /** Group an associative array by a field or using a callback. */
    public groupBy<TGroupKey extends defined>(
        groupBy: string | ValueCallback<TKey, TValue, TGroupKey>,
    ): Collection<TGroupKey, Collection<TKey, TValue>>
    {
        const groups = new OrderedMap<TGroupKey, Array<[TKey, TValue]>>();

        for (const [key, value] of this.items.entries()) {
            const groupKey = typeIs(groupBy, 'function')
                ? (groupBy as ValueCallback<TKey, TValue, TGroupKey>)(value, key)
                : (Collection.dataGet(value, groupBy as string) as TGroupKey);

            let group = groups.get(groupKey);

            if (group === undefined) {
                group = new Array<[TKey, TValue]>();
                groups.set(groupKey, group);
            }

            group.push([key, value]);
        }

        const result = new OrderedMap<TGroupKey, Collection<TKey, TValue>>();

        for (const [groupKey, group] of groups.entries()) {
            result.set(groupKey, Collection.fromEntries(group));
        }

        return new Collection(result);
    }

    /** Count the number of items by the result of the callback. */
    public countBy(callback?: ValueCallback<TKey, TValue, defined>): Collection<defined, number>
    {
        const counts = new OrderedMap<defined, number>();

        for (const [key, value] of this.items.entries()) {
            const countKey = callback === undefined ? (value as defined) : callback(value, key);

            counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
        }

        return new Collection(counts);
    }

    /** Return only unique items from the collection. */
    public unique(callback?: ValueCallback<TKey, TValue, defined>): Collection<TKey, TValue>
    {
        const seen = new Set<defined>();
        const entries = new Array<[TKey, TValue]>();

        for (const [key, value] of this.items.entries()) {
            const identity = callback === undefined ? (value as defined) : callback(value, key);

            if (seen.has(identity)) {
                continue;
            }

            seen.add(identity);
            entries.push([key, value]);
        }

        return Collection.fromEntries(entries);
    }

    /** Collapse a collection of arrays into a single, flat collection. */
    public collapse(): Collection<number, defined>
    {
        const result = new Array<defined>();

        for (const value of this.items.values()) {
            if (value instanceof Collection) {
                for (const item of (value as Collection<defined, defined>).all()) {
                    result.push(item);
                }
            } else if (Util.isArray(value) || Util.isEmptyArray(value)) {
                // An empty nested list contributes nothing, so it has to be
                // recognized as a list rather than fall through to the
                // single-value branch below.
                for (const item of value as unknown as Array<defined>) {
                    result.push(item);
                }
            } else {
                result.push(value);
            }
        }

        return new Collection(result);
    }

    /** Get a flattened array of the items in the collection. */
    public flatten(depth = math.huge): Collection<number, defined>
    {
        const result = new Array<defined>();

        const walk = (values: Array<defined>, remaining: number): void => {
            for (const value of values) {
                const nested = value instanceof Collection ? (value as Collection<defined, defined>).all() : value;

                if (remaining > 0 && Util.isArray(nested)) {
                    walk(nested as Array<defined>, remaining - 1);
                } else {
                    result.push(value);
                }
            }
        };

        walk(this.items.values() as Array<defined>, depth);

        return new Collection(result);
    }

    /** Partition the collection into two arrays using the given callback. */
    public partition(
        callback: ValueCallback<TKey, TValue, boolean>,
    ): [Collection<TKey, TValue>, Collection<TKey, TValue>]
    {
        const passed = new Array<[TKey, TValue]>();
        const failed = new Array<[TKey, TValue]>();

        for (const [key, value] of this.items.entries()) {
            if (callback(value, key)) {
                passed.push([key, value]);
            } else {
                failed.push([key, value]);
            }
        }

        return [Collection.fromEntries(passed), Collection.fromEntries(failed)];
    }

    /** Chunk the collection into chunks of the given size. */
    public chunk(size: number): Collection<number, Collection<TKey, TValue>>
    {
        const chunks = new Array<Collection<TKey, TValue>>();

        if (size <= 0) {
            return new Collection(chunks);
        }

        let current = new Array<[TKey, TValue]>();

        for (const entry of this.items.entries()) {
            current.push(entry);

            if (current.size() === size) {
                chunks.push(Collection.fromEntries(current));
                current = new Array<[TKey, TValue]>();
            }
        }

        if (!current.isEmpty()) {
            chunks.push(Collection.fromEntries(current));
        }

        return new Collection(chunks);
    }

    // -----------------------------------------------------------------
    // Mutating
    // -----------------------------------------------------------------

    /** Push one or more items onto the end of the collection. */
    public push(...values: Array<TValue>): this
    {
        for (const value of values) {
            this.items.set(this.items.size() as unknown as TKey, value);
        }

        return this;
    }

    /** Put an item in the collection by key. */
    public put(key: TKey, value: TValue): this
    {
        this.items.set(key, value);

        return this;
    }

    /**
     * Push an item onto the beginning of the collection.
     *
     * PHP: `Arr::prepend()`, which branches on whether a key was given --
     * `array_unshift()` without one, `[$key => $value] + $array` with one.
     * Those are two different things: `array_unshift()` renumbers the integer
     * keys (so the collection's own 0-based numbering shifts along), while
     * `+` keeps every existing key exactly as it is.
     */
    public prepend(value: TValue, key?: TKey): this
    {
        const entries = this.items.entries();

        this.items = new OrderedMap<TKey, TValue>();

        if (key !== undefined) {
            this.items.set(key, value);

            // `+` keeps the left operand's entry where both sides carry the
            // same key, so an existing one under `key` does not come back.
            for (const [existingKey, existingValue] of entries) {
                if (!this.items.has(existingKey)) {
                    this.items.set(existingKey, existingValue);
                }
            }

            return this;
        }

        let nextIndex = 0;

        this.items.set(nextIndex as unknown as TKey, value);
        nextIndex += 1;

        for (const [existingKey, existingValue] of entries) {
            if (typeIs(existingKey, 'number')) {
                this.items.set(nextIndex as unknown as TKey, existingValue);
                nextIndex += 1;
            } else {
                this.items.set(existingKey, existingValue);
            }
        }

        return this;
    }

    /** Get and remove the last item from the collection. */
    public pop(): TValue | undefined
    {
        const entries = this.items.entries();

        if (entries.isEmpty()) {
            return undefined;
        }

        const [key, value] = entries[entries.size() - 1];

        this.items.delete(key);

        return value;
    }

    /** Get and remove the first item from the collection. */
    public shift(): TValue | undefined
    {
        const entries = this.items.entries();

        if (entries.isEmpty()) {
            return undefined;
        }

        const [key, value] = entries[0];

        this.items.delete(key);

        return value;
    }

    /** Get and remove an item from the collection. */
    public pull(key: TKey, defaultValue?: TValue): TValue | undefined
    {
        const value = this.get(key, defaultValue);

        this.items.delete(key);

        return value;
    }

    /** Remove an item from the collection by key. */
    public forget(keys: TKey | Array<TKey>): this
    {
        for (const key of Util.arrayWrap(keys)) {
            this.items.delete(key);
        }

        return this;
    }

    /** Get the items with the specified keys. */
    public only(keys: TKey | Array<TKey>): Collection<TKey, TValue>
    {
        const wanted = Util.arrayWrap(keys);
        const entries = new Array<[TKey, TValue]>();

        for (const [key, value] of this.items.entries()) {
            if (wanted.includes(key)) {
                entries.push([key, value]);
            }
        }

        return Collection.fromEntries(entries);
    }

    /** Get all items except for those with the specified keys. */
    public except(keys: TKey | Array<TKey>): Collection<TKey, TValue>
    {
        const unwanted = Util.arrayWrap(keys);

        return this.filter((_value, key) => !unwanted.includes(key));
    }

    /** Merge the collection with the given items. */
    public merge(items: ArrayableItems<TKey, TValue>): Collection<TKey, TValue>
    {
        const merged = new OrderedMap<TKey, TValue>();

        for (const [key, value] of this.items.entries()) {
            merged.set(key, value);
        }

        for (const [key, value] of Collection.getArrayableItems(items).entries()) {
            merged.set(key, value);
        }

        return new Collection(merged);
    }

    /** Push all of the given items onto the collection. */
    public concat(items: ArrayableItems<defined, TValue>): Collection<number, TValue>
    {
        const result = this.items.values();

        for (const value of Collection.getArrayableItems(items).values()) {
            result.push(value);
        }

        return new Collection(result);
    }

    // -----------------------------------------------------------------
    // Slicing and ordering
    // -----------------------------------------------------------------

    /** Take the first or last a given number of items. */
    public take(limit: number): Collection<TKey, TValue>
    {
        const entries = this.items.entries();

        if (limit < 0) {
            return Collection.fromEntries(
                Collection.sliceEntries(entries, math.max(entries.size() + limit, 0), -limit),
            );
        }

        return Collection.fromEntries(Collection.sliceEntries(entries, 0, limit));
    }

    /** Skip the first n items. */
    public skip(count: number): Collection<TKey, TValue>
    {
        return this.slice(count);
    }

    /** Slice the underlying collection array. */
    public slice(offset: number, length?: number): Collection<TKey, TValue>
    {
        const entries = this.items.entries();
        const start = offset < 0 ? math.max(entries.size() + offset, 0) : offset;

        return Collection.fromEntries(Collection.sliceEntries(entries, start, length ?? entries.size()));
    }

    /** Get the items for the given page. */
    public forPage(page: number, perPage: number): Collection<TKey, TValue>
    {
        return this.slice(math.max(0, (page - 1) * perPage), perPage);
    }

    /** Reverse items order. */
    public reverse(): Collection<TKey, TValue>
    {
        const entries = this.items.entries();
        const reversed = new Array<[TKey, TValue]>();

        for (let index = entries.size() - 1; index >= 0; index--) {
            reversed.push(entries[index]);
        }

        return Collection.fromEntries(reversed);
    }

    /** Shuffle the items in the collection. */
    public shuffle(): Collection<number, TValue>
    {
        const values = this.items.values();

        for (let index = values.size() - 1; index > 0; index--) {
            const swap = math.random(0, index);
            const held = values[index];

            values[index] = values[swap];
            values[swap] = held;
        }

        return new Collection(values);
    }

    /**
     * Sort through each item with a callback.
     *
     * The comparator returns a number, as in PHP; Luau's `table.sort` wants a
     * boolean, and the conversion happens here.
     */
    public sort(comparator?: (first: TValue, second: TValue) => number): Collection<TKey, TValue>
    {
        const entries = this.items.entries();

        entries.sort((first, second) =>
            comparator === undefined
                ? Collection.compare(first[1], second[1]) < 0
                : comparator(first[1], second[1]) < 0
        );

        return Collection.fromEntries(entries);
    }

    /** Sort items in descending order. */
    public sortDesc(): Collection<TKey, TValue>
    {
        return this.sort((first, second) => Collection.compare(second, first));
    }

    /** Sort the collection using the given callback or key. */
    public sortBy(
        callback: string | ValueCallback<TKey, TValue, defined>,
        descending = false,
    ): Collection<TKey, TValue>
    {
        const entries = this.items.entries();

        const resolve = (key: TKey, value: TValue): defined =>
            typeIs(callback, 'function')
                ? (callback as ValueCallback<TKey, TValue, defined>)(value, key)
                : (Collection.dataGet(value, callback as string) as defined);

        entries.sort((first, second) => {
            const order = Collection.compare(resolve(first[0], first[1]), resolve(second[0], second[1]));

            return descending ? order > 0 : order < 0;
        });

        return Collection.fromEntries(entries);
    }

    /** Sort the collection in descending order using the given callback or key. */
    public sortByDesc(callback: string | ValueCallback<TKey, TValue, defined>): Collection<TKey, TValue>
    {
        return this.sortBy(callback, true);
    }

    /** Sort the collection keys. */
    public sortKeys(descending = false): Collection<TKey, TValue>
    {
        const entries = this.items.entries();

        entries.sort((first, second) => {
            const order = Collection.compare(first[0], second[0]);

            return descending ? order > 0 : order < 0;
        });

        return Collection.fromEntries(entries);
    }

    /** Sort the collection keys in descending order. */
    public sortKeysDesc(): Collection<TKey, TValue>
    {
        return this.sortKeys(true);
    }

    // -----------------------------------------------------------------
    // Aggregates
    // -----------------------------------------------------------------

    /** Reduce the collection to a single value. */
    public reduce<TResult>(callback: (carry: TResult, value: TValue, key: TKey) => TResult, initial: TResult): TResult
    {
        let carry = initial;

        for (const [key, value] of this.items.entries()) {
            carry = callback(carry, value, key);
        }

        return carry;
    }

    /** Get the sum of the given values. */
    public sum(callback?: string | ValueCallback<TKey, TValue, number>): number
    {
        let total = 0;

        for (const [key, value] of this.items.entries()) {
            total += Collection.numberOf(value, key, callback);
        }

        return total;
    }

    /** Get the average value of a given key. */
    public avg(callback?: string | ValueCallback<TKey, TValue, number>): number | undefined
    {
        return this.isEmpty() ? undefined : this.sum(callback) / this.count();
    }

    /** Alias for `avg`. */
    public average(callback?: string | ValueCallback<TKey, TValue, number>): number | undefined
    {
        return this.avg(callback);
    }

    /** Get the minimum value of a given key. */
    public min(callback?: string | ValueCallback<TKey, TValue, number>): number | undefined
    {
        let lowest: number | undefined;

        for (const [key, value] of this.items.entries()) {
            const candidate = Collection.numberOf(value, key, callback);

            if (lowest === undefined || candidate < lowest) {
                lowest = candidate;
            }
        }

        return lowest;
    }

    /** Get the maximum value of a given key. */
    public max(callback?: string | ValueCallback<TKey, TValue, number>): number | undefined
    {
        let highest: number | undefined;

        for (const [key, value] of this.items.entries()) {
            const candidate = Collection.numberOf(value, key, callback);

            if (highest === undefined || candidate > highest) {
                highest = candidate;
            }
        }

        return highest;
    }

    /** Concatenate values of a given key as a string. */
    public implode(glue: string, key?: string): string
    {
        const parts = new Array<string>();

        for (const value of this.items.values()) {
            parts.push(tostring(key === undefined ? value : Collection.dataGet(value, key)));
        }

        return parts.join(glue);
    }

    /** Alias for `implode`. */
    public join(glue: string): string
    {
        return this.implode(glue);
    }

    // -----------------------------------------------------------------
    // Flow
    // -----------------------------------------------------------------

    /** Pass the collection to the given callback and return it. */
    public tap(callback: (collection: this) => void): this
    {
        callback(this);

        return this;
    }

    /** Pass the collection to the given callback and return the result. */
    public pipe<TResult>(callback: (collection: this) => TResult): TResult
    {
        return callback(this);
    }

    /** Apply the callback if the given condition is true. */
    public when(
        condition: boolean,
        callback: (collection: this) => unknown,
        otherwise?: (collection: this) => unknown,
    ): this
    {
        if (condition) {
            callback(this);
        } else if (otherwise !== undefined) {
            otherwise(this);
        }

        return this;
    }

    /** Apply the callback unless the given condition is true. */
    public unless(
        condition: boolean,
        callback: (collection: this) => unknown,
        otherwise?: (collection: this) => unknown,
    ): this
    {
        return this.when(!condition, callback, otherwise);
    }

    /** Apply the callback if the collection is empty. */
    public whenEmpty(callback: (collection: this) => unknown, otherwise?: (collection: this) => unknown): this
    {
        return this.when(this.isEmpty(), callback, otherwise);
    }

    /** Apply the callback if the collection is not empty. */
    public whenNotEmpty(callback: (collection: this) => unknown, otherwise?: (collection: this) => unknown): this
    {
        return this.when(this.isNotEmpty(), callback, otherwise);
    }

    /** Get a base Collection instance from this collection. */
    public collect(): Collection<TKey, TValue>
    {
        return new Collection(this.items);
    }

    /**
     * Dump the items, and anything else handed along with them.
     *
     * PHP is `dump($this->all(), ...$args)`, and this is the same call: the
     * items first, then each extra argument, each one its own dump. It goes
     * through `VarDumper` rather than straight to `print` for the reason
     * that class documents -- so a caller (upstream's own `testDump` among
     * them) can read what was dumped instead of watching it go past.
     */
    public dump(...args: Array<unknown>): this
    {
        VarDumper.dump(this.all());

        for (const value of args) {
            VarDumper.dump(value);
        }

        return this;
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /** PHP: `data_get($target, $key)`, without the wildcard support. */
    protected static dataGet(target: unknown, key: string): unknown
    {
        return Arr.get(target, key);
    }

    /** PHP's loose truthiness for a value, as `filter()` with no callback uses. */
    protected static truthy(value: unknown): boolean
    {
        return Util.truthy(value);
    }

    /** Compare two values, ordering numbers and strings naturally. */
    protected static compare(first: unknown, second: unknown): number
    {
        if (typeIs(first, 'number') && typeIs(second, 'number')) {
            return first - second;
        }

        const firstText = tostring(first);
        const secondText = tostring(second);

        if (firstText === secondText) {
            return 0;
        }

        return firstText < secondText ? -1 : 1;
    }

    /** Resolve the number a value contributes to an aggregate. */
    protected static numberOf<TKey extends defined, TValue extends defined>(
        value: TValue,
        key: TKey,
        callback?: string | ValueCallback<TKey, TValue, number>,
    ): number
    {
        if (callback === undefined) {
            return tonumber(value) ?? 0;
        }

        if (typeIs(callback, 'function')) {
            return (callback as ValueCallback<TKey, TValue, number>)(value, key);
        }

        return tonumber(Collection.dataGet(value, callback as string)) ?? 0;
    }

    /** Take `length` entries starting at `start`. */
    protected static sliceEntries<TKey extends defined, TValue extends defined>(
        entries: Array<[TKey, TValue]>,
        start: number,
        length: number,
    ): Array<[TKey, TValue]>
    {
        const result = new Array<[TKey, TValue]>();

        for (let index = start; index < math.min(start + length, entries.size()); index++) {
            result.push(entries[index]);
        }

        return result;
    }

    /** Build the truth test `where()` and `firstWhere()` filter with. */
    protected operatorForWhere(
        key: string,
        operator?: WhereOperator | defined,
        value?: defined,
    ): ValueCallback<TKey, TValue, boolean>
    {
        let comparison: WhereOperator = '=';
        let expected = value;

        if (value === undefined) {
            expected = operator as defined;
        } else {
            comparison = operator as WhereOperator;
        }

        return (item: TValue) => {
            const actual = Collection.dataGet(item, key);

            if (comparison === '=' || comparison === '==') {
                return actual === expected;
            }

            if (comparison === '!=' || comparison === '<>') {
                return actual !== expected;
            }

            const order = Collection.compare(actual, expected);

            if (comparison === '<') {
                return order < 0;
            }

            if (comparison === '<=') {
                return order <= 0;
            }

            if (comparison === '>') {
                return order > 0;
            }

            return order >= 0;
        };
    }
}

/** PHP: the global `collect()` helper. */
export function collect<TKey extends defined, TValue extends defined>(
    items?: ArrayableItems<TKey, TValue>,
): Collection<TKey, TValue>
{
    return new Collection(items);
}
