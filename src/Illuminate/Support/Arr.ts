import { InvalidArgumentException, ItemNotFoundException, MultipleItemsFoundException } from 'Illuminate/Exception';
import { Util } from 'Illuminate/Container/Util';

/** A nested table addressed by string keys, as produced by an object literal. */
export type ArrayAccessible = Record<string, unknown>;

/** PHP: `fn ($value, $key)`. */
export type ArrCallback<TValue, TReturn> = (value: TValue, key: string | number) => TReturn;

/**
 * PHP: `Illuminate\Support\Arr`.
 *
 * A PHP array is a list and an ordered map at once; in Luau those are different
 * things. The port splits accordingly: methods that address keys take and
 * return a table, methods that walk a sequence take and return an array. Where
 * PHP's single method served both, this keeps the side PHP is normally used
 * for -- reach for `Collection` when you need ordered keys.
 *
 * Not ported: `query` (no HTTP), `toCssClasses` / `toCssStyles` (no HTML),
 * `float` (Luau has one number type), `arrayable` (the Arrayable, Jsonable and
 * JsonSerializable interfaces are erased).
 */
export class Arr
{
    /** Determine whether the given value is array accessible. */
    public static accessible(value: unknown): value is ArrayAccessible
    {
        return typeIs(value, 'table');
    }

    /** Determine if the given key exists in the provided array. */
    public static exists(target: unknown, key: string | number): boolean
    {
        return Arr.accessible(target) && target[key as string] !== undefined;
    }

    /** If the given value is not an array and not null, wrap it in one. */
    public static wrap<T extends defined>(value: T | Array<T> | undefined): Array<T>
    {
        return Util.arrayWrap(value);
    }

    // -----------------------------------------------------------------
    // Keyed access
    // -----------------------------------------------------------------

    /** Get an item from an array using "dot" notation. */
    public static get(target: unknown, key?: string, defaultValue?: unknown): unknown
    {
        if (!Arr.accessible(target)) {
            return defaultValue;
        }

        if (key === undefined) {
            return target;
        }

        if (Arr.exists(target, key)) {
            return target[key];
        }

        if (key.find('.', 1, true)[0] === undefined) {
            return defaultValue;
        }

        let current: unknown = target;

        for (const segment of key.split('.')) {
            if (!Arr.accessible(current) || !Arr.exists(current, segment)) {
                return defaultValue;
            }

            current = (current as ArrayAccessible)[segment];
        }

        return current;
    }

    /** Check if an item or items exist in an array using "dot" notation. */
    public static has(target: unknown, keys: string | Array<string>): boolean
    {
        const list = Util.arrayWrap(keys);

        if (!Arr.accessible(target) || list.isEmpty()) {
            return false;
        }

        for (const key of list) {
            if (Arr.exists(target, key)) {
                continue;
            }

            let current: unknown = target;

            for (const segment of key.split('.')) {
                if (!Arr.accessible(current) || !Arr.exists(current, segment)) {
                    return false;
                }

                current = (current as ArrayAccessible)[segment];
            }
        }

        return true;
    }

    /** Determine if all keys exist in an array using "dot" notation. */
    public static hasAll(target: unknown, keys: string | Array<string>): boolean
    {
        const list = Util.arrayWrap(keys);

        if (!Arr.accessible(target) || list.isEmpty()) {
            return false;
        }

        for (const key of list) {
            if (!Arr.has(target, key)) {
                return false;
            }
        }

        return true;
    }

    /** Determine if any of the keys exist in an array using "dot" notation. */
    public static hasAny(target: unknown, keys: string | Array<string>): boolean
    {
        const list = Util.arrayWrap(keys);

        if (!Arr.accessible(target) || list.isEmpty()) {
            return false;
        }

        for (const key of list) {
            if (Arr.has(target, key)) {
                return true;
            }
        }

        return false;
    }

    /** Set an array item to a given value using "dot" notation. */
    public static set(target: ArrayAccessible, key: string, value: unknown): ArrayAccessible
    {
        const segments = key.split('.');
        let current = target;

        while (segments.size() > 1) {
            const segment = segments.remove(0) as string;

            // If the key doesn't exist at this depth, we will just create an empty
            // array to hold the next value, allowing us to create the arrays to hold
            // final values at the correct depth. Then we'll keep digging into it.
            if (!Arr.accessible(current[segment])) {
                current[segment] = {} as ArrayAccessible;
            }

            current = current[segment] as ArrayAccessible;
        }

        current[segments[0]] = value;

        return target;
    }

