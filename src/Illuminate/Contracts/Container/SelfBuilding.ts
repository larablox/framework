import type { Constructor } from "Illuminate/Container/Types";

/**
 * PHP: `interface SelfBuilding` with a `@method static newInstance(): static`.
 *
 * A class that builds itself. Laravel detects it with
 * `is_a($concrete, SelfBuilding::class, true)`; interfaces do not exist at
 * runtime here, so the container looks for the static method instead.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SelfBuilding {}

export type SelfBuildingClass = Constructor & {
    newInstance: Callback;
};

/** PHP: `is_a($concrete, SelfBuilding::class, true) && method_exists(...)`. */
export function isSelfBuilding(
    concrete: unknown,
): concrete is SelfBuildingClass {
    return (
        typeIs(concrete, "table") &&
        typeIs((concrete as { newInstance?: unknown }).newInstance, "function")
    );
}
