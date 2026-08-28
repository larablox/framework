/**
 * The handful of reflection primitives the container needs, expressed against
 * the object model roblox-ts emits.
 *
 * A compiled class is a table whose metatable carries `__tostring` (returning
 * the class name) and `__index` (pointing at the superclass); an instance is a
 * table whose metatable is its class. That is enough for name lookups and for
 * the `instanceof` / `is_subclass_of` checks Laravel performs, but not for
 * anything resembling `ReflectionParameter` -- constructor and method
 * signatures are erased, which is why dependencies are declared with `Inject`.
 */
export class Reflector
{
    /** PHP: `get_class($instance)`. */
    public static classOf(instance: object): object | undefined
    {
        return getmetatable(instance) as object | undefined;
    }

    /**
     * PHP: `(new ReflectionClass($target))->getName()`.
     *
     * An abstract class that extends nothing is compiled to a bare table with
     * no metatable and therefore has no name to report; it renders as its
     * table address.
     */
    public static className(target: unknown): string
    {
        return tostring(target);
    }

    /** The superclass of a compiled class, or `undefined` for a root class. */
    public static parentClass(target: object): object | undefined
    {
        const metatable = getmetatable(target) as { __index?: object; } | undefined;

        return metatable?.__index;
    }

    /** PHP: `is_a($target, $parent, true)` -- true when the classes are equal. */
    public static isSubclassOf(target: unknown, parent: unknown): boolean
    {
        if (!typeIs(target, 'table') || !typeIs(parent, 'table')) {
            return false;
        }

        let current: object | undefined = target;

        while (current !== undefined) {
            if (current === parent) {
                return true;
            }

            current = Reflector.parentClass(current);
        }

        return false;
    }

    /**
     * Tell a class table apart from an instance of one.
     *
     * roblox-ts points an instance's metatable at its class, and a class sets
     * `__index` on itself; a class table's own metatable is the descriptor
     * holding `__tostring` and the superclass, whose `__index` is the parent.
     * So `__index === metatable` holds for instances only.
     */
    public static isInstance(value: unknown): boolean
    {
        if (!typeIs(value, 'table')) {
            return false;
        }

        const metatable = getmetatable(value) as object | undefined;

        return metatable !== undefined && rawget(metatable, '__index') === metatable;
    }

    /** PHP: `$value instanceof $class`. */
    public static isInstanceOf(value: unknown, klass: unknown): boolean
    {
        if (!Reflector.isInstance(value)) {
            return false;
        }

        return Reflector.isSubclassOf(Reflector.classOf(value as object), klass);
    }
}
