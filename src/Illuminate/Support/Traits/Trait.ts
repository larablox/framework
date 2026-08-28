/* eslint-disable roblox-ts/no-any, @typescript-eslint/no-explicit-any -- TS2545 requires a mixin constructor to be `(...args: any[])`. */
/**
 * The machinery every ported trait is built on.
 *
 * PHP composes a class from several traits at once; TypeScript has single
 * inheritance, so a trait is written as a mixin -- a function taking a base
 * class and returning it extended. `use Conditionable, Tappable;` becomes
 * `extends Tappable(Conditionable())`, and the traits stack in any order and
 * any combination, which a fixed base-class chain could not do.
 *
 * What this costs, measured on the emitted Luau:
 *
 * - each application builds a **new** class, so `instanceof` against a trait is
 *   meaningless -- ask for the method instead;
 * - the intermediate class is anonymous and its `__tostring` reports
 *   `"Anonymous"`. Only the leaf keeps its name, which is what error messages
 *   and `Reflector.className()` print, but a walk up `parentClass()` will pass
 *   through the unnamed links;
 * - `Constructor` has to be `new (...args: Array<any>) => T`. Narrowing the
 *   argument list (to `Array<never>`, say) makes TypeScript reject the mixed
 *   class with "Base constructors must all have the same return type".
 */
export type Constructor<T = object> = new (...args: Array<any>) => T;

/**
 * Fails to compile unless `TKeys` is `never`, naming the offending key.
 *
 * Used by the traits to assert that a mixin has no public member its declared
 * shape does not list. `Exclude<...>` there evaluates to the extra keys, and
 * this turns them into an error that reads "Type '{ error: ...; member:
 * "sneaky"; }' does not satisfy the constraint 'true'" -- a bare
 * `T extends never` constraint reports only `string`, which does not say what
 * to go and fix. See `agent_docs/roblox-ts-constraints.md`.
 */
export type AssertNoExtraMembers<TKeys> = [TKeys] extends [never]
    ? true
    : {
          error: 'this member is public on the trait but missing from its declared shape';
          member: TKeys;
      };

/** Fails to compile unless `T` is `true`; pairs with {@link AssertNoExtraMembers}. */
export type AssertTrue<T extends true> = T;

/**
 * What a trait mixes into when the class using it has no parent of its own.
 *
 * Compiled, this is an ordinary class with an empty constructor, so the
 * `super.constructor(self, ...)` roblox-ts emits into every subclass has
 * something to call.
 */
export class Trait {}
