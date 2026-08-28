import type { Abstract } from 'Illuminate/Container/Types';
import type { ParameterAttribute, ParameterDependency } from 'Illuminate/Container/Attributes/Inject';

/**
 * @internal
 */
export class Util
{
    /**
     * Distinguish a list from a single value.
     *
     * A class and an array are both Luau tables, so the two are told apart by
     * length: a compiled class is a hash-only table and reports zero. An empty
     * array is therefore indistinguishable from a class and counts as a single
     * value -- passing one where a list is expected is meaningless anyway.
     */
    public static isArray(value: unknown): value is Array<defined>
    {
        return typeIs(value, 'table') && (value as Array<defined>).size() > 0;
    }

    /**
     * If the given value is not an array and not null, wrap it in one.
     *
     * From `Arr::wrap()` in Illuminate\Support.
     */
    public static arrayWrap<T extends defined>(value: T | Array<T> | undefined): Array<T>
    {
        if (value === undefined) {
            return [];
        }

        if (!typeIs(value, 'table')) {
            return [value as T];
        }

        if (Util.isArray(value)) {
            return value as Array<T>;
        }

        // `isArray()` reports false for an empty table, which is right for a
        // class instance and wrong for an empty list -- and `Arr::wrap([])` is
        // `[]` upstream, not `[[]]`.
        return Util.isEmptyArray(value) ? [] : [value as T];
    }

    /**
     * Whether a value is the empty list.
     *
     * `isArray()` cannot answer this: it tells a list from a single value by
     * length, so an empty list and a class instance both report zero. A
     * compiled class always carries a metatable and an object literal always
     * carries entries, so a table with neither is the empty list.
     */
    public static isEmptyArray(value: unknown): boolean
    {
        if (!typeIs(value, 'table') || getmetatable(value as object) !== undefined) {
            return false;
        }

        for (const [] of pairs(value as unknown as Record<string, unknown>)) {
            return false;
        }

        return true;
    }

    /**
     * Return the default value of the given value.
     *
     * From the global `value()` helper in Illuminate\Support.
     */
    public static unwrapIfClosure(value: unknown, ...args: Array<unknown>): unknown
    {
        return typeIs(value, 'function') ? (value as Callback)(...args) : value;
    }

    /**
     * Get the first contextual attribute applied to a dependency.
     *
     * PHP: `$dependency->getAttributes(ContextualAttribute::class, IS_INSTANCEOF)[0]`.
     * Every attribute recorded against a parameter is contextual by
     * construction, so the first one wins.
     */
    public static getContextualAttributeFromDependency(
        dependency: ParameterDependency,
    ): ParameterAttribute | undefined
    {
        return dependency.attributes[0];
    }

    /** True when the abstract is a class rather than a plain string key. */
    public static isClass(abstract: Abstract): boolean
    {
        return typeIs(abstract, 'table');
    }

    /**
     * PHP truthiness, as every bare `if ($value)` in the framework means it.
     *
     * PHP counts `null`, `false`, `0`, `0.0`, `""`, `"0"` and `[]` as false.
     * The empty array cannot be told from an object here -- both are tables
     * with nothing in the array part -- so a table is always truthy, which is
     * the same call `Util.isArray` makes.
     */
    public static truthy(value: unknown): boolean
    {
        if (typeIs(value, 'boolean')) {
            return value;
        }

        if (typeIs(value, 'number')) {
            return value !== 0;
        }

        if (typeIs(value, 'string')) {
            return value !== '' && value !== '0';
        }

        return value !== undefined;
    }
}
