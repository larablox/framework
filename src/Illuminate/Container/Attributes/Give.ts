import { addParameterAttribute } from 'Illuminate/Container/Attributes/Inject';
import type { Abstract, ParameterList } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ContextualAttribute } from 'Illuminate/Contracts/Container/ContextualAttribute';

/** PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] class Give`. */
export interface Give extends ContextualAttribute {
    readonly class: Abstract;
    readonly params?: ParameterList;
}

/** Resolve the annotated parameter from the given concrete implementation. */
export function Give(target: Abstract, params?: ParameterList) {
    const instance: Give = {
        class: target,
        params,
        resolve: (attribute: never, container: Container) =>
            container.make((attribute as Give).class, (attribute as Give).params),
    };

    return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
        addParameterAttribute(owner, propertyKey, parameterIndex, Give, instance);
    };
}
