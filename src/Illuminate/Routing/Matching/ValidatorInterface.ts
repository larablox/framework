import type { Request } from "Illuminate/Http/Request";
import type { Route } from "Illuminate/Routing/Route";

/** PHP: `Illuminate\Routing\Matching\ValidatorInterface`. */
export interface ValidatorInterface {
    /** Validate a given rule against a route and request. */
    matches(route: Route, request: Request): boolean;
}
