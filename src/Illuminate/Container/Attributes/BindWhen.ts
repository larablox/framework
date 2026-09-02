import { Attributes } from 'Illuminate/Container/Attributes/Attributes';
import type { Concrete } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)] class BindWhen`. */
export interface BindWhen
{
    /** The concrete class to bind to. */
    readonly concrete: Concrete;

    /** The condition that determines if the binding should apply. */
    readonly condition: (container: Container) => boolean;
}

/**
 * Bind the decorated abstract to a concrete implementation when the given
 * condition holds. Repeatable: the first attribute whose condition matches
 * wins, checked in declaration order alongside any `Bind` attributes on the
 * same class.
 */
export function BindWhen(concrete: Concrete, condition: (container: Container) => boolean)
{
    return (target: object): void => {
        Attributes.add(target, BindWhen, { concrete, condition });
    };
}
