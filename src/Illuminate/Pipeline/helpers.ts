import { Util } from 'Illuminate/Container/Util';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Pipe, PipeWithParameters } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * Whether the value is one `[Abstract, ...arguments]` pipe rather than a list
 * of pipes.
 *
 * PHP never has to ask: there a parameterized pipe is the single string
 * `"Throttle:60,1"`, and an array is always a list. A class is not a string
 * here, so its arguments travel beside it in a list -- which is the very same
 * shape as a list of two pipes.
 *
 * The two are told apart the way they are actually written. A parameterized
 * pipe leads with the class to resolve and carries strings after it; a list
 * that leads with a string is a list of binding names, and a binding name
 * still spells its own arguments inline, exactly as PHP does.
 */
export function isPipeWithParameters(value: unknown): value is PipeWithParameters
{
    if (!Util.isArray(value)) {
        return false;
    }

    const list = value as Array<unknown>;

    return list.size() > 1 && !typeIs(list[0], 'string') && typeIs(list[1], 'string');
}

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
 * metamethod -- `is_callable` for a pipe, where `__call` is what PHP spells
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

/**
 * Whether the value is a list of pipes -- the question `is_array($pipes)`
 * answers in `through()` and `pipe()`. Two platform wrinkles: a parameterized
 * pipe is itself a list here (see `isPipeWithParameters`), and `Util.isArray`
 * tells a list from a single value by length, so the empty list has to be
 * recognized on its own.
 */
export function isPipeArray(value: unknown): value is Array<Pipe>
{
    return (Util.isArray(value) || Util.isEmptyArray(value)) && !isPipeWithParameters(value);
}

/**
 * Split a non-string pipe into what to resolve and the arguments it carries.
 *
 * The port's half of `Pipeline.parsePipeString()`: PHP spells both inside one
 * string (`'Class:60,1'`), a class here is not a string, so its arguments
 * travel beside it in a list -- the class first, its arguments after.
 */
export function splitPipe(pipe: Pipe): [Abstract, Array<string>]
{
    if (!Util.isArray(pipe)) {
        return [
            pipe as Abstract,
            [],
        ];
    }

    const list = pipe as Array<defined>;
    const parameters = new Array<string>();

    for (let index = 1; index < list.size(); index++) {
        parameters.push(list[index] as string);
    }

    return [
        list[0] as Abstract,
        parameters,
    ];
}

/** Read a `Pipe | Array<Pipe>` argument as a list of pipes. */
export function wrapPipes(pipes: Pipe | Array<Pipe>): Array<Pipe>
{
    if (isPipeWithParameters(pipes)) {
        return [pipes as Pipe];
    }

    return Util.arrayWrap(pipes as Pipe) as Array<Pipe>;
}
