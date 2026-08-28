/**
 * The class-attribute table.
 *
 * PHP attributes are read back off a `ReflectionClass`; nothing survives
 * compilation to Luau, so a decorator records its instance here and the
 * container reads it out again. An attribute type is identified by its
 * decorator factory, which stands in for the `Foo::class` argument PHP passes
 * to `ReflectionClass::getAttributes()`.
 *
 * Entries are keyed by the exact class they were applied to, so -- as in PHP --
 * attributes are never inherited by subclasses.
 */
const classAttributes = new Map<object, Array<[Callback, object]>>();

export class Attributes {
    /** Record an attribute instance against the class it decorates. */
    public static add(target: object, attribute: Callback, instance: object): void {
        let attributes = classAttributes.get(target);

        if (attributes === undefined) {
            attributes = new Array<[Callback, object]>();
            classAttributes.set(target, attributes);
        }

        attributes.push([attribute, instance]);
    }

    /** PHP: `(new ReflectionClass($target))->getAttributes($attribute)`. */
    public static get<T extends object>(target: unknown, attribute: Callback): Array<T> {
        if (!typeIs(target, "table")) {
            return [];
        }

        const attributes = classAttributes.get(target);

        if (attributes === undefined) {
            return [];
        }

        const found = new Array<T>();

        for (const [candidate, instance] of attributes) {
            if (candidate === attribute) {
                found.push(instance as T);
            }
        }

        return found;
    }

    /** PHP: `! empty($reflection->getAttributes($attribute))`. */
    public static has(target: unknown, attribute: Callback): boolean {
        return Attributes.get(target, attribute).size() > 0;
    }

    /** PHP: `(new ReflectionClass($target))->getAttributes()` with no filter. */
    public static all(target: unknown): Array<[Callback, object]> {
        if (!typeIs(target, "table")) {
            return [];
        }

        const attributes = classAttributes.get(target);

        return attributes === undefined ? [] : table.clone(attributes);
    }
}
