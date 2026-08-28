import { AbstractRouteCollection } from "Illuminate/Routing/AbstractRouteCollection";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import type { Request } from "Illuminate/Http/Request";
import type { Route } from "Illuminate/Routing/Route";

/**
 * PHP: `Illuminate\Routing\RouteCollection`.
 *
 * The domain-keyed collections are absent along with domains, and so is
 * `toCompiledRouteCollection()` -- route caching needs a console and Symfony's
 * compiler.
 */
export class RouteCollection extends AbstractRouteCollection {
    /** An array of the routes keyed by method. */
    protected routes = new OrderedMap<string, OrderedMap<string, Route>>();

    /** A flattened array of all of the routes. */
    protected allRoutes = new OrderedMap<string, Route>();

    /** A look-up table of routes by their names. */
    protected nameList = new OrderedMap<string, Route>();

    /** A look-up table of routes by controller action. */
    protected actionList = new OrderedMap<string, Route>();

    /** Add a Route instance to the collection. */
    public add(route: Route): Route {
        this.addToCollections(route);

        this.addLookups(route);

        return route;
    }

    /** Add the given route to the arrays of routes. */
    protected addToCollections(route: Route): void {
        const uri = route.uri();

        for (const method of route.methods()) {
            let byUri = this.routes.get(method);

            if (byUri === undefined) {
                byUri = new OrderedMap<string, Route>();
                this.routes.set(method, byUri);
            }

            byUri.set(uri, route);
        }

        this.allRoutes.set(`${route.methods().join("|")}${uri}`, route);
    }

    /** Add the route to any look-up tables if necessary. */
    protected addLookups(route: Route): void {
        const name = route.getName();

        if (name !== undefined) {
            this.nameList.set(name, route);
        }

        if (route.isControllerAction()) {
            this.addToActionList(route);
        }
    }

    /** Add a route to the controller action dictionary. */
    protected addToActionList(route: Route): void {
        this.actionList.set(route.getActionName(), route);
    }

    /** Refresh the name look-up table. */
    public refreshNameLookups(): void {
        this.nameList = new OrderedMap<string, Route>();

        for (const route of this.getRoutes()) {
            const name = route.getName();

            if (name !== undefined) {
                this.nameList.set(name, route);
            }
        }
    }

    /** Refresh the action look-up table. */
    public refreshActionLookups(): void {
        this.actionList = new OrderedMap<string, Route>();

        for (const route of this.getRoutes()) {
            if (route.isControllerAction()) {
                this.addToActionList(route);
            }
        }
    }

    /** Find the first route matching a given request. */
    public match(request: Request): Route {
        const routes = this.get(request.method());

        // First, we will see if we can find a matching route for this current request
        // method. If we can, great, we can just return it so that it can be called
        // by the consumer. Otherwise we will check for routes with another verb.
        return this.handleMatchedRoute(request, this.matchAgainstRoutes(routes, request));
    }

    /** Get routes from the collection by method. */
    public get(method?: string): Array<Route> {
        if (method === undefined) {
            return this.getRoutes();
        }

        return this.routes.get(method)?.values() ?? [];
    }

    /** The verbs the collection holds routes for. */
    protected registeredMethods(): Array<string> {
        return this.routes.keys();
    }

    /** Determine if the route collection contains a given named route. */
    public hasNamedRoute(name: string): boolean {
        return this.nameList.has(name);
    }

    /** Get a route instance by its name. */
    public getByName(name: string): Route | undefined {
        return this.nameList.get(name);
    }

    /** Get a route instance by its controller action. */
    public getByAction(action: string): Route | undefined {
        return this.actionList.get(action);
    }

    /** Get all of the routes in the collection. */
    public getRoutes(): Array<Route> {
        return this.allRoutes.values();
    }

    /** Get all of the routes keyed by their HTTP verb / method. */
    public getRoutesByMethod(): OrderedMap<string, OrderedMap<string, Route>> {
        return this.routes;
    }

    /** Get all of the routes keyed by their name. */
    public getRoutesByName(): OrderedMap<string, Route> {
        return this.nameList;
    }

    /** Count the number of items in the collection. */
    public count(): number {
        return this.allRoutes.size();
    }
}
