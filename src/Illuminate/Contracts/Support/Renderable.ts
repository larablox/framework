/** PHP: `interface Renderable`. */
export interface Renderable {
    /** Get the evaluated contents of the object. */
    render(): string;
}

/** PHP: `$value instanceof Renderable`. Interfaces are erased; see `isArrayable`. */
export function isRenderable(value: unknown): value is Renderable {
    return typeIs(value, "table") && typeIs((value as Renderable).render, "function");
}
