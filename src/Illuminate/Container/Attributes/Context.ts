import { Repository } from 'Illuminate/Log/Context/Repository';
import { addParameterAttribute } from 'Illuminate/Container/Attributes/Inject';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ContextualAttribute } from 'Illuminate/Contracts/Container/ContextualAttribute';

/** PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] class Context`. */
export interface Context extends ContextualAttribute {
    readonly key: string;
    readonly default?: unknown;
    readonly hidden: boolean;
}

/** Resolve the annotated parameter from the log context repository. */
export function Context(key: string, defaultValue?: unknown, hidden = false) {
    const instance: Context = {
        key,
        default: defaultValue,
        hidden,
        resolve: (attribute: never, container: Container) => {
            const repository = container.make(Repository);
            const context = attribute as Context;

            return context.hidden
                ? repository.getHidden(context.key, context.default)
                : repository.get(context.key, context.default);
        },
    };

    return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
        addParameterAttribute(owner, propertyKey, parameterIndex, Context, instance);
    };
}
