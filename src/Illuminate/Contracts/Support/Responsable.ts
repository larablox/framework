import type { Request } from "Illuminate/Http/Request";
import type { Response } from "Illuminate/Http/Response";

/** PHP: `interface Responsable`. */
export interface Responsable {
    /** Create a response from the object. */
    toResponse(request: Request): Response;
}

/**
 * PHP: `$value instanceof Responsable`.
 *
 * Interfaces are erased, so the check asks for the one method the interface
 * required -- the same trade `Arrayable` makes.
 */
export function isResponsable(value: unknown): value is Responsable {
    return (
        typeIs(value, "table") &&
        typeIs((value as Responsable).toResponse, "function")
    );
}
