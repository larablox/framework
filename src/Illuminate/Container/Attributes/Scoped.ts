import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] final class Scoped`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Scoped {}

/**
 * Resolve the decorated class as a shared instance that is flushed by
 * `Container::forgetScopedInstances()`.
 */
export function Scoped() {
    return (target: object): void => {
        Attributes.add(target, Scoped, {});
    };
}