    /** Add an element to an array using "dot" notation if it doesn't exist. */
    public static add(target: ArrayAccessible, key: string, value: unknown): ArrayAccessible
    {
        if (Arr.get(target, key) === undefined) {
            Arr.set(target, key, value);
        }

        return target;
    }

    /** Push an item into an array using "dot" notation. */
    public static push(target: ArrayAccessible, key: string, ...values: Array<defined>): ArrayAccessible
    {
        const list = (Arr.get(target, key, []) ?? []) as Array<defined>;

        for (const value of values) {
            list.push(value);
        }

        return Arr.set(target, key, list);
    }

    /** Remove one or many array items from a given array using "dot" notation. */
    public static forget(target: ArrayAccessible, keys: string | Array<string>): void
    {
        for (const key of Util.arrayWrap(keys)) {
            if (Arr.exists(target, key)) {
                delete target[key];

                continue;
            }

            const segments = key.split('.');
            let current = target;
            let missing = false;

            while (segments.size() > 1) {
                const segment = segments.remove(0) as string;

                if (!Arr.accessible(current[segment])) {
                    missing = true;

                    break;
                }

                current = current[segment] as ArrayAccessible;
            }

            if (!missing) {
                delete current[segments[0]];
            }
        }
    }

    /** Get a value from the array, and remove it. */
    public static pull(target: ArrayAccessible, key: string, defaultValue?: unknown): unknown
    {
        const value = Arr.get(target, key, defaultValue);

        Arr.forget(target, key);

        return value;
    }

    /** Get a subset of the items from the given array. */
    public static only(target: ArrayAccessible, keys: string | Array<string>): ArrayAccessible
    {
        const wanted = Util.arrayWrap(keys);
        const result: ArrayAccessible = {};

        for (const key of wanted) {
            if (Arr.exists(target, key)) {
                result[key] = target[key];
            }
        }

        return result;
    }

    /** Get all of the given array except for a specified array of keys. */
    public static except(target: ArrayAccessible, keys: string | Array<string>): ArrayAccessible
    {
        const result: ArrayAccessible = {};
        const unwanted = Util.arrayWrap(keys);

        for (const [key, value] of pairs(target)) {
            if (!unwanted.includes(key as string)) {
                result[key as string] = value;
            }
        }

        // PHP takes `$array` by value, so the `Arr::forget()` below cannot
        // reach the caller's data at any depth. The copy above is shallow and
        // a Luau table is a reference, so every table a dotted key descends
        // through is copied too -- the same branch PHP's copy-on-write would
        // have separated.
        for (const key of unwanted) {
            Arr.detachPath(result, key);
        }

        Arr.forget(result, unwanted);

        return result;
    }

    /**
     * Replace each table a dotted key descends through with a shallow copy of
     * itself, so that removing the key cannot touch the original.
     */
    private static detachPath(target: ArrayAccessible, key: string): void
    {
        const segments = key.split('.');
        let current = target;

        for (let index = 0; index < segments.size() - 1; index++) {
            const segment = segments[index];
            const nested = current[segment];

            if (!Arr.accessible(nested)) {
                return;
            }

            const copy = table.clone(nested as ArrayAccessible);

            current[segment] = copy;
            current = copy;
        }
    }

    /** Prepend the key names of an associative array. */
    public static prependKeysWith(target: ArrayAccessible, prependWith: string): ArrayAccessible
    {
        const result: ArrayAccessible = {};

        for (const [key, value] of pairs(target)) {
            result[`${prependWith}${key}`] = value;
        }

        return result;
    }

    /** Flatten a multi-dimensional associative array with dots. */
    public static dot(target: ArrayAccessible, prepend = '', depth = math.huge): ArrayAccessible
    {
        const results: ArrayAccessible = {};

        const flatten = (data: ArrayAccessible, prefix: string, currentDepth: number): void => {
            for (const [key, value] of pairs(data)) {
                const newKey = `${prefix}${key}`;

                const nested = Arr.accessible(value) && currentDepth < depth ? (value as ArrayAccessible) : undefined;

                if (nested !== undefined && !Arr.isEmptyTable(nested)) {
                    flatten(nested, `${newKey}.`, currentDepth + 1);
                } else {
                    results[newKey] = value;
                }
            }
        };

        flatten(target, prepend, 0);

        return results;
    }

    /** Convert a flattened "dot" notation array into an expanded array. */
    public static undot(target: ArrayAccessible): ArrayAccessible
    {
        const results: ArrayAccessible = {};

        for (const [key, value] of pairs(target)) {
            Arr.set(results, key as string, value);
        }

        return results;
    }

