import { MiddlewareNameResolver } from 'Illuminate/Routing/MiddlewareNameResolver';
import { OrderedMap } from 'Illuminate/Support/OrderedMap';
import { Pipeline } from 'Illuminate/Routing/Pipeline';
import { PreparingResponse } from 'Illuminate/Routing/Events/PreparingResponse';
import { Response } from 'Illuminate/Http/Response';
import { ResponsePrepared } from 'Illuminate/Routing/Events/ResponsePrepared';
import { Route } from 'Illuminate/Routing/Route';
import { RouteAction } from 'Illuminate/Routing/RouteAction';
import { RouteCollection } from 'Illuminate/Routing/RouteCollection';
import { RouteGroup } from 'Illuminate/Routing/RouteGroup';
import { RouteMatched } from 'Illuminate/Routing/Events/RouteMatched';
import { RouteRegistrar } from 'Illuminate/Routing/RouteRegistrar';
import { SortedMiddleware } from 'Illuminate/Routing/SortedMiddleware';
import { Routing } from 'Illuminate/Routing/Events/Routing';
import { Str } from 'Illuminate/Support/Str';
import { Util } from 'Illuminate/Container/Util';
import { isArrayable } from 'Illuminate/Contracts/Support/Arrayable';
import { isResponsable } from 'Illuminate/Contracts/Support/Responsable';
import type { ActionAttributes, ActionTarget } from 'Illuminate/Routing/RouteAction';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';
import type { Request } from 'Illuminate/Http/Request';

/** What one coroutine is dispatching, if anything. */
interface DispatchedOnThread
{
    route?: Route;
    request?: Request;
}

/** What `Route::bind()` registers: a value for a parameter, from its raw text. */
export type BinderCallback = (value: string, route: Route) => unknown;

/**
 * PHP: `Illuminate\Routing\Router`.
 *
 * What is missing here is missing because the component under it is:
 *
 * - `resource()`, `apiResource()`, `singleton()` and the pending registrars --
 *   sugar over seven ordinary routes, worth writing once the core settles;
 * - `redirect()`, `permanentRedirect()`, `view()` -- no addresses, no views;
 * - `substituteImplicitBindings()` -- implicit model binding waits for the
 *   database; the explicit `bind()` callbacks work today;
 * - `respondWithRoute()`, `matched()`, `singularResourceParameters()`.
 */
export class Router
{
    /** All of the verbs supported by the router. */
    public static readonly verbs: Array<string> = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

    /** The route collection instance. */
    protected routes = new RouteCollection();

    /**
     * What each coroutine is dispatching.
     *
     * PHP keeps `$current` and `$currentRequest` in two properties, and is
     * exact doing it: one process serves one request, so whatever is in them
     * is this request's. The router here is a singleton, and a remote handler
     * is a coroutine -- a yield inside a route lets the next request match and
     * overwrite both, leaving the first to wake up reading about the second.
     *
     * A request is one coroutine from the gateway down, so the coroutine is
     * what tells them apart. `Kernel` and `Route` were given the sandbox to
     * carry their per-request state instead, which is better; these two cannot
     * be, because the whole point of `Route::current()` is being reachable
     * without being handed anything.
     *
     * The keys are weak, so an entry goes when the coroutine that made it is
     * collected. Clearing on the way out would be wrong -- PHP leaves these
     * readable after the response, and terminable middleware runs then.
     */
    protected readonly dispatching = setmetatable(new Map<thread, DispatchedOnThread>(), { __mode: 'k' });

    /** All of the short-hand keys for middlewares. */
    protected middlewareAliases = new OrderedMap<string, Pipe>();

    /** All of the middleware groups. */
    protected middlewareGroups = new OrderedMap<string, Array<Pipe>>();

    /** The registered route value binders. */
    protected binders = new OrderedMap<string, BinderCallback>();

