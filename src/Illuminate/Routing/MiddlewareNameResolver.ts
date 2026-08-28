import { Str } from 'Illuminate/Support/Str';
import type { OrderedMap } from 'Illuminate/Support/OrderedMap';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Routing\MiddlewareNameResolver`.
 *
 * Only a string can be an alias or a group name. A class or a closure is
 * already the middleware itself and passes through, which is what PHP does
 * with a `Closure`.
 */
export class MiddlewareNameResolver
{
    /** Resolve the middleware name to a class name(s) preserving passed parameters. */
    public static resolve(
        name: Pipe,
        map: OrderedMap<string, Pipe>,
        middlewareGroups: OrderedMap<string, Array<Pipe>>,
    ): Pipe | Array<Pipe>
    {
        if (!typeIs(name, 'string')) {
            return name;
        }

        const aliased = map.get(name);

        if (aliased !== undefined && typeIs(aliased, 'function')) {
            return aliased;
        }

        if (middlewareGroups.has(name)) {
            return MiddlewareNameResolver.parseMiddlewareGroup(name, map, middlewareGroups);
        }

        const [alias, parameters] = MiddlewareNameResolver.split(name);
        const resolved = map.get(alias) ?? alias;

        if (parameters === undefined) {
            return resolved;
        }

        // PHP hands the pipeline `"Class:60,1"`, because a class *is* a string
        // there. An alias here usually maps to the class itself, which cannot
        // carry a suffix -- so the arguments travel beside it in a list, which
        // is the shape `Pipeline::parsePipeString()` reads.
        if (!typeIs(resolved, 'string')) {
            return [resolved, ...parameters.split(',')] as Pipe;
        }

        return `${resolved}:${parameters}`;
    }

    /** Parse the middleware group and format it for usage. */
    protected static parseMiddlewareGroup(
        name: string,
        map: OrderedMap<string, Pipe>,
        middlewareGroups: OrderedMap<string, Array<Pipe>>,
    ): Array<Pipe>
    {
        const results = new Array<Pipe>();

        for (const middleware of middlewareGroups.get(name) ?? []) {
            if (typeIs(middleware, 'string') && middlewareGroups.has(middleware)) {
                for (const nested of MiddlewareNameResolver.parseMiddlewareGroup(middleware, map, middlewareGroups)) {
                    results.push(nested);
                }

                continue;
            }

            // The group branch is taken above, so what comes back here is one
            // middleware and never a list.
            results.push(MiddlewareNameResolver.resolve(middleware, map, middlewareGroups) as Pipe);
        }

        return results;
    }

    /** PHP: `array_pad(explode(':', $name, 2), 2, null)`. */
    protected static split(name: string): [string, string | undefined]
    {
        if (!Str.contains(name, ':')) {
            return [name, undefined];
        }

        return [Str.before(name, ':'), Str.after(name, ':')];
    }
}
