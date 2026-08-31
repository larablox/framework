import { Arr } from 'Illuminate/Support/Arr';
import { BootProviders } from 'Illuminate/Foundation/Bootstrap/BootProviders';
import { Handler } from 'Illuminate/Foundation/Exceptions/Handler';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { LoadConfiguration } from 'Illuminate/Foundation/Bootstrap/LoadConfiguration';
import { Pipeline } from 'Illuminate/Routing/Pipeline';
import { RegisterFacades } from 'Illuminate/Foundation/Bootstrap/RegisterFacades';
import { RegisterProviders } from 'Illuminate/Foundation/Bootstrap/RegisterProviders';
import { RequestHandled } from 'Illuminate/Foundation/Http/Events/RequestHandled';
import { SubstituteBindings } from 'Illuminate/Routing/Middleware/SubstituteBindings';
import { Terminating } from 'Illuminate/Foundation/Events/Terminating';
import { ThrottleRequests } from 'Illuminate/Routing/Middleware/ThrottleRequests';
import { Util } from 'Illuminate/Container/Util';
import type { Abstract, Constructor } from 'Illuminate/Container/Types';
import type { Application, Bootstrapper } from 'Illuminate/Contracts/Foundation/Application';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Kernel as KernelContract } from 'Illuminate/Contracts/Http/Kernel';
import type { Passable } from 'Illuminate/Contracts/Pipeline/Pipeline';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';
import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';
import type { Route } from 'Illuminate/Routing/Route';
import type { Router } from 'Illuminate/Routing/Router';

/**
 * The container key the request's start time is bound under.
 *
 * PHP keeps this in a property; here it belongs to the request rather than to
 * the kernel, and the request's container is the sandbox. Not exported: it is
 * the kernel's own bookkeeping, and `requestStartedAt()` is how it is read. A
 * class rather than a string so it cannot collide with a key a game binds.
 */
class RequestStartedAt
{}

/** PHP: one entry of `$requestLifecycleDurationHandlers`. */
interface DurationHandler
{
    threshold: number;
    handler: (startedAt: number, request: Request, response: Response) => void;
}

/**
 * PHP: `Illuminate\Foundation\Http\Kernel`.
 *
 * What `public/index.php` hands the request to: it bootstraps the application,
 * sends the request through the global middleware into the router, and answers
 * with a response no matter what was thrown on the way.
 *
 * The gateway calls it once per request and the process outlives the request,
 * where PHP's dies with it. That shows up in two places: `bootstrap()` runs
 * once at start-up rather than on the way into the first request, and the
 * duration handlers measure with `os.clock()` because `Carbon` -- a wall clock
 * with a timezone -- is not ported.
 *
 * It also shows up in the signatures. PHP keeps the application on the kernel
 * and the current request's start time beside it, because one process serves
 * one request and neither can be about anybody else. Here one kernel serves
 * every request and a remote handler is a coroutine, so a yield inside one
 * request lets the next overwrite both -- the first would then bind its request
 * into the second's container, terminate the second's application, and report
 * the second's duration as its own. So the kernel holds no per-request state:
 * the application arrives with the request, exactly as it does in
 * `Router::dispatch()`, and the start time is kept in that application, which
 * is this request's sandbox and therefore the right place for it.
 *
 * Not ported: `$bootstrappers` entry `HandleExceptions` (it installs PHP's
 * error handlers), `enableHttpMethodParameterOverride()` (no forms), and
 * `$routeMiddleware`, which PHP itself marks deprecated.
 */
export class Kernel implements KernelContract
{
    /** The bootstrap classes for the application. */
    protected bootstrappersList: Array<Constructor<Bootstrapper>> = [
        LoadConfiguration,
        RegisterFacades,
        RegisterProviders,
        BootProviders,
    ];

    /** The application's middleware stack. */
    protected middleware = new Array<Pipe>();

    /** The application's route middleware groups. */
    protected middlewareGroups: Record<string, Array<Pipe>> = {};

    /** The application's middleware aliases. */
    protected middlewareAliases: Record<string, Pipe> = {};

    /** All of the registered request duration handlers. */
    protected requestLifecycleDurationHandlers = new Array<DurationHandler>();

    /**
     * The priority-sorted list of middleware.
     *
     * Forces non-global middleware to always be in the given order. PHP's list
     * is longer only because it has more middleware to order; what is here is
     * PHP's list with everything unported struck out, in PHP's order.
     */
    protected middlewarePriority: Array<Pipe> = [
        ThrottleRequests,
        SubstituteBindings,
    ];

