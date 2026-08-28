import { addParameterAttribute } from "Illuminate/Container/Attributes/Inject";
import type { Container } from "Illuminate/Contracts/Container/Container";
import type { ContextualAttribute } from "Illuminate/Contracts/Container/ContextualAttribute";

/** PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] final class Tag`. */
export interface Tag extends ContextualAttribute {
    readonly tag: string;
}

/** Resolve the annotated parameter from everything bound under the tag. */
export function Tag(tag: string) {
    const instance: Tag = {
        tag,
        resolve: (attribute: never, container: Container) => container.tagged((attribute as Tag).tag),
    };

    return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
        addParameterAttribute(owner, propertyKey, parameterIndex, Tag, instance);
    };
}
