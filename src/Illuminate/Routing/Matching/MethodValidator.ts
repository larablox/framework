import type { Request } from 'Illuminate/Http/Request';
import type { Route } from 'Illuminate/Routing/Route';
import type { ValidatorInterface } from 'Illuminate/Routing/Matching/ValidatorInterface';

/** PHP: `Illuminate\Routing\Matching\MethodValidator`. */
export class MethodValidator implements ValidatorInterface {
    /** Validate a given rule against a route and request. */
    public matches(route: Route, request: Request): boolean {
        return route.methods().includes(request.method());
    }
}
