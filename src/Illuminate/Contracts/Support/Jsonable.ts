/**
 * PHP: `interface Jsonable`.
 *
 * `toJson($options)` takes PHP's `JSON_*` bitmask; `HttpService:JSONEncode`
 * has no options at all, so the parameter is dropped rather than ignored.
 */
export interface Jsonable {
    /** Convert the object to its JSON representation. */
    toJson(): string;
}

/** PHP: `$value instanceof Jsonable`. Interfaces are erased; see `isArrayable`. */
export function isJsonable(value: unknown): value is Jsonable {
    return typeIs(value, "table") && typeIs((value as Jsonable).toJson, "function");
}
