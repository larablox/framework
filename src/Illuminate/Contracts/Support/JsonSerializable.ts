/**
 * PHP: `interface JsonSerializable`, which lives in the global namespace and
 * belongs to PHP itself rather than to Laravel.
 *
 * A vendor namespace is a top-level directory here, and PHP's own has no
 * counterpart, so the interface is filed beside the Laravel contracts that
 * always travel with it (`Arrayable`, `Jsonable`).
 */
export interface JsonSerializable {
    /** Specify data which should be serialized to JSON. */
    jsonSerialize(): unknown;
}

/** PHP: `$value instanceof JsonSerializable`. Interfaces are erased; see `isArrayable`. */
export function isJsonSerializable(value: unknown): value is JsonSerializable {
    return typeIs(value, "table") && typeIs((value as JsonSerializable).jsonSerialize, "function");
}
