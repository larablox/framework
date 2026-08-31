/**
 * Call the value with the given arguments -- PHP's `$callable(...$args)`.
 *
 * A value that is not callable raises, exactly as PHP's would.
 */
export function call(callable: unknown, ...args: Array<unknown>): unknown
{
    return (callable as Callback)(...(args as Array<never>));
}

/**
 * Whether the target has the given method -- PHP's `method_exists`, where a
 * method here is a function-valued field, reached through `__index`.
 */
export function methodExists(target: unknown, method: string): boolean
{
    return typeIs(target, 'table') && typeIs((target as Record<string, unknown>)[method], 'function');
}

/** Call the target's method by name -- PHP's `$target->{$method}(...$args)`. */
export function callMethod(target: unknown, method: string, ...args: Array<unknown>): unknown
{
    return call((target as Record<string, unknown>)[method], target, ...args);
}

/**
 * Whether the value is callable: a function, or a table with a `__call`
 * metamethod -- PHP's `is_callable`, where `__call` is what PHP spells
 * `__invoke`.
 */
export function isCallable(value: unknown): boolean
{
    if (typeIs(value, 'function')) {
        return true;
    }

    if (!typeIs(value, 'table')) {
        return false;
    }

    const metatable = getmetatable(value as object);

    return typeIs(metatable, 'table') && typeIs(rawget(metatable, '__call'), 'function');
}
