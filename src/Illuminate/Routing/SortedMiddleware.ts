import { Collection } from "Illuminate/Support/Collection";
import { Reflector } from "Illuminate/Support/Reflector";
import { Route } from "Illuminate/Routing/Route";
import { Str } from "Illuminate/Support/Str";
import { Util } from "Illuminate/Container/Util";
import type { Pipe } from "Illuminate/Contracts/Pipeline/Pipeline";

/**
 * PHP: `Illuminate\Routing\SortedMiddleware`.
 *
 * Sorts the gathered middleware by a priority list, one move per pass, exactly
 * as PHP does -- including the recursion, which is what makes each pass a
 * single discrete movement.
 *
 * PHP only considers entries that are strings, because a middleware is a class
 * *name* there. Here the same entry is the class itself, or that class with
 * its arguments beside it, so the check is "does it name a class or a binding"
 * rather than "is it a string"; a closure is skipped either way, as in PHP.
 *
 * PHP walks interfaces as well as parents when looking a middleware up in the
 * priority map. Interfaces leave no runtime trace here, so only the class
 * chain is walked -- which is why the priority list should name classes.
 */
export class SortedMiddleware extends Collection<number, Pipe> {
    /** Create a new sorted middleware container. */
    public constructor(priorityMap: Array<Pipe>, middleware: Array<Pipe>) {
        super(SortedMiddleware.sortMiddleware(priorityMap, middleware));
    }

    /** Sort the middleware by the given priority map. */
    protected static sortMiddleware(priorityMap: Array<Pipe>, middleware: Array<Pipe>): Array<Pipe> {
        let lastIndex = 0;
        let lastPriorityIndex: number | undefined;

        for (let index = 0; index < middleware.size(); index++) {
            const priorityIndex = SortedMiddleware.priorityMapIndex(priorityMap, middleware[index]);

            if (priorityIndex === undefined) {
                continue;
            }

            // This middleware is in the priority map. If we have encountered another
            // middleware that was also in the priority map and was at a lower
            // priority, we move this one above the previous encounter.
            if (lastPriorityIndex !== undefined && priorityIndex < lastPriorityIndex) {
                return SortedMiddleware.sortMiddleware(
                    priorityMap,
                    SortedMiddleware.moveMiddleware(middleware, index, lastIndex),
                );
            }

            lastIndex = index;
            lastPriorityIndex = priorityIndex;
        }

        return Route.uniqueMiddleware(middleware);
    }

    /** Calculate the priority map index of the middleware. */
    protected static priorityMapIndex(priorityMap: Array<Pipe>, middleware: Pipe): number | undefined {
        for (const name of SortedMiddleware.middlewareNames(middleware)) {
            const index = priorityMap.indexOf(name);

            if (index !== -1) {
                return index;
            }
        }

        return undefined;
    }

    /** Resolve the names to look for in the priority list. */
    protected static middlewareNames(middleware: Pipe): Array<Pipe> {
        const names = new Array<Pipe>();

        // A class with its arguments beside it answers for the class.
        const target = Util.isArray(middleware) ? (middleware as Array<Pipe>)[0] : middleware;

        if (typeIs(target, "string")) {
            names.push(Str.before(target, ":"));

            return names;
        }

        // PHP skips anything that is not a string, since a middleware is a
        // class *name* there. Here a class is a table, so that check becomes
        // "is it a class": a closure -- or any other bare value -- names
        // nothing and stays where it is.
        if (!typeIs(target, "table")) {
            return names;
        }

        let current: object | undefined = target as object;

        while (current !== undefined) {
            names.push(current as Pipe);

            current = Reflector.parentClass(current);
        }

        return names;
    }

    /** Splice a middleware into a new position and remove the old entry. */
    protected static moveMiddleware(middleware: Array<Pipe>, from: number, to: number): Array<Pipe> {
        const moved = new Array<Pipe>();

        // PHP splices a copy in at `to` and unsets the original, which has
        // shifted one place along; the sort only ever moves an entry towards
        // the front, so walking once says the same thing.
        for (let index = 0; index < middleware.size(); index++) {
            if (index === to) {
                moved.push(middleware[from]);
            }

            if (index !== from) {
                moved.push(middleware[index]);
            }
        }

        return moved;
    }
}