    /** Determine if an array is associative. */
    public static isAssoc(target: ArrayAccessible): boolean
    {
        return !Arr.isList(target);
    }

    /** Determine if an array is a list: sequential integer keys from the start. */
    public static isList(target: unknown): boolean
    {
        if (!Arr.accessible(target)) {
            return false;
        }

        let expected = 1;

        for (const [key] of pairs(target as object)) {
            if (!typeIs(key, 'number') || key !== expected) {
                return false;
            }

            expected += 1;
        }

        return true;
    }

    // -----------------------------------------------------------------
    // Typed access
    // -----------------------------------------------------------------

    /** Get a string item from an array using "dot" notation. */
    public static string(target: unknown, key: string, defaultValue?: string): string
    {
        const value = Arr.get(target, key, defaultValue);

        if (!typeIs(value, 'string')) {
            throw new InvalidArgumentException(
                `Array value for key [${key}] must be a string, ${typeOf(value)} found.`,
            );
        }

        return value;
    }

    /** Get an integer item from an array using "dot" notation. */
    public static integer(target: unknown, key: string, defaultValue?: number): number
    {
        const value = Arr.get(target, key, defaultValue);

        if (!typeIs(value, 'number') || math.floor(value) !== value) {
            throw new InvalidArgumentException(
                `Array value for key [${key}] must be an integer, ${typeOf(value)} found.`,
            );
        }

        return value;
    }

    /** Get a boolean item from an array using "dot" notation. */
    public static boolean(target: unknown, key: string, defaultValue?: boolean): boolean
    {
        const value = Arr.get(target, key, defaultValue);

        if (!typeIs(value, 'boolean')) {
            throw new InvalidArgumentException(
                `Array value for key [${key}] must be a boolean, ${typeOf(value)} found.`,
            );
        }

        return value;
    }

    /** Get an array item from an array using "dot" notation. */
    public static array(target: unknown, key: string, defaultValue?: Array<defined>): Array<defined>
    {
        const value = Arr.get(target, key, defaultValue);

        if (!Arr.accessible(value)) {
            throw new InvalidArgumentException(
                `Array value for key [${key}] must be an array, ${typeOf(value)} found.`,
            );
        }

        return value as unknown as Array<defined>;
    }

    // -----------------------------------------------------------------
    // Sequences
    // -----------------------------------------------------------------

    /** Return the first element in an array passing a given truth test. */
    public static first<T extends defined>(
        list: Array<T>,
        callback?: ArrCallback<T, boolean>,
        defaultValue?: T,
    ): T | undefined
    {
        for (let index = 0; index < list.size(); index++) {
            if (callback === undefined || callback(list[index], index)) {
                return list[index];
            }
        }

        return defaultValue;
    }

    /** Return the last element in an array passing a given truth test. */
    public static last<T extends defined>(
        list: Array<T>,
        callback?: ArrCallback<T, boolean>,
        defaultValue?: T,
    ): T | undefined
    {
        for (let index = list.size() - 1; index >= 0; index--) {
            if (callback === undefined || callback(list[index], index)) {
                return list[index];
            }
        }

        return defaultValue;
    }

    /** Get the first item, but only if exactly one item matches. */
    public static sole<T extends defined>(list: Array<T>, callback?: ArrCallback<T, boolean>): T
    {
        const matched = callback === undefined ? list : Arr.where(list, callback);

        if (matched.isEmpty()) {
            throw new ItemNotFoundException('No items were found.');
        }

        if (matched.size() > 1) {
            throw new MultipleItemsFoundException(`${matched.size()} items were found.`);
        }

        return matched[0];
    }

    /** Take the first or last given number of items from an array. */
    public static take<T extends defined>(list: Array<T>, limit: number): Array<T>
    {
        if (limit < 0) {
            return Arr.slice(list, math.max(list.size() + limit, 0), -limit);
        }

        return Arr.slice(list, 0, limit);
    }

    /** Determine if all items pass the given truth test. */
    public static every<T extends defined>(list: Array<T>, callback: ArrCallback<T, boolean>): boolean
    {
        for (let index = 0; index < list.size(); index++) {
            if (!callback(list[index], index)) {
                return false;
            }
        }

        return true;
    }

    /** Determine if some items pass the given truth test. */
    public static some<T extends defined>(list: Array<T>, callback: ArrCallback<T, boolean>): boolean
    {
        for (let index = 0; index < list.size(); index++) {
            if (callback(list[index], index)) {
                return true;
            }
        }

        return false;
    }

