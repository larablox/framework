import { addParameterAttribute } from 'Illuminate/Container/Attributes/Inject';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ContextualAttribute } from 'Illuminate/Contracts/Container/ContextualAttribute';
import type { Request } from 'Illuminate/Http/Request';

/** PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] class RouteParameter`. */
export interface RouteParameter extends ContextualAttribute {
    readonly parameter: string;
}

/**
 * Resolve the annotated parameter from the route that matched.
 *
 * Route parameters otherwise fill an action's arguments in the order the URI
 * names them; this asks for one by name, which is what a PHP signature does
 * for free.
 */
export function RouteParameter(parameter: string) {
    const instance: RouteParameter = {
        parameter,
        resolve: (attribute: never, container: Container) =>
            container.make<Request>('request').route((attribute as RouteParameter).parameter),
    };

    return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
        addParameterAttribute(owner, propertyKey, parameterIndex, RouteParameter, instance);
    };
}
