import type { Request } from "Illuminate/Http/Request";
import type { Route } from "Illuminate/Routing/Route";

/** PHP: `Illuminate\Routing\Events\RouteMatched`. */
export class RouteMatched {
    /** Create a new event instance. */
    public constructor(
        public readonly route: Route,
        public readonly request: Request,
    ) {}
}