    /** Create a new HTTP kernel instance. */
    public constructor(
        @Inject('app') protected app: Application,
        @Inject('router') protected readonly router: Router,
    )
    {
        this.syncMiddlewareToRouter();
    }

    // -----------------------------------------------------------------
    // The request lifecycle
    // -----------------------------------------------------------------

    /**
     * Handle an incoming HTTP request.
     *
     * `app` is the application this request runs on -- its sandbox. It
     * defaults to the kernel's own, which is the root, for a caller outside
     * the worker; see the class comment for why it is not simply read off the
     * kernel.
     */
    public handle(request: Request, app: Application = this.app): Response
    {
        app.instance(RequestStartedAt, os.clock());

        let response: Response;

        try {
            response = this.sendRequestThroughRouter(request, app);
        } catch (e) {
            this.reportException(e, app);

            response = this.renderException(request, e, app);
        }

        this.events(app).dispatch(new RequestHandled(request, response));

        return response;
    }

    /** Send the given request through the middleware / router. */
    protected sendRequestThroughRouter(request: Request, app: Application): Response
    {
        app.instance('request', request);

        // PHP also clears the `Request` facade's resolved instance; there is no
        // request facade here to clear.

        this.bootstrap();

        const pipeline = new Pipeline(app)
            .send(request)
            .through(app.shouldSkipMiddleware() ? new Array<Pipe>() : this.middleware);

        return pipeline.then((passable: Passable) => this.dispatchToRouter(passable as Request, app)) as Response;
    }

    /** Bootstrap the application for HTTP requests. */
    public bootstrap(): void
    {
        if (!this.app.hasBeenBootstrapped()) {
            this.app.bootstrapWith(this.bootstrappers());
        }
    }

    /** Get the route dispatcher callback. */
    protected dispatchToRouter(request: Request, app: Application): Response
    {
        app.instance('request', request);

        // The router is a singleton built on the root application and holds it;
        // `app` is the sandbox this request runs on, and it is the one the
        // route, its controller and its middleware have to resolve out of --
        // not least because the `"request"` bound a line above is bound there.
        return this.router.dispatch(request, app);
    }

    /**
     * Perform any final actions for the request lifecycle.
     *
     * Takes the application the request ran on for the same reason `handle()`
     * does, and more sharply: the worker defers this, so by the time it runs
     * the kernel has very likely been asked to serve something else.
     */
    public terminate(request: Request, response: Response, app: Application = this.app): void
    {
        this.events(app).dispatch(new Terminating());

        this.terminateMiddleware(request, response, app);

        app.terminate();

        const startedAt = this.requestStartedAt(app);

        if (startedAt === undefined) {
            return;
        }

        // PHP moves the start time into the configured timezone first; there is
        // no wall clock here to move it to.
        const finishedAt = os.clock();

        for (const entry of this.requestLifecycleDurationHandlers) {
            if ((finishedAt - startedAt) * 1000 > entry.threshold) {
                entry.handler(startedAt, request, response);
            }
        }

        // PHP clears the property here. Nothing to clear: the sandbox holding
        // this is thrown away by the worker on the very next line of its own
        // `finally`, and a caller that passed no application is writing to the
        // root, where the next `handle()` overwrites it.
    }

    /** Call the terminate method on any terminable middleware. */
    protected terminateMiddleware(request: Request, response: Response, app: Application): void
    {
        if (app.shouldSkipMiddleware()) {
            return;
        }

        const middlewares = [
            ...this.gatherRouteMiddleware(request),
            ...this.middleware,
        ];

        for (const middleware of middlewares) {
            // PHP skips anything that is not a string, which is its way of
            // saying "anything the container cannot resolve by name": a closure
            // pipe, or one that was handed over already built.
            if (!this.resolvable(middleware)) {
                continue;
            }

            const [name] = this.parseMiddleware(middleware);
            const instance = app.make(name) as Record<string, unknown>;
            const terminate = instance.terminate;

            if (typeIs(terminate, 'function')) {
                (terminate as (self: object, request: Request, response: Response) => void)(
                    instance,
                    request,
                    response,
                );
            }
        }
    }

    /** Register a callback to be invoked when the request lifecycle duration exceeds a given amount of time. */
    public whenRequestLifecycleIsLongerThan(
        threshold: number,
        handler: (startedAt: number, request: Request, response: Response) => void,
    ): void
    {
        this.requestLifecycleDurationHandlers.push({
            threshold: threshold,
            handler: handler,
        });
    }

