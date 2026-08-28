import { Trait } from 'Illuminate/Support/Traits/Trait';
import { Util } from 'Illuminate/Container/Util';
import type { AssertNoExtraMembers, AssertTrue, Constructor } from 'Illuminate/Support/Traits/Trait';

/**
 * The instance type `Conditionable()` mixes in.
 *
 * A mixin returns an anonymous class expression, and declaration emit cannot
 * write one down once it has `private` or `protected` members (TS4094). The
 * way out is to name the type rather than let the compiler infer it: this
 * `declare class` is that name -- erased at runtime, emitted into the `.d.ts`,
 * and, being a *class* and not an interface, able to carry the visibility
 * Laravel's trait has. See `agent_docs/roblox-ts-constraints.md`, which has
 * the whole pattern; the three parts of it that are not obvious:
 *
 * - **`export`, not `export type { ... }`.** Every dependent declaration
 *   (`PendingRequest`, `Stringable`, `Response`, ...) has to name this type,
 *   so it must be exported or TS4094 comes back at *those* classes instead.
 *   The type-only export specifier would do that too, but roblox-ts does not
 *   erase one: it writes `ConditionableShape = ConditionableShape`, an
 *   unknown global, into the compiled module table. `export declare class`
 *   is erased completely. The `private constructor()` is there because that
 *   export is a value as far as TypeScript is concerned, and nothing answers
 *   to it at runtime.
 * - **`as never` on the `return` is required.** `protected` members from two
 *   separate declarations are never assignable to each other, so the
 *   annotation does not type-check without it. That cast is also why the
 *   shape is split in two: the public half is a separate class with no
 *   non-public member in it, which *can* be checked against the
 *   implementation -- `satisfies` on the class expression below, plus the
 *   `AssertNever` alias, cover it in both directions.
 * - **The non-public half stays unchecked.** `keyof` does not see
 *   `private`/`protected` members and no assignability check reaches across
 *   two declarations, so `resolveCondition` below is on the honour system:
 *   change it and change it here.
 */
export declare class ConditionablePublicShape {
    /** Type-only: there is no such value in the compiled Luau. */
    protected constructor();

    /** Apply the callback if the given "value" is (or resolves to) truthy. */
    public when<TWhenParameter extends defined, TWhenReturn extends defined>(
        value: TWhenParameter | ((target: this) => TWhenParameter) | undefined,
        callback: (target: this, value: TWhenParameter) => TWhenReturn | undefined,
        defaultCallback?: (target: this, value: TWhenParameter) => TWhenReturn | undefined,
    ): this | TWhenReturn;

    /** Apply the callback if the given "value" is (or resolves to) falsy. */
    public unless<TUnlessParameter extends defined, TUnlessReturn extends defined>(
        value: TUnlessParameter | ((target: this) => TUnlessParameter) | undefined,
        callback: (target: this, value: TUnlessParameter) => TUnlessReturn | undefined,
        defaultCallback?: (target: this, value: TUnlessParameter) => TUnlessReturn | undefined,
    ): this | TUnlessReturn;
}

/** The full shape: {@link ConditionablePublicShape} plus what Laravel hides. */
export declare class ConditionableShape extends ConditionablePublicShape {
    /** Type-only: there is no such value in the compiled Luau. */
    private constructor();

    /** PHP: `$value instanceof Closure ? $value($this) : $value`. */
    private resolveCondition<TValue extends defined>(
        value: TValue | ((target: this) => TValue) | undefined,
    ): TValue | undefined;
}

/**
 * The trait itself.
 *
 * Split out of `Conditionable()` below and left unannotated so that the two
 * checks on the shape have something concrete to look at: the annotation on
 * the exported factory would answer every question with the shape itself.
 */
function conditionable<TBase extends Constructor>(Base: TBase) {
    return class extends Base {
        /** Apply the callback if the given "value" is (or resolves to) truthy. */
        public when<TWhenParameter extends defined, TWhenReturn extends defined>(
            value: TWhenParameter | ((target: this) => TWhenParameter) | undefined,
            callback: (target: this, value: TWhenParameter) => TWhenReturn | undefined,
            defaultCallback?: (target: this, value: TWhenParameter) => TWhenReturn | undefined,
        ): this | TWhenReturn {
            const resolved = this.resolveCondition(value);

            if (Util.truthy(resolved)) {
                return callback(this, resolved as TWhenParameter) ?? this;
            }

            if (defaultCallback !== undefined) {
                return defaultCallback(this, resolved as TWhenParameter) ?? this;
            }

            return this;
        }

        /** Apply the callback if the given "value" is (or resolves to) falsy. */
        public unless<TUnlessParameter extends defined, TUnlessReturn extends defined>(
            value: TUnlessParameter | ((target: this) => TUnlessParameter) | undefined,
            callback: (target: this, value: TUnlessParameter) => TUnlessReturn | undefined,
            defaultCallback?: (target: this, value: TUnlessParameter) => TUnlessReturn | undefined,
        ): this | TUnlessReturn {
            const resolved = this.resolveCondition(value);

            if (!Util.truthy(resolved)) {
                return callback(this, resolved as TUnlessParameter) ?? this;
            }

            if (defaultCallback !== undefined) {
                return defaultCallback(this, resolved as TUnlessParameter) ?? this;
            }

            return this;
        }

        /** PHP: `$value instanceof Closure ? $value($this) : $value`. */
        private resolveCondition<TValue extends defined>(
            value: TValue | ((target: this) => TValue) | undefined,
        ): TValue | undefined {
            return typeIs(value, 'function') ? (value as (target: this) => TValue)(this) : value;
        }
    } satisfies Constructor<ConditionablePublicShape>;
}

/**
 * Every public member the trait has that the shape does not list.
 *
 * `satisfies` above covers the other direction (a member of the shape the
 * trait lost, or whose signature moved); this one covers a member added to
 * the trait and forgotten here. `keyof` yields public members only, which is
 * why the shape had to be split.
 */
type ConditionableExtra = Exclude<
    keyof InstanceType<ReturnType<typeof conditionable<typeof Trait>>>,
    keyof ConditionablePublicShape
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the assertion is the point: it fails to compile when the trait has a public member the shape does not list.
type ConditionableIsExact = AssertTrue<AssertNoExtraMembers<ConditionableExtra>>;

/**
 * PHP: `trait Illuminate\Support\Traits\Conditionable`.
 *
 * `when()` and `unless()` called with no callback return a
 * `HigherOrderWhenProxy`, which captures the condition and applies the next
 * method call through `__get` / `__call`. There is no `__call`, so the
 * callback is required here and the proxy is not ported.
 *
 * `if ($value)` is PHP truthiness, not a null check -- see `Util.truthy`.
 */
export function Conditionable<TBase extends Constructor>(
    Base: TBase = Trait as never,
): TBase & Constructor<ConditionableShape> {
    return conditionable(Base) as never;
}
