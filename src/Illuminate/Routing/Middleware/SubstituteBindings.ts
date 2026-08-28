import { Inject } from 'Illuminate/Container/Attributes/Inject';
import type { Next } from 'Illuminate/Pipeline/Pipeline';
import type { Request } from 'Illuminate/Http/Request';
import type { Route } from 'Illuminate/Routing/Route';
import type { Router } from 'Illuminate/Routing/Router';

/**
 * PHP: `Illuminate\Routing\Middleware\SubstituteBindings`.
 *
 * Runs the binders registered with `Route::bind()` over the route parameters,
 * so an action is handed the thing the parameter names rather than its raw
 * text -- a `Player` instead of a user id, say.
 *
 * `substituteImplicitBindings()` is not here: implicit binding resolves a
 * model by its route key, and there are no models yet. The `getMissing()`
 * branch goes with it.
 */
export class SubstituteBindings {
    /** Create a new bindings substitutor. */
    public constructor(@Inject('router') protected readonly router: Router) {}

    /** Handle an incoming request. */
    public handle(request: Request, _next: Next): unknown {
        this.router.substituteBindings(request.route() as Route);

        return _next(request);
    }
}