    /** When the request being handled started, as `os.clock()` read it. */
    public requestStartedAt(app: Application = this.app): number | undefined
    {
        return app.bound(RequestStartedAt) ? (app.make(RequestStartedAt) as number) : undefined;
    }

    /** Gather the route middleware for the given request. */
    protected gatherRouteMiddleware(request: Request): Array<Pipe>
    {
        // `route()` answers a parameter when given a name and the route itself
        // when not, so PHP's return type is mixed and so is this one.
        const route = request.route() as Route | undefined;

        return route !== undefined ? this.router.gatherRouteMiddleware(route) : new Array<Pipe>();
    }

    /**
     * Parse a middleware entry to get the name and parameters.
     *
     * The same two spellings `Pipeline::parsePipeString()` reads: PHP's
     * `"throttle:60,1"`, and the list a class carries its arguments in.
     */
    protected parseMiddleware(middleware: Pipe): [Abstract, Array<string>]
    {
        if (Util.isArray(middleware)) {
            const list = middleware as Array<defined>;
            const parameters = new Array<string>();

            for (let index = 1; index < list.size(); index++) {
                parameters.push(list[index] as string);
            }

            return [
                list[0] as Abstract,
                parameters,
            ];
        }

        if (!typeIs(middleware, 'string')) {
            return [
                middleware as Abstract,
                [],
            ];
        }

        const separator = middleware.find(':')[0];

        if (separator === undefined) {
            return [
                middleware,
                [],
            ];
        }

        return [
            middleware.sub(1, separator - 1),
            middleware.sub(separator + 1).split(','),
        ];
    }

    /** Determine whether the container can resolve the given middleware by name. */
    protected resolvable(middleware: Pipe): boolean
    {
        const [name] = this.parseMiddleware(middleware);

        if (typeIs(name, 'string')) {
            return true;
        }

        // A class table is a class waiting to be resolved; an instance of one
        // has already been built and PHP would have skipped it.
        return typeIs(name, 'table') && !this.isInstance(name);
    }

    /** Tell an instance apart from a class waiting to be resolved. */
    protected isInstance(value: object): boolean
    {
        const metatable = getmetatable(value) as object | undefined;

        return metatable !== undefined && rawget(metatable, '__index') === metatable;
    }

    // -----------------------------------------------------------------
    // The middleware stack
    // -----------------------------------------------------------------

    /** Determine if the kernel has a given middleware. */
    public hasMiddleware(middleware: Pipe): boolean
    {
        return this.middleware.includes(middleware);
    }

    /** Add a new middleware to the beginning of the stack if it does not already exist. */
    public prependMiddleware(middleware: Pipe): this
    {
        if (!this.middleware.includes(middleware)) {
            this.middleware.unshift(middleware);
        }

        return this;
    }

    /** Add a new middleware to end of the stack if it does not already exist. */
    public pushMiddleware(middleware: Pipe): this
    {
        if (!this.middleware.includes(middleware)) {
            this.middleware.push(middleware);
        }

        return this;
    }