    /** Filter the array using the given callback. */
    public static where<T extends defined>(list: Array<T>, callback: ArrCallback<T, boolean>): Array<T>
    {
        const result = new Array<T>();

        for (let index = 0; index < list.size(); index++) {
            if (callback(list[index], index)) {
                result.push(list[index]);
            }
        }

        return result;
    }

    /** Filter the array using the negation of the given callback. */
    public static reject<T extends defined>(list: Array<T>, callback: ArrCallback<T, boolean>): Array<T>
    {
        return Arr.where(list, (value, key) => !callback(value, key));
    }

    /** Filter items where the value is not null. */
    public static whereNotNull<T extends defined>(list: Array<T | undefined>): Array<T>
    {
        const result = new Array<T>();

        for (const value of list) {
            if (value !== undefined) {
                result.push(value);
            }
        }

        return result;
    }

    /** Partition the array into two arrays using the given callback. */
    public static partition<T extends defined>(
        list: Array<T>,
        callback: ArrCallback<T, boolean>,
    ): [Array<T>, Array<T>]
    {
        const passed = new Array<T>();
        const failed = new Array<T>();

        for (let index = 0; index < list.size(); index++) {
            if (callback(list[index], index)) {
                passed.push(list[index]);
            } else {
                failed.push(list[index]);
            }
        }

        return [
            passed,
            failed,
        ];
    }

    /** Run a map over each of the items in the array. */
    public static map<T extends defined, TResult extends defined>(
        list: Array<T>,
        callback: ArrCallback<T, TResult>,
    ): Array<TResult>
    {
        const result = new Array<TResult>();

        for (let index = 0; index < list.size(); index++) {
            result.push(callback(list[index], index));
        }

        return result;
    }

    /** Run an associative map over each of the items. */
    public static mapWithKeys<T extends defined>(
        list: Array<T>,
        callback: ArrCallback<T, [string, unknown]>,
    ): ArrayAccessible
    {
        const result: ArrayAccessible = {};

        for (let index = 0; index < list.size(); index++) {
            const [key, value] = callback(list[index], index);

            result[key] = value;
        }

        return result;
    }

    /** Run a map over each nested chunk of items. */
    public static mapSpread<TResult extends defined>(list: Array<Array<defined>>, callback: Callback): Array<TResult>
    {
        return Arr.map(list, (chunk, key) => {
            const args = table.clone(chunk);

            args.push(key);

            return callback(...args) as TResult;
        });
    }

    /** Key an array by a field or using a callback. */
    public static keyBy<T extends defined>(list: Array<T>, keyBy: string | ArrCallback<T, string>): ArrayAccessible
    {
        const result: ArrayAccessible = {};

        for (let index = 0; index < list.size(); index++) {
            const value = list[index];
            const key = typeIs(keyBy, 'function')
                ? (keyBy as ArrCallback<T, string>)(value, index)
                : tostring(Arr.get(value, keyBy as string));

            result[key] = value;
        }

        return result;
    }

    /**
     * Pluck an array of values from an array.
     *
     * PHP also keys the result when a second argument is given; that produces an
     * ordered map, so it lives on `Collection::pluck` instead.
     */
    public static pluck<T extends defined>(list: Array<T>, value: string): Array<defined>
    {
        const result = new Array<defined>();

        for (const item of list) {
            const plucked = Arr.get(item, value);

            if (plucked !== undefined) {
                result.push(plucked as defined);
            }
        }

        return result;
    }

    /** Select an array of values from an array of tables. */
    public static select<T extends defined>(list: Array<T>, keys: string | Array<string>): Array<ArrayAccessible>
    {
        const wanted = Util.arrayWrap(keys);

        return Arr.map(list, (item) => {
            const result: ArrayAccessible = {};

            for (const key of wanted) {
                if (Arr.exists(item, key)) {
                    result[key] = (item as unknown as ArrayAccessible)[key];
                }
            }

            return result;
        });
    }

    /** Get a subset of the items from the given array by value. */
    public static onlyValues<T extends defined>(list: Array<T>, values: T | Array<T>): Array<T>
    {
        const wanted = Util.arrayWrap(values);

        return Arr.where(list, (value) => wanted.includes(value));
    }

    /** Get all of the given array except for a specified array of values. */
    public static exceptValues<T extends defined>(list: Array<T>, values: T | Array<T>): Array<T>
    {
        const unwanted = Util.arrayWrap(values);

        return Arr.where(list, (value) => !unwanted.includes(value));
    }

