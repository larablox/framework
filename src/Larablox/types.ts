/**
 * The shape a `___call` implementation's dynamically-resolved method value
 * has: the method name is only a runtime string, so arity and argument/
 * return types can't be known statically - this is as much of a call
 * signature as there is to promise up front. The TS analogue of PHP's own
 * `callable` type hint, which carries exactly as little.
 */
export type Callable = (...args: unknown[]) => unknown;

/**
 * The base a trait's mixin factory accepts. TS2545: a mixin base's
 * constructor must accept a single `any[]` rest parameter - the `any` is
 * required literally, see CONVENTIONS.md "Traits".
 */
export type AnyConstructor<T = object> = new (...args: any[]) => T;
