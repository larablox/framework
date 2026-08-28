import type { Container } from "Illuminate/Contracts/Container/Container";

/**
 * PHP: `interface Illuminate\Contracts\Container\ContextualAttribute`, an empty
 * marker whose implementations carry a static `resolve(self, Container)` and an
 * optional `after(self, $instance, Container)`.
 *
 * Interfaces are erased and Luau has no static-method lookup through an
 * instance, so the attribute instance carries the two hooks as properties. They
 * are called with the instance passed explicitly: a call through a
 * function-valued property compiles to a dot call and would drop `self`.
 */
export interface ContextualAttribute {
    /** Resolve the value the annotated parameter should receive. */
    readonly resolve?: (attribute: never, container: Container) => unknown;

    /** Run after the annotated dependency has been resolved. */
    readonly after?: (attribute: never, instance: never, container: Container) => void;
}

/** PHP: the handler registered with `Container::whenHasAttribute()`. */
export type ContextualAttributeHandler = (attribute: never, container: Container) => unknown;

/** PHP: the callback registered with `Container::afterResolvingAttribute()`. */
export type AfterResolvingAttributeCallback = (attribute: never, instance: never, container: Container) => void;
