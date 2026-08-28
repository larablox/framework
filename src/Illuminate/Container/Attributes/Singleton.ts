import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] final class Singleton`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Singleton
{}

/**
 * Resolve the decorated class as a shared instance, without an explicit
 * `singleton()` binding.
 */
export function Singleton()
{
    return (target: object): void => {
        Attributes.add(target, Singleton, {});
    };
}