    /** Push an item onto the beginning of an array. */
    public static prepend<T extends defined>(list: Array<T>, value: T): Array<T>
    {
        const result = table.clone(list);

        result.unshift(value);

        return result;
    }

    /** Collapse an array of arrays into a single array. */
    public static collapse(list: Array<defined>): Array<defined>
    {
        const result = new Array<defined>();

        for (const values of list) {
            if (Util.isArray(values)) {
                for (const value of values as Array<defined>) {
                    result.push(value);
                }
            }
        }

        return result;
    }

    /** Flatten a multi-dimensional array into a single level. */
    public static flatten(list: Array<defined>, depth = math.huge): Array<defined>
    {
        const result = new Array<defined>();

        for (const item of list) {
            if (!Util.isArray(item)) {
                result.push(item);

                continue;
            }

            const values = depth === 1 ? (item as Array<defined>) : Arr.flatten(item as Array<defined>, depth - 1);

            for (const value of values) {
                result.push(value);
            }
        }

        return result;
    }

    /** Cross join the given arrays, returning all possible permutations. */
    public static crossJoin(...arrays: Array<Array<defined>>): Array<Array<defined>>
    {
        let results: Array<Array<defined>> = [[]];

        for (const list of arrays) {
            const append = new Array<Array<defined>>();

            for (const product of results) {
                for (const item of list) {
                    const combined = table.clone(product);

                    combined.push(item);
                    append.push(combined);
                }
            }

            results = append;
        }

        return results;
    }

    /** Divide an array into two arrays: one of keys, one of values. */
    public static divide(target: ArrayAccessible): [Array<string>, Array<defined>]
    {
        const keys = new Array<string>();
        const values = new Array<defined>();

        for (const [key, value] of pairs(target)) {
            keys.push(key as string);
            values.push(value as defined);
        }

        return [
            keys,
            values,
        ];
    }

    /** Join all items using a string, with a separate glue for the final item. */
    public static join(list: Array<defined>, glue: string, finalGlue = ''): string
    {
        if (finalGlue === '') {
            return list.map((value) => tostring(value)).join(glue);
        }

        if (list.isEmpty()) {
            return '';
        }

        if (list.size() === 1) {
            return tostring(list[0]);
        }

        const parts = table.clone(list);
        const finalItem = parts.pop() as defined;

        return `${parts.map((value) => tostring(value)).join(glue)}${finalGlue}${tostring(finalItem)}`;
    }

    /** Get one or a specified number of random values from an array. */
    public static random<T extends defined>(list: Array<T>, count?: number): T | Array<T> | undefined
    {
        const requested = count ?? 1;

        if (requested > list.size()) {
            throw new InvalidArgumentException(
                `You requested ${requested} items, but there are only ${list.size()} items available.`,
            );
        }

        if (list.isEmpty() || (count !== undefined && count <= 0)) {
            return count === undefined ? undefined : [];
        }

        const shuffled = Arr.shuffle(list);

        if (count === undefined) {
            return shuffled[0];
        }

        return Arr.take(shuffled, requested);
    }

    /** Merge the given arrays into one, in order. */
    public static merge<T>(...lists: Array<Array<T>>): Array<T>
    {
        const merged = new Array<T>();

        for (const list of lists) {
            for (let position = 0; position < list.size(); position++) {
                merged[merged.size()] = list[position];
            }
        }

        return merged;
    }

    /** Pad the array to the given size with a value. */
    public static pad<T extends defined>(list: Array<T>, size: number, value?: T): Array<T>
    {
        const count = math.abs(size);

        if (list.size() >= count || value === undefined) {
            return list;
        }

        const padded = new Array<T>(count);

        if (size < 0) {
            for (let index = list.size(); index < count; index++) {
                padded.push(value);
            }
        }

        for (const item of list) {
            padded.push(item);
        }

        if (size > 0) {
            for (let index = list.size(); index < count; index++) {
                padded.push(value);
            }
        }

        return padded;
    }

    /** Reverse the given array. */
    public static reverse<T extends defined>(list: Array<T>): Array<T>
    {
        const reversed = new Array<T>(list.size());

        for (let index = list.size() - 1; index >= 0; index--) {
            reversed.push(list[index]);
        }

        return reversed;
    }

