import { addParameterAttribute } from 'Illuminate/Container/Attributes/Inject';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ContextualAttribute } from 'Illuminate/Contracts/Container/ContextualAttribute';
import type { Repository } from 'Illuminate/Contracts/Config/Repository';

/** PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] class Config`. */
export interface Config extends ContextualAttribute {
    readonly key: string;
    readonly default?: unknown;
}

/** Resolve the annotated parameter from the configuration repository. */
export function Config(key: string, defaultValue?: unknown) {
    const instance: Config = {
        key,
        default: defaultValue,
        resolve: (attribute: never, container: Container) =>
            container.make<Repository>('config').get((attribute as Config).key, (attribute as Config).default),
    };

    return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
        addParameterAttribute(owner, propertyKey, parameterIndex, Config, instance);
    };
}
