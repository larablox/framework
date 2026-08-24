import { Util } from "Illuminate/Container/Util";
import type {
    ActionAttributes,
    ActionTarget,
} from "Illuminate/Routing/RouteAction";
import type { Pipe } from "Illuminate/Contracts/Pipeline/Pipeline";
import type { Route } from "Illuminate/Routing/Route";
import type { Router } from "Illuminate/Routing/Router";

/**
 * PHP: `Illuminate\Routing\RouteRegistrar`.
 *
 * The fluent half of the routing API: `Route::middleware(...)->group(...)`.
 * PHP routes both the attribute setters and the verbs through `__call`; there
 * is none, so each is written out -- the same trade the facades make.
 *
 * `domain()`, `namespace()`, `scopeBindings()`, `withTrashed()` and the
 * resource registrations are absent along with what they configure.
 */
export class RouteRegistrar {
    /** The attributes to pass on to the router. */
    protected attributes: ActionAttributes = {};

    /** Create a new route registrar instance. */
    public constructor(protected readonly router: Router) {}

    /** Set the value for a given attribute. */
    public attribute<TKey extends keyof ActionAttributes>(
        key: TKey,
        value: ActionAttributes[TKey],
    ): this {
        this.attributes[key] = value;

        return this;
    }

    /** Set the middleware attached to the routes. */
    public middleware(middleware: Pipe | Array<Pipe>): this {
        const merged = table.clone(
            this.attributes.middleware ?? new Array<Pipe>(),
        );

        for (const entry of Util.arrayWrap(middleware) as Array<Pipe>) {
            merged.push(entry);
        }

        return this.attribute("middleware", merged);
    }

    /** Specify middleware that should be removed from the routes. */
    public withoutMiddleware(middleware: Pipe | Array<Pipe>): this {
        const merged = table.clone(
            this.attributes.excluded_middleware ?? new Array<Pipe>(),
        );

        for (const entry of Util.arrayWrap(middleware) as Array<Pipe>) {
            merged.push(entry);
        }

        return this.attribute("excluded_middleware", merged);
    }

    /** Set the name prefix for the routes. */
    public as(name: string): this {
        return this.attribute("as", name);
    }

    /** Set the name prefix for the routes. */
    public name(name: string): this {
        return this.as(name);
    }

    /** Set the URI prefix for the routes. */
    public prefix(prefix: string): this {
        return this.attribute("prefix", prefix);
    }

    /** Set the constraints for the routes. */
    public where(where: Record<string, string>): this {
        return this.attribute("where", where);
    }

    /** Create a route group with shared attributes. */
    public group(routes: () => void): void {
        this.router.group(this.attributes, routes);
    }

    /** Register a new GET route with the router. */
    public get(uri: string, action?: ActionTarget): Route {
        return this.router.get(uri, this.compileAction(action));
    }

    /** Register a new POST route with the router. */
    public post(uri: string, action?: ActionTarget): Route {
        return this.router.post(uri, this.compileAction(action));
    }

    /** Register a new PUT route with the router. */
    public put(uri: string, action?: ActionTarget): Route {
        return this.router.put(uri, this.compileAction(action));
    }

    /** Register a new PATCH route with the router. */
    public patch(uri: string, action?: ActionTarget): Route {
        return this.router.patch(uri, this.compileAction(action));
    }

    /** Register a new DELETE route with the router. */
    public delete(uri: string, action?: ActionTarget): Route {
        return this.router.delete(uri, this.compileAction(action));
    }

    /** Register a new OPTIONS route with the router. */
    public options(uri: string, action?: ActionTarget): Route {
        return this.router.options(uri, this.compileAction(action));
    }

    /** Register a new route responding to all verbs. */
    public any(uri: string, action?: ActionTarget): Route {
        return this.router.any(uri, this.compileAction(action));
    }

    /** Register a route that answers only on the unreliable remote. */
    public stream(uri: string, action?: ActionTarget): Route {
        return this.router.stream(uri, this.compileAction(action));
    }

    /** Register a new route with the given verbs. */
    public match(
        methods: string | Array<string>,
        uri: string,
        action?: ActionTarget,
    ): Route {
        return this.router.match(methods, uri, this.compileAction(action));
    }

    /** Compile the action into an array including the attributes. */
    protected compileAction(action?: ActionTarget): ActionAttributes {
        if (action === undefined) {
            return { ...this.attributes };
        }

        return { ...this.attributes, uses: action };
    }
}