    /** Prepend the given middleware to the given middleware group. */
    public prependMiddlewareToGroup(group: string, middleware: Pipe): this
    {
        const groupMiddleware = this.middlewareGroups[group];

        if (groupMiddleware === undefined) {
            throw new InvalidArgumentException(`The [${group}] middleware group has not been defined.`);
        }

        if (!groupMiddleware.includes(middleware)) {
            groupMiddleware.unshift(middleware);
        }

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Append the given middleware to the given middleware group. */
    public appendMiddlewareToGroup(group: string, middleware: Pipe): this
    {
        const groupMiddleware = this.middlewareGroups[group];

        if (groupMiddleware === undefined) {
            throw new InvalidArgumentException(`The [${group}] middleware group has not been defined.`);
        }

        if (!groupMiddleware.includes(middleware)) {
            groupMiddleware.push(middleware);
        }

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Prepend the given middleware to the middleware priority list. */
    public prependToMiddlewarePriority(middleware: Pipe): this
    {
        if (!this.middlewarePriority.includes(middleware)) {
            this.middlewarePriority.unshift(middleware);
        }

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Append the given middleware to the middleware priority list. */
    public appendToMiddlewarePriority(middleware: Pipe): this
    {
        if (!this.middlewarePriority.includes(middleware)) {
            this.middlewarePriority.push(middleware);
        }

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Add the given middleware to the middleware priority list before other middleware. */
    public addToMiddlewarePriorityBefore(before: Pipe | Array<Pipe>, middleware: Pipe): this
    {
        return this.addToMiddlewarePriorityRelative(before, middleware, false);
    }

    /** Add the given middleware to the middleware priority list after other middleware. */
    public addToMiddlewarePriorityAfter(after: Pipe | Array<Pipe>, middleware: Pipe): this
    {
        return this.addToMiddlewarePriorityRelative(after, middleware);
    }

    /** Add the given middleware to the middleware priority list relative to other middleware. */
    protected addToMiddlewarePriorityRelative(existing: Pipe | Array<Pipe>, middleware: Pipe, after = true): this
    {
        if (!this.middlewarePriority.includes(middleware)) {
            let index = after ? 0 : this.middlewarePriority.size();

            for (const existingMiddleware of Arr.wrap(existing)) {
                const middlewareIndex = this.middlewarePriority.indexOf(existingMiddleware);

                if (middlewareIndex < 0) {
                    continue;
                }

                if (after && middlewareIndex > index) {
                    index = middlewareIndex + 1;
                } else if (!after && middlewareIndex < index) {
                    index = middlewareIndex;
                }
            }

            // PHP: `array_splice($priority, $index, 0, $middleware)`.
            // `insert()` takes the same 0-based position, so index 0 puts the
            // entry at the front and `size()` appends -- there is nothing here
            // for the ends to special-case.
            this.middlewarePriority.insert(index, middleware);
        }

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Sync the current state of the middleware to the router. */
    protected syncMiddlewareToRouter(): void
    {
        this.router.middlewarePriority = this.middlewarePriority;

        for (const [group, middleware] of pairs(this.middlewareGroups)) {
            this.router.middlewareGroup(group as string, middleware as Array<Pipe>);
        }

        for (const [alias, middleware] of pairs(this.middlewareAliases)) {
            this.router.aliasMiddleware(alias as string, middleware as Pipe);
        }
    }

    /** Get the priority-sorted list of middleware. */
    public getMiddlewarePriority(): Array<Pipe>
    {
        return this.middlewarePriority;
    }

    /** Set the application's middleware priority. */
    public setMiddlewarePriority(priority: Array<Pipe>): this
    {
        this.middlewarePriority = priority;

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Get the application's global middleware. */
    public getGlobalMiddleware(): Array<Pipe>
    {
        return this.middleware;
    }

    /** Set the application's global middleware. */
    public setGlobalMiddleware(middleware: Array<Pipe>): this
    {
        this.middleware = middleware;

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Get the application's route middleware groups. */
    public getMiddlewareGroups(): Record<string, Array<Pipe>>
    {
        return this.middlewareGroups;
    }

    /** Set the application's middleware groups. */
    public setMiddlewareGroups(groups: Record<string, Array<Pipe>>): this
    {
        this.middlewareGroups = groups;

        this.syncMiddlewareToRouter();

        return this;
    }

    /** Get the application's route middleware aliases. */
    public getMiddlewareAliases(): Record<string, Pipe>
    {
        return this.middlewareAliases;
    }

    /** Set the application's route middleware aliases. */
    public setMiddlewareAliases(aliases: Record<string, Pipe>): this
    {
        this.middlewareAliases = aliases;

        this.syncMiddlewareToRouter();

        return this;
    }

    // -----------------------------------------------------------------
    // The rest
    // -----------------------------------------------------------------

    /** Get the bootstrap classes for the application. */
    protected bootstrappers(): Array<Constructor<Bootstrapper>>
    {
        return this.bootstrappersList;
    }

    /** Report the exception to the exception handler. */
    protected reportException(e: unknown, app: Application = this.app): void
    {
        app.make<Handler>(Handler).report(e);
    }

    /** Render the exception to a response. */
    protected renderException(request: Request, e: unknown, app: Application = this.app): Response
    {
        return app.make<Handler>(Handler).render(request, e);
    }

    /** The event dispatcher, which PHP reaches as `$this->app['events']`. */
    protected events(app: Application = this.app): Dispatcher
    {
        return app.make<Dispatcher>('events');
    }

    /** Get the application instance. */
    public getApplication(): Application
    {
        return this.app;
    }

    /** Set the application instance. */
    public setApplication(app: Application): this
    {
        this.app = app;

        return this;
    }
}