    /**
     * The priority-sorted list of middleware.
     *
     * Forces the listed middleware to always be in the given order. The list
     * starts empty and the HTTP kernel syncs its own onto it, exactly as PHP's
     * does.
     */
    public middlewarePriority = new Array<Pipe>();

    /** The globally available parameter patterns. */
    protected globalPatterns: Record<string, string> = {};

    /** The route group attribute stack. */
    protected groupStack = new Array<ActionAttributes>();

    /** Create a new Router instance. */
    public constructor(
        protected readonly events: Dispatcher,
        protected readonly container: Container,
    )
    {}

    // -----------------------------------------------------------------
    // Registration
    // -----------------------------------------------------------------

    /** Register a new GET route with the router. */
    public get(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['GET', 'HEAD'], uri, action);
    }

    /** Register a new POST route with the router. */
    public post(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['POST'], uri, action);
    }

    /** Register a new PUT route with the router. */
    public put(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['PUT'], uri, action);
    }

    /** Register a new PATCH route with the router. */
    public patch(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['PATCH'], uri, action);
    }

    /** Register a new DELETE route with the router. */
    public delete(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['DELETE'], uri, action);
    }

    /** Register a new OPTIONS route with the router. */
    public options(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['OPTIONS'], uri, action);
    }

    /** Register a new route responding to all verbs. */
    public any(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(Router.verbs, uri, action);
    }

    /** Register a new route with the given verbs. */
    public match(methods: string | Array<string>, uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        const upper = new Array<string>();

        for (const method of Util.arrayWrap(methods)) {
            upper.push(method.upper());
        }

        return this.addRoute(upper, uri, action);
    }

    /**
     * Register a route that answers only on the unreliable remote.
     *
     * No PHP counterpart. The engine caps that remote's payload and is free to
     * drop it, so a stream route is a different contract from an ordinary one
     * and says so at registration. It answers POST, and -- like any route -- a
     * verb and URI identify exactly one route, so give it a path of its own.
     */
    public stream(uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['POST'], uri, action).setTransports(['stream']);
    }

    /** Register a new fallback route with the router. */
    public fallback(action: ActionTarget | ActionAttributes): Route
    {
        return this.addRoute(['GET', 'HEAD'], '{fallbackPlaceholder}', action)
            .where('fallbackPlaceholder', '.*')
            .fallback();
    }

    // -----------------------------------------------------------------
    // Fluent registration
    //
    // PHP reaches these through `__call`, which hands the call to a fresh
    // `RouteRegistrar`. They are written out here for the same reason the
    // facades write their methods out. Two names had to move to make room:
    // the alias map is `middlewareAliases` and the URI prefixer is
    // `prefixWithGroup()`, both of which PHP can leave alone because `__call`
    // only fires for what is not already there.
    // -----------------------------------------------------------------

    /** Register middleware to be applied to a group of routes. */
    public middleware(middleware: Pipe | Array<Pipe>): RouteRegistrar
    {
        return new RouteRegistrar(this).middleware(middleware);
    }

    /** Register middleware to be removed from a group of routes. */
    public withoutMiddleware(middleware: Pipe | Array<Pipe>): RouteRegistrar
    {
        return new RouteRegistrar(this).withoutMiddleware(middleware);
    }

    /** Register a name prefix for a group of routes. */
    public as(name: string): RouteRegistrar
    {
        return new RouteRegistrar(this).as(name);
    }

    /** Register a name prefix for a group of routes. */
    public name(name: string): RouteRegistrar
    {
        return new RouteRegistrar(this).as(name);
    }

    /** Register a URI prefix for a group of routes. */
    public prefix(prefix: string): RouteRegistrar
    {
        return new RouteRegistrar(this).prefix(prefix);
    }

    /** Register parameter constraints for a group of routes. */
    public where(where: Record<string, string>): RouteRegistrar
    {
        return new RouteRegistrar(this).where(where);
    }

    /** Create a route group with shared attributes. */
    public group(attributes: ActionAttributes, routes: () => void): this
    {
        this.updateGroupStack(attributes);

        // Once we have updated the group stack, we'll load the provided routes and
        // merge in the group's attributes when the routes are created. After we
        // have created the routes, we will pop the attributes off the stack.
        routes();

        this.groupStack.pop();

        return this;
    }

    /** Update the group stack with the given attributes. */
    protected updateGroupStack(attributes: ActionAttributes): void
    {
        this.groupStack.push(this.hasGroupStack() ? this.mergeWithLastGroup(attributes) : attributes);
    }

    /** Merge the given array with the last group stack. */
    public mergeWithLastGroup(attributes: ActionAttributes, prependExistingPrefix = true): ActionAttributes
    {
        return RouteGroup.merge(attributes, this.groupStack[this.groupStack.size() - 1], prependExistingPrefix);
    }

    /** Add a route to the underlying route collection. */
    public addRoute(methods: Array<string>, uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        return this.routes.add(this.createRoute(methods, uri, action));
    }

    /** Create a new route instance. */
    protected createRoute(methods: Array<string>, uri: string, action?: ActionTarget | ActionAttributes): Route
    {
        const route = this.newRoute(methods, this.prefixWithGroup(uri), RouteAction.parse(uri, action));

        // If we have groups that need to be merged, we will merge them now after this
        // route has already been created and is ready to go. After we're done with
        // the merge we will be ready to return the route back out to the caller.
        if (this.hasGroupStack()) {
            this.mergeGroupAttributesIntoRoute(route);
        }

        this.addWhereClausesToRoute(route);

        return route;
    }

    /** Create a new Route object. */
    public newRoute(methods: Array<string>, uri: string, action: ActionAttributes): Route
    {
        return new Route(methods, uri, action).setRouter(this).setContainer(this.container);
    }

    /** Prefix the given URI with the last prefix. */
    protected prefixWithGroup(uri: string): string
    {
        const prefixed = Str.trim(`${Str.trim(this.getLastGroupPrefix(), '/')}/${Str.trim(uri, '/')}`, '/');

        return prefixed === '' ? '/' : prefixed;
    }

    /** Add the necessary where clauses to the route based on its initial registration. */
    protected addWhereClausesToRoute(route: Route): Route
    {
        return route.where({
            ...this.globalPatterns,
            ...(route.getAction().where ?? {}),
        });
    }

    /** Merge the group stack with the controller action. */
    protected mergeGroupAttributesIntoRoute(route: Route): void
    {
        route.setAction(this.mergeWithLastGroup(route.getAction(), false));
    }

    /** Get the prefix from the last group on the stack. */
    public getLastGroupPrefix(): string
    {
        if (!this.hasGroupStack()) {
            return '';
        }

        return this.groupStack[this.groupStack.size() - 1].prefix ?? '';
    }

    /** Determine if the router currently has a group stack. */
    public hasGroupStack(): boolean
    {
        return !this.groupStack.isEmpty();
    }

    /** Get the current group stack for the router. */
    public getGroupStack(): Array<ActionAttributes>
    {
        return this.groupStack;
    }

    // -----------------------------------------------------------------
    // Dispatching
    // -----------------------------------------------------------------

    /**
     * Dispatch the request to the application.
     *
     * PHP takes the request alone: there is one container per process, the
     * router was handed it when it was built, and that is the end of it. Here
     * the router is a singleton on the root application while each request runs
     * on a copy of it (`Application::sandbox()`), so the container to resolve
     * *this* request out of arrives with the request. It defaults to the
     * router's own, which is what every caller outside the kernel wants.
     */
    public dispatch(request: Request, container: Container = this.container): Response
    {
        // Replaced rather than written into: a coroutine that has dispatched
        // before still holds that route, and nothing would clear it until this
        // request matched -- which is after the global middleware has run and
        // had every chance to ask. Starting the record fresh here leaves the
        // accessors answering after the response, since this clears on the way
        // in and not on the way out.
        this.dispatching.set(coroutine.running(), { request: request });

        return this.dispatchToRoute(request, container);
    }

    /** Dispatch the request to a route and return the response. */
    public dispatchToRoute(request: Request, container: Container = this.container): Response
    {
        return this.runRoute(request, this.findRoute(request, container));
    }

    /** Find the route matching a given request. */
    protected findRoute(request: Request, container: Container): Route
    {
        this.events.dispatch(new Routing(request));

        // A copy of the collection's route, owned by this request -- see
        // `Route::forRequest()`.
        const route = this.routes.match(request);

        // Onto this coroutine's record, which `dispatch()` started -- see
        // `dispatching`. This is what `Router::current()` reads.
        this.dispatchedHere().route = route;

        // The route carries the request's container from here on: it is
        // per-request now, and the router is not.
        route.setContainer(container);

        container.instance(Route, route);

        return route;
    }

    /** Return the response for the given route. */
    protected runRoute(request: Request, route: Route): Response
    {
        request.setRouteResolver(() => route);

        this.events.dispatch(new RouteMatched(route, request));

        return this.prepareResponse(request, this.runRouteWithinStack(route, request));
    }

    /** Run the given route within a Stack "onion" instance. */
    protected runRouteWithinStack(route: Route, request: Request): unknown
    {
        // The route was given this request's container in `findRoute()`; the
        // router's own is the fallback for a route dispatched by hand.
        const container = route.getContainer() ?? this.container;

        const shouldSkipMiddleware = container.bound('middleware.disable')
            && container.make('middleware.disable') === true;

        const middleware = shouldSkipMiddleware ? new Array<Pipe>() : this.gatherRouteMiddleware(route);

        // Named rather than chained: `then` is a Luau keyword, so the compiler
        // has to index it as a string, and chaining leaves it reading from the
        // `_` placeholder -- which `luau-lsp analyze` flags.
        const pipeline = new Pipeline(container).send(request).through(middleware);

        return pipeline.then((passable) => this.prepareResponse(passable as Request, route.run()));
    }

    /** Gather the middleware for the given route with resolved class names. */
    public gatherRouteMiddleware(route: Route): Array<Pipe>
    {
        return this.resolveMiddleware(route.gatherMiddleware(), route.excludedMiddleware());
    }

    /** Resolve a flat array of middleware classes from the provided array. */
    public resolveMiddleware(middleware: Array<Pipe>, excluded: Array<Pipe> = []): Array<Pipe>
    {
        const resolvedExcluded = this.flatten(excluded);
        const resolved = new Array<Pipe>();

        for (const entry of this.flatten(middleware)) {
            if (!typeIs(entry, 'function') && resolvedExcluded.includes(entry)) {
                continue;
            }

            resolved.push(entry);
        }

        return this.sortMiddleware(resolved);
    }

    /** Sort the given middleware by priority. */
    protected sortMiddleware(middleware: Array<Pipe>): Array<Pipe>
    {
        return new SortedMiddleware(this.middlewarePriority, middleware).all();
    }

    /** Resolve every name against the aliases and groups, flattening the result. */
    protected flatten(middleware: Array<Pipe>): Array<Pipe>
    {
        const flattened = new Array<Pipe>();

        for (const entry of middleware) {
            const resolved = MiddlewareNameResolver.resolve(entry, this.middlewareAliases, this.middlewareGroups);

            // Only a group name resolves to several middleware. A class that
            // carries its arguments beside it is a list too, and flattening
            // that one would hand the pipeline `"60"` as if it were a pipe.
            if (typeIs(entry, 'string') && this.middlewareGroups.has(entry)) {
                for (const nested of resolved as Array<Pipe>) {
                    flattened.push(nested);
                }

                continue;
            }

            flattened.push(resolved as Pipe);
        }

        return flattened;
    }

    /** Create a response instance from the given value. */
    public prepareResponse(request: Request, response: unknown): Response
    {
        this.events.dispatch(new PreparingResponse(request, response));

        const prepared = Router.toResponse(request, response);

        this.events.dispatch(new ResponsePrepared(request, prepared));

        return prepared;
    }

    /**
     * Static version of prepareResponse.
     *
     * PHP sorts the value into a `JsonResponse`, a `Response` or a Symfony one;
     * a remote carries a Luau value, so there is nothing to encode and the
     * branches collapse into one. What does matter is that the value can
     * *replicate*: an object crosses the boundary as a bare table with its
     * metatable stripped, so anything `Arrayable` is asked for its array first,
     * which is where PHP's `Arrayable` branch was going anyway.
     */
    public static toResponse(request: Request, response: unknown): Response
    {
        let value = response;

        if (isResponsable(value)) {
            value = value.toResponse(request);
        }

        if (value instanceof Response) {
            return value.prepare(request);
        }

        if (isArrayable(value)) {
            value = value.toArray();
        }

        if (value instanceof OrderedMap) {
            const plain: Record<string, unknown> = {};

            for (const [key, entry] of (value as OrderedMap<defined, defined>).entries()) {
                plain[tostring(key)] = entry;
            }

            value = plain;
        }

        return new Response(value).prepare(request);
    }

    // -----------------------------------------------------------------
    // Bindings and patterns
    // -----------------------------------------------------------------

    /** Add a new route parameter binder. */
    public bind(key: string, binder: BinderCallback): void
    {
        this.binders.set(Str.replace('-', '_', key), binder);
    }

    /** Get the binding callback for a given binding. */
    public getBindingCallback(key: string): BinderCallback | undefined
    {
        return this.binders.get(Str.replace('-', '_', key));
    }

    /** Substitute the route bindings onto the route. */
    public substituteBindings(route: Route): Route
    {
        for (const [key, value] of route.parameters().entries()) {
            const binder = this.binders.get(key);

            if (binder !== undefined) {
                route.setParameter(key, this.performBinding(key, value, route));
            }
        }

        return route;
    }

    /** Call the binding callback for the given key. */
    protected performBinding(key: string, value: defined, route: Route): defined
    {
        return (this.binders.get(key) as BinderCallback)(value as string, route) as defined;
    }

    /** Get the global "where" patterns. */
    public getPatterns(): Record<string, string>
    {
        return this.globalPatterns;
    }

    /** Set a global where pattern on all routes. */
    public pattern(key: string, expression: string): void
    {
        this.globalPatterns[key] = expression;
    }

    /** Set a group of global where patterns on all routes. */
    public patterns(patterns: Record<string, string>): void
    {
        for (const [key, expression] of pairs(patterns)) {
            this.pattern(key as string, expression as string);
        }
    }

    // -----------------------------------------------------------------
    // Middleware registration
    // -----------------------------------------------------------------

    /** Get all of the defined middleware short-hand names. */
    public getMiddleware(): OrderedMap<string, Pipe>
    {
        return this.middlewareAliases;
    }

    /** Register a short-hand name for a middleware. */
    public aliasMiddleware(name: string, middleware: Pipe): this
    {
        this.middlewareAliases.set(name, middleware);

        return this;
    }

    /** Check if a middlewareGroup with the given name exists. */
    public hasMiddlewareGroup(name: string): boolean
    {
        return this.middlewareGroups.has(name);
    }

    /** Get all of the defined middleware groups. */
    public getMiddlewareGroups(): OrderedMap<string, Array<Pipe>>
    {
        return this.middlewareGroups;
    }

    /** Register a group of middleware. */
    public middlewareGroup(name: string, middleware: Array<Pipe>): this
    {
        this.middlewareGroups.set(name, middleware);

        return this;
    }

    /** Add a middleware to the beginning of a middleware group. */
    public prependMiddlewareToGroup(group: string, middleware: Pipe): this
    {
        const existing = this.middlewareGroups.get(group) ?? [];

        if (!existing.includes(middleware)) {
            const merged = [middleware];

            for (const entry of existing) {
                merged.push(entry);
            }

            this.middlewareGroups.set(group, merged);
        }

        return this;
    }

    /** Add a middleware to the end of a middleware group. */
    public pushMiddlewareToGroup(group: string, middleware: Pipe): this
    {
        const existing = this.middlewareGroups.get(group) ?? new Array<Pipe>();

        if (!existing.includes(middleware)) {
            existing.push(middleware);
        }

        this.middlewareGroups.set(group, existing);

        return this;
    }

    /** Remove the given middleware from the specified group. */
    public removeMiddlewareFromGroup(group: string, middleware: Pipe): this
    {
        if (!this.hasMiddlewareGroup(group)) {
            return this;
        }

        const kept = new Array<Pipe>();

        for (const entry of this.middlewareGroups.get(group) ?? []) {
            if (entry !== middleware) {
                kept.push(entry);
            }
        }

        this.middlewareGroups.set(group, kept);

        return this;
    }

    /** Flush the router's middleware groups. */
    public flushMiddlewareGroups(): this
    {
        this.middlewareGroups = new OrderedMap<string, Array<Pipe>>();

        return this;
    }

    /** Take only the first occurrence of each middleware. */
    public static uniqueMiddleware(middleware: Array<Pipe>): Array<Pipe>
    {
        return Route.uniqueMiddleware(middleware);
    }

    // -----------------------------------------------------------------
    // Current request
    // -----------------------------------------------------------------

    /**
     * Get the currently dispatched route instance.
     *
     * PHP keeps this in a `$current` property. Here it is per coroutine -- see
     * `dispatching` -- so what comes back is the route of the request asking,
     * not of whichever one matched most recently.
     */
    public current(): Route | undefined
    {
        return this.dispatching.get(coroutine.running())?.route;
    }

    /** Get the currently dispatched route instance. */
    public getCurrentRoute(): Route | undefined
    {
        return this.current();
    }

    /** Get the request currently being dispatched. */
    public getCurrentRequest(): Request | undefined
    {
        return this.dispatching.get(coroutine.running())?.request;
    }

    /** What this coroutine is dispatching, started if it is the first thing it dispatches. */
    protected dispatchedHere(): DispatchedOnThread
    {
        const thread = coroutine.running();
        const existing = this.dispatching.get(thread);

        if (existing !== undefined) {
            return existing;
        }

        const started: DispatchedOnThread = {};

        this.dispatching.set(thread, started);

        return started;
    }

    /** Check if a route with the given name exists. */
    public has(name: string | Array<string>): boolean
    {
        for (const value of Util.arrayWrap(name)) {
            if (!this.routes.hasNamedRoute(value)) {
                return false;
            }
        }

        return true;
    }

    /** Get the current route name. */
    public currentRouteName(): string | undefined
    {
        return this.current()?.getName();
    }

    /** Alias for the "currentRouteNamed" method. */
    public is(...patterns: Array<string>): boolean
    {
        return this.currentRouteNamed(...patterns);
    }

    /** Determine if the current route matches a pattern. */
    public currentRouteNamed(...patterns: Array<string>): boolean
    {
        return this.current() !== undefined && (this.current() as Route).named(...patterns);
    }

    /** Get the current route action. */
    public currentRouteAction(): string | undefined
    {
        return this.current()?.getActionName();
    }

    /** Determine if the current route action matches a given action. */
    public uses(...patterns: Array<string>): boolean
    {
        const action = this.currentRouteAction();

        if (action === undefined) {
            return false;
        }

        for (const pattern of patterns) {
            if (Str.is(pattern, action)) {
                return true;
            }
        }

        return false;
    }

    /** Get the underlying route collection. */
    public getRoutes(): RouteCollection
    {
        return this.routes;
    }

    /** Set the route collection instance. */
    public setRoutes(routes: RouteCollection): void
    {
        for (const route of routes.getRoutes()) {
            route.setRouter(this).setContainer(this.container);
        }

        this.routes = routes;
    }
}
