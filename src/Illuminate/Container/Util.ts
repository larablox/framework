import type { Abstract } from "Illuminate/Container/Types";
import type {
    ParameterAttribute,
    ParameterDependency,
} from "Illuminate/Container/Attributes/Inject";

/**
 * @internal
 */
export class Util {
    /**
     * Distinguish a list from a single value.
     *
     * A class and an array are both Luau tables, so the two are told apart by
     * length: a compiled class is a hash-only table and reports zero. An empty
     * array is therefore indistinguishable from a class and counts as a single
     * value -- passing one where a list is expected is meaningless anyway.
     */
    public static isArray(value: unknown): value is Array<defined> {
        return typeIs(value, "table") && (value as Array<defined>).size() > 0;
    }

    /**
     * If the given value is not an array and not null, wrap it in one.
     *
     * From `Arr::wrap()` in Illuminate\Support.
     */
    public static arrayWrap<T extends defined>(
        value: T | Array<T> | undefined,
    ): Array<T> {
        if (value === undefined) {
            return [];
        }

        return Util.isArray(value) ? (value as Array<T>) : [value as T];
    }

    /**
     * Return the default value of the given value.
     *
     * From the global `value()` helper in Illuminate\Support.
     */
    public static unwrapIfClosure(
        value: unknown,
        ...args: Array<unknown>
    ): unknown {
        return typeIs(value, "function") ? (value as Callback)(...args) : value;
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
    ): ParameterAttribute | undefined {
        return dependency.attributes[0];
    }

    /** True when the abstract is a class rather than a plain string key. */
    public static isClass(abstract: Abstract): boolean {
        return typeIs(abstract, "table");
    }

    /**
     * PHP truthiness, as every bare `if ($value)` in the framework means it.
     *
     * PHP counts `null`, `false`, `0`, `0.0`, `""`, `"0"` and `[]` as false.
     * The empty array cannot be told from an object here -- both are tables
     * with nothing in the array part -- so a table is always truthy, which is
     * the same call `Util.isArray` makes.
     */
    public static truthy(value: unknown): boolean {
        if (typeIs(value, "boolean")) {
            return value;
        }

        if (typeIs(value, "number")) {
            return value !== 0;
        }

        if (typeIs(value, "string")) {
            return value !== "" && value !== "0";
        }

        return value !== undefined;
    }
}
