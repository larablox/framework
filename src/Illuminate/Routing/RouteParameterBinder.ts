import { OrderedMap } from "Illuminate/Support/OrderedMap";
import type { Request } from "Illuminate/Http/Request";
import type { Route } from "Illuminate/Routing/Route";

/**
 * PHP: `Illuminate\Routing\RouteParameterBinder`.
 *
 * PHP runs the compiled regular expression over the path and reads the named
 * captures out of it. The compiled route here is a list of segments, so the
 * values come out of the same walk that matched the route, keyed in the order
 * the URI names them -- and the order matters, because that is the order an
 * action's parameters are filled in.
 *
 * `bindHostParameters()` is absent along with domains.
 */
export class RouteParameterBinder {
    /** Create a new Route parameter binder instance. */
    public constructor(protected readonly route: Route) {}

    /** Get the parameters for the route. */
    public parameters(request: Request): OrderedMap<string, defined> {
        return this.replaceDefaults(this.bindPathParameters(request));
    }

    /** Get the parameter matches for the path portion of the URI. */
    protected bindPathParameters(request: Request): OrderedMap<string, defined> {
        const matched = this.route.getCompiled().match(request.decodedPath(), this.route.wheres);

        const parameters = new OrderedMap<string, defined>();

        for (const name of this.route.parameterNames()) {
            const value = matched?.get(name);

            if (value !== undefined) {
                parameters.set(name, value);
            }
        }

        return parameters;
    }

    /**
     * Replace null parameters with their defaults.
     *
     * PHP walks the parameters first, filling in the ones that came back null;
     * a Luau table holds no nulls, so an optional parameter the path left out
     * is simply absent and only the second loop has anything to do.
     */
    protected replaceDefaults(parameters: OrderedMap<string, defined>): OrderedMap<string, defined> {
        for (const [key, value] of pairs(this.route.defaultValues)) {
            if (!parameters.has(key as string)) {
                parameters.set(key as string, value as defined);
            }
        }

        return parameters;
    }
}
