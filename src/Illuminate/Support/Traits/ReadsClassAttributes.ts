import { Attributes } from "Illuminate/Container/Attributes/Attributes";
import { Reflector } from "Illuminate/Support/Reflector";

/**
 * PHP: `Illuminate\Support\Traits\ReadsClassAttributes`.
 *
 * A trait in PHP; static here, as every ported trait is.
 *
 * `getAttributeValue()` in PHP compares the instance property against the class
 * default before preferring it, so that an untouched property does not shadow
 * the attribute. There are no class defaults to compare against: roblox-ts
 * assigns them inside the constructor, not onto the class table, so a property
 * that is set at all wins.
 */
export class ReadsClassAttributes {
    /** Get a configuration value from an attribute, falling back to a property. */
    public static getAttributeValue(
        target: object,
        attribute: Callback,
        property?: string,
        dflt?: unknown,
    ): unknown {
        const value =
            property !== undefined
                ? (target as Record<string, unknown>)[property]
                : undefined;

        if (value !== undefined && !typeIs(value, "function")) {
            return value;
        }

        const instance = ReadsClassAttributes.getAttributeInstance(
            target,
            attribute,
        );

        if (instance !== undefined) {
            return ReadsClassAttributes.extractAttributeValue(instance);
        }

        return dflt;
    }

    /**
     * Extract the value from an attribute instance.
     *
     * PHP takes the first of `get_object_vars()`, which is the first declared
     * property; `next()` over a Luau table is only well defined for a single
     * entry, which every ported queue attribute has.
     */
    protected static extractAttributeValue(instance: object): unknown {
        const [, value] = next(instance);

        return value === undefined ? true : value;
    }

    /** Get an instance of the given attribute class from the target class or its parents. */
    protected static getAttributeInstance(
        target: object,
        attribute: Callback,
    ): object | undefined {
        let current: object | undefined = Reflector.classOf(target) ?? target;

        while (current !== undefined) {
            const found = Attributes.get<object>(current, attribute);

            if (found.size() > 0) {
                return found[0];
            }

            current = Reflector.parentClass(current);
        }

        return undefined;
    }
}
