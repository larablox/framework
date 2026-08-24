import type { Request } from "Illuminate/Http/Request";
import type { Route } from "Illuminate/Routing/Route";
import type { ValidatorInterface } from "Illuminate/Routing/Matching/ValidatorInterface";

/**
 * PHP: `Illuminate\Routing\Matching\UriValidator`.
 *
 * PHP runs the compiled regular expression over the decoded path. There is
 * nothing to decode on a remote call, and the compiled route is a list of
 * segments rather than a pattern, so the walk lives in `CompiledRoute`.
 */
export class UriValidator implements ValidatorInterface {
    /** Validate a given rule against a route and request. */
    public matches(route: Route, request: Request): boolean {
        return (
            route.getCompiled().match(request.decodedPath(), route.wheres) !==
            undefined
        );
    }
}