    /** Shuffle the given array and return the result. */
    public static shuffle<T extends defined>(list: Array<T>): Array<T>
    {
        const result = table.clone(list);

        for (let index = result.size() - 1; index > 0; index--) {
            const swap = math.random(0, index);
            const held = result[index];

            result[index] = result[swap];
            result[swap] = held;
        }

        return result;
    }

    /** Sort the array using the given callback or "dot" notation. */
    public static sort<T extends defined>(
        list: Array<T>,
        callback?: string | ArrCallback<T, defined>,
        descending = false,
    ): Array<T>
    {
        const result = table.clone(list);

        const resolve = (value: T, index: number): defined =>
            callback === undefined
                ? (value as defined)
                : typeIs(callback, 'function')
                ? (callback as ArrCallback<T, defined>)(value, index)
                : (Arr.get(value, callback as string) as defined);

        result.sort((first, second) => {
            const order = Arr.compare(resolve(first, 0), resolve(second, 0));

            return descending ? order > 0 : order < 0;
        });

        return result;
    }

    /** Sort the array in descending order. */
    public static sortDesc<T extends defined>(list: Array<T>, callback?: string | ArrCallback<T, defined>): Array<T>
    {
        return Arr.sort(list, callback, true);
    }

    /** Recursively sort an array by keys and values. */
    public static sortRecursive(list: Array<defined>, descending = false): Array<defined>
    {
        const sorted = Arr.sort(list, undefined, descending);

        return Arr.map(
            sorted,
            (value) => Util.isArray(value) ? Arr.sortRecursive(value as Array<defined>, descending) : value,
        );
    }

    /** Recursively sort an array by keys and values in descending order. */
    public static sortRecursiveDesc(list: Array<defined>): Array<defined>
    {
        return Arr.sortRecursive(list, true);
    }

    /** Get the underlying array of items from the given argument. */
    public static from(items: unknown): Array<defined>
    {
        if (Util.isArray(items)) {
            return items as Array<defined>;
        }

        if (typeIs(items, 'table') && typeIs((items as { all?: unknown; }).all, 'function')) {
            return ((items as { all: Callback; }).all as Callback)(items) as Array<defined>;
        }

        throw new InvalidArgumentException('Items cannot be represented by a scalar value.');
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /** Take `length` items starting at `start`. */
    private static slice<T extends defined>(list: Array<T>, start: number, length: number): Array<T>
    {
        const result = new Array<T>();

        for (let index = start; index < math.min(start + length, list.size()); index++) {
            result.push(list[index]);
        }

        return result;
    }

    /** Determine whether a table holds no entries at all. */
    private static isEmptyTable(target: object): boolean
    {
        const [key] = next(target);

        return key === undefined;
    }

    /** Compare two values, ordering numbers and strings naturally. */
    private static compare(first: unknown, second: unknown): number
    {
        if (typeIs(first, 'number') && typeIs(second, 'number')) {
            return first - second;
        }

        // PHP orders two arrays by size first and then entry by entry, which
        // is what `sort()` with no callback leans on. Falling through to
        // `tostring()` here would compare table *addresses* instead, and put
        // `Arr::sort([['name' => 'Desk'], ['name' => 'Chair']])` in whatever
        // order the allocator happened to produce.
        if (typeIs(first, 'table') && typeIs(second, 'table')) {
            return Arr.compareTables(first, second);
        }

        const firstText = tostring(first);
        const secondText = tostring(second);

        if (firstText === secondText) {
            return 0;
        }

        return firstText < secondText ? -1 : 1;
    }

    /**
     * Order two tables the way PHP orders two arrays: the shorter one first,
     * then entry by entry.
     *
     * `pairs()` does not define an order, so the walk below only settles a
     * pair whose keys line up -- which is the same ground PHP's own
     * element-wise comparison covers, since it looks the left operand's keys
     * up in the right one rather than pairing them off positionally.
     */
    private static compareTables(first: object, second: object): number
    {
        let firstCount = 0;
        let secondCount = 0;

        for (const [] of pairs(first)) {
            firstCount += 1;
        }

        for (const [] of pairs(second)) {
            secondCount += 1;
        }

        if (firstCount !== secondCount) {
            return firstCount < secondCount ? -1 : 1;
        }

        for (const [key, value] of pairs(first)) {
            const other = (second as Record<string, unknown>)[key as string];

            // PHP calls a pair whose keys do not line up "uncomparable" and
            // leaves the left one after the right.
            if (other === undefined) {
                return 1;
            }

            const order = Arr.compare(value, other);

            if (order !== 0) {
                return order;
            }
        }

        return 0;
    }
}
