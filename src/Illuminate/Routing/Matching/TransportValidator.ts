import type { Request } from 'Illuminate/Http/Request';
import type { Route } from 'Illuminate/Routing/Route';
import type { ValidatorInterface } from 'Illuminate/Routing/Matching/ValidatorInterface';

/**
 * Stands where PHP's `SchemeValidator` stands.
 *
 * A scheme says how a request travelled and a route may insist on one; here
 * that is the remote it arrived on. A route declared with an ordinary verb
 * answers on `call` and `send`; `Route::stream()` answers only on `stream`,
 * whose payload the engine caps and may drop; `Route::reliable()` narrows a
 * route to `call`, which is what `httpsOnly()` does in PHP.
 *
 * `HostValidator` has no counterpart at all -- there are no hosts.
 */
export class TransportValidator implements ValidatorInterface
{
    /** Validate a given rule against a route and request. */
    public matches(route: Route, request: Request): boolean
    {
        return route.transports().includes(request.transport());
    }
}
