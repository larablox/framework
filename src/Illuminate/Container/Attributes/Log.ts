import { addParameterAttribute } from 'Illuminate/Container/Attributes/Inject';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ContextualAttribute } from 'Illuminate/Contracts/Container/ContextualAttribute';
import type { LogManager } from 'Illuminate/Log/LogManager';

/**
 * PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] class Log`.
 *
 * The `name` argument is not ported: PHP reaches `Monolog::withName()` through
 * the `__call` forwarding on `Illuminate\Log\Logger`, which Luau has no way to
 * express.
 */
export interface Log extends ContextualAttribute {
    readonly channel?: string;
}

/** Resolve the annotated parameter to a log channel. */
export function Log(channel?: string) {
    const instance: Log = {
        channel,
        resolve: (attribute: never, container: Container) =>
            container.make<LogManager>('log').channel((attribute as Log).channel),
    };

    return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
        addParameterAttribute(owner, propertyKey, parameterIndex, Log, instance);
    };
}
