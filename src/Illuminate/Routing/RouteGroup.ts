import { Str } from 'Illuminate/Support/Str';
import type { ActionAttributes } from 'Illuminate/Routing/RouteAction';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Routing\RouteGroup`.
 *
 * `namespace` and `domain` are not merged: neither exists here. What is left
 * follows PHP exactly -- names concatenate, prefixes join with a slash,
 * `where` clauses merge, middleware lists append (PHP gets that from
 * `array_merge_recursive`), and a `controller` set by the inner group replaces
 * the outer one.
 */
export class RouteGroup
{
    /** Merge route groups into a new array. */
    public static merge(
        attributes: ActionAttributes,
        old: ActionAttributes,
        prependExistingPrefix = true,
    ): ActionAttributes
    {
        const merged: ActionAttributes = {
            ...old,
            ...attributes,
            as: RouteGroup.formatAs(attributes, old),
            prefix: RouteGroup.formatPrefix(attributes, old, prependExistingPrefix),
            where: RouteGroup.formatWhere(attributes, old),
        };

        const middleware = RouteGroup.formatMiddleware(attributes.middleware, old.middleware);

        if (middleware !== undefined) {
            merged.middleware = middleware;
        }

        const excluded = RouteGroup.formatMiddleware(attributes.excluded_middleware, old.excluded_middleware);

        if (excluded !== undefined) {
            merged.excluded_middleware = excluded;
        }

        return merged;
    }

    /** Format the prefix for the new group attributes. */
    protected static formatPrefix(
        attributes: ActionAttributes,
        old: ActionAttributes,
        prependExistingPrefix: boolean,
    ): string | undefined
    {
        const previous = old.prefix ?? '';

        if (attributes.prefix === undefined) {
            return previous === '' ? undefined : previous;
        }

        return prependExistingPrefix
            ? `${Str.trim(previous, '/')}/${Str.trim(attributes.prefix, '/')}`
            : `${Str.trim(attributes.prefix, '/')}/${Str.trim(previous, '/')}`;
    }

    /** Format the "wheres" for the new group attributes. */
    protected static formatWhere(
        attributes: ActionAttributes,
        old: ActionAttributes,
    ): Record<string, string> | undefined
    {
        if (attributes.where === undefined && old.where === undefined) {
            return undefined;
        }

        return { ...(old.where ?? {}), ...(attributes.where ?? {}) };
    }

    /** Format the "as" clause of the new group attributes. */
    protected static formatAs(attributes: ActionAttributes, old: ActionAttributes): string | undefined
    {
        if (old.as === undefined) {
            return attributes.as;
        }

        return `${old.as}${attributes.as ?? ''}`;
    }

    /** Append one middleware list to another, keeping both. */
    protected static formatMiddleware(middleware?: Array<Pipe>, old?: Array<Pipe>): Array<Pipe> | undefined
    {
        if (middleware === undefined) {
            return old;
        }

        if (old === undefined) {
            return middleware;
        }

        const merged = table.clone(old);

        for (const entry of middleware) {
            merged.push(entry);
        }

        return merged;
    }
}
