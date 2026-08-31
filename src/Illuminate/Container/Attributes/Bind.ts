import { Attributes } from 'Illuminate/Container/Attributes/Attributes';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Util } from 'Illuminate/Container/Util';
import type { Concrete } from 'Illuminate/Container/Types';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)] class Bind`. */
export interface Bind
{
    /** The concrete class to bind to. */
    readonly concrete: Concrete;

    /** The environments the binding should apply for. */
    readonly environments: Array<string>;
}

/**
 * Bind the decorated abstract to a concrete implementation, optionally only for
 * the given environments. Repeatable: the first attribute whose environments
 * match wins, with `["*"]` as the fallback.
 */
export function Bind(concrete: Concrete, environments: string | Array<string> = ['*'])
{
    const wrapped = (typeIs(environments, 'string') ? [environments] : environments)
        .filter((environment) => Util.truthy(environment));

    if (wrapped.isEmpty()) {
        throw new InvalidArgumentException('The environment property must be set and cannot be empty.');
    }

    return (target: object): void => {
        Attributes.add(target, Bind, { concrete, environments: wrapped });
    };
}
