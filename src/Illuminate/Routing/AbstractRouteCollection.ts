import { MethodNotAllowedHttpException, NotFoundHttpException } from 'Illuminate/Http/Exceptions/HttpException';
import { Response } from 'Illuminate/Http/Response';
import { Route } from 'Illuminate/Routing/Route';
import type { Request } from 'Illuminate/Http/Request';

/**
 * PHP: `Illuminate\Routing\AbstractRouteCollection`.
 *
 * The base stays even though only one collection is built on it: PHP's other
 * one, `CompiledRouteCollection`, is Symfony's compiler and route caching,
 * neither of which exists here.
 */
export abstract class AbstractRouteCollection {
    /** Find the first route matching a given request. */
    public abstract match(request: Request): Route;

    /** Get all of the routes in the collection. */
    public abstract getRoutes(): Array<Route>;

    /** Get routes from the collection by method. */
    public abstract get(method?: string): Array<Route>;

    /** The verbs the collection holds routes for. */
    protected abstract registeredMethods(): Array<string>;

    /** Determine if the route collection contains a given named route. */
    public abstract hasNamedRoute(name: string): boolean;

    /** Determine the first route matching the given request. */
    protected matchAgainstRoutes(routes: Array<Route>, request: Request, includingMethod = true): Route | undefined {
        let fallbackRoute: Route | undefined;

        for (const route of routes) {
            if (!route.matches(request, includingMethod)) {
                continue;
            }

            if (route.isFallback) {
                fallbackRoute = fallbackRoute ?? route;

                continue;
            }

            return route;
        }

        return fallbackRoute;
    }

    /** Handle the matched route. */
    protected handleMatchedRoute(request: Request, route?: Route): Route {
        if (route !== undefined) {
            // PHP binds the collection's own route, because nothing else will
            // ever run through it. Here it is a template and the request gets a
            // copy -- see `Route::forRequest()`. This is the one place a shared
            // route becomes "the route of this request", so it is the one place
            // that has to copy.
            return route.forRequest(request);
        }

        // If no route was found we will now check if a matching route is specified by
        // another HTTP verb. If it is we will need to throw a MethodNotAllowed and
        // inform the user agent of which HTTP verb it should use for this route.
        const others = this.checkForAlternateVerbs(request);

        if (others.size() > 0) {
            return this.getRouteForMethods(request, others);
        }

        throw new NotFoundHttpException(`The route ${request.path()} could not be found.`);
    }

    /**
     * Determine if any routes match on another HTTP verb.
     *
     * PHP walks `Router::$verbs`; walking the verbs the collection actually
     * holds answers the same question -- a route can only match a verb it was
     * registered under -- and spares the collection a value import of the
     * router, which imports it back.
     */
    protected checkForAlternateVerbs(request: Request): Array<string> {
        const others = new Array<string>();

        for (const method of this.alternateVerbOrder()) {
            if (method === request.method()) {
                continue;
            }

            if (this.matchAgainstRoutes(this.get(method), request, false) !== undefined) {
                others.push(method);
            }
        }

        return others;
    }

    /**
     * The order `checkForAlternateVerbs()` walks the registered methods in.
     *
     * PHP walks `Router::$verbs`, which is what puts the `Allow` header's
     * methods in that order rather than in registration order -- a URI
     * registered for `['GET', 'POST']` answers `GET,HEAD,POST`, not
     * `GET,POST,HEAD`. Spelled out here rather than imported: `Router`
     * imports the collection back.
     */
    protected alternateVerbOrder(): Array<string> {
        const verbs = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
        const registered = this.registeredMethods();

        return [
            ...verbs.filter((verb) => registered.includes(verb)),
            ...registered.filter((verb) => !verbs.includes(verb)),
        ];
    }

    /** Get a route (if necessary) that responds when other available methods are present. */
    protected getRouteForMethods(request: Request, methods: Array<string>): Route {
        if (request.isMethod('OPTIONS')) {
            return new Route('OPTIONS', request.path(), {
                uses: () =>
                    new Response(undefined, Response.HTTP_OK, {
                        Allow: methods.join(','),
                    }),
            }).bind(request);
        }

        this.requestMethodNotAllowed(request, methods, request.method());
    }

    /** Throw a method not allowed HTTP exception. */
    protected requestMethodNotAllowed(request: Request, others: Array<string>, method: string): never {
        throw new MethodNotAllowedHttpException(
            others,
            `The ${method} method is not supported for route ${request.path()}. Supported methods: ${others.join(', ')}.`,
        );
    }
}
