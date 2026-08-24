import { Facade } from "Illuminate/Support/Facades/Facade";
import { Forwards } from "Illuminate/Support/Facades/Forwards";
import type { Abstract } from "Illuminate/Container/Types";
import type { Forwarded } from "Illuminate/Support/Facades/Forwards";
import type { Router } from "Illuminate/Routing/Router";

/**
 * @see Illuminate/Routing/Router
 *
 * PHP reaches the fluent registrations (`Route::middleware(...)`,
 * `Route::prefix(...)`) through `Router::__call`; here they are ordinary
 * methods on the router, so the facade forwards them like any other.
 */
@Forwards()
export class Route extends Facade {
    declare public static get: Forwarded<Router["get"]>;

    declare public static post: Forwarded<Router["post"]>;

    declare public static put: Forwarded<Router["put"]>;

    declare public static patch: Forwarded<Router["patch"]>;

    declare public static delete: Forwarded<Router["delete"]>;

    declare public static options: Forwarded<Router["options"]>;

    declare public static any: Forwarded<Router["any"]>;

    declare public static match: Forwarded<Router["match"]>;

    declare public static stream: Forwarded<Router["stream"]>;

    declare public static fallback: Forwarded<Router["fallback"]>;

    declare public static group: Forwarded<Router["group"]>;

    declare public static middleware: Forwarded<Router["middleware"]>;

    declare public static withoutMiddleware: Forwarded<
        Router["withoutMiddleware"]
    >;

    declare public static as: Forwarded<Router["as"]>;

    declare public static name: Forwarded<Router["name"]>;

    declare public static prefix: Forwarded<Router["prefix"]>;

    declare public static where: Forwarded<Router["where"]>;

    declare public static aliasMiddleware: Forwarded<Router["aliasMiddleware"]>;

    declare public static middlewareGroup: Forwarded<Router["middlewareGroup"]>;

    declare public static pushMiddlewareToGroup: Forwarded<
        Router["pushMiddlewareToGroup"]
    >;

    declare public static prependMiddlewareToGroup: Forwarded<
        Router["prependMiddlewareToGroup"]
    >;

    declare public static bind: Forwarded<Router["bind"]>;

    declare public static pattern: Forwarded<Router["pattern"]>;

    declare public static patterns: Forwarded<Router["patterns"]>;

    declare public static has: Forwarded<Router["has"]>;

    declare public static is: Forwarded<Router["is"]>;

    declare public static current: Forwarded<Router["current"]>;

    declare public static currentRouteName: Forwarded<
        Router["currentRouteName"]
    >;

    declare public static currentRouteNamed: Forwarded<
        Router["currentRouteNamed"]
    >;

    declare public static currentRouteAction: Forwarded<
        Router["currentRouteAction"]
    >;

    declare public static uses: Forwarded<Router["uses"]>;

    declare public static getRoutes: Forwarded<Router["getRoutes"]>;

    declare public static dispatch: Forwarded<Router["dispatch"]>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return "router";
    }
}
