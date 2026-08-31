import { HigherOrderWhenProxy } from 'Illuminate/Support/HigherOrderWhenProxy';
import { Trait } from 'Illuminate/Support/Traits/Trait';
import { Util } from 'Illuminate/Container/Util';
import type { AssertNoExtraMembers, AssertTrue, Constructor } from 'Illuminate/Support/Traits/Trait';
import type { WhenProxyCapture, WhenProxyConditioned } from 'Illuminate/Support/HigherOrderWhenProxy';

/** PHP: `(\Closure($this): TWhenParameter)|TWhenParameter|null` -- the condition. */
export type ConditionValue<TTarget, TParameter> = TParameter | ((target: TTarget) => TParameter) | undefined;

/** PHP: `(callable($this, TWhenParameter): TWhenReturnType)|null` -- a branch. */
export type ConditionCallback<TTarget, TParameter, TReturnType> = (
    target: TTarget,
    value: TParameter,
) => TReturnType | undefined;

/** The three optional arguments, as the countable tuple `func_num_args()` needs. */
export type ConditionArguments<TTarget, TParameter, TReturnType> = [
    value?: TParameter | ((target: TTarget) => TParameter),
    callback?: ConditionCallback<TTarget, TParameter, TReturnType>,
    _default?: ConditionCallback<TTarget, TParameter, TReturnType>,
];

/** Everything `when()`/`unless()` can answer with, by arity. */
export type ConditionResult<TTarget, TReturnType> =
    | TTarget
    | TReturnType
    | WhenProxyCapture<TTarget>
    | WhenProxyConditioned<TTarget>;

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
 *   two declarations — a non-public member added below must be added to the
 *   full shape by hand.
 */
export declare class ConditionablePublicShape
{
    /** Type-only: there is no such value in the compiled Luau. */
    protected constructor();

    /** Apply the callback if the given "value" is (or resolves to) truthy. */
    public when(): WhenProxyCapture<this>;
    public when<TWhenParameter extends defined>(
        value: ConditionValue<this, TWhenParameter>,
    ): WhenProxyConditioned<this>;
    public when<TWhenParameter extends defined, TWhenReturnType extends defined>(
        value: ConditionValue<this, TWhenParameter>,
        callback: ConditionCallback<this, TWhenParameter, TWhenReturnType>,
        _default?: ConditionCallback<this, TWhenParameter, TWhenReturnType>,
    ): this | TWhenReturnType;

    /** Apply the callback if the given "value" is (or resolves to) falsy. */
    public unless(): WhenProxyCapture<this>;
    public unless<TUnlessParameter extends defined>(
        value: ConditionValue<this, TUnlessParameter>,
    ): WhenProxyConditioned<this>;
    public unless<TUnlessParameter extends defined, TUnlessReturnType extends defined>(
        value: ConditionValue<this, TUnlessParameter>,
        callback: ConditionCallback<this, TUnlessParameter, TUnlessReturnType>,
        _default?: ConditionCallback<this, TUnlessParameter, TUnlessReturnType>,
    ): this | TUnlessReturnType;
}

/** The full shape: {@link ConditionablePublicShape} plus what Laravel hides. */
export declare class ConditionableShape extends ConditionablePublicShape
{
    /** Type-only: there is no such value in the compiled Luau. */
    private constructor();
}

/**
 * The trait itself.
 *
 * Split out of `Conditionable()` below and left unannotated so that the two
 * checks on the shape have something concrete to look at: the annotation on
 * the exported factory would answer every question with the shape itself.
 */
function conditionable<TBase extends Constructor>(Base: TBase)
{
    return class extends Base {
        /** Apply the callback if the given "value" is (or resolves to) truthy. */
        public when(): WhenProxyCapture<this>;
        public when<TWhenParameter extends defined>(
            value: ConditionValue<this, TWhenParameter>,
        ): WhenProxyConditioned<this>;
        public when<TWhenParameter extends defined, TWhenReturnType extends defined>(
            value: ConditionValue<this, TWhenParameter>,
            callback: ConditionCallback<this, TWhenParameter, TWhenReturnType>,
            _default?: ConditionCallback<this, TWhenParameter, TWhenReturnType>,
        ): this | TWhenReturnType;
        public when<TWhenParameter extends defined, TWhenReturnType extends defined>(
            ...args: ConditionArguments<this, TWhenParameter, TWhenReturnType>
        ): ConditionResult<this, TWhenReturnType>
        {
            let [value, callback, _default] = args;

            value = typeIs(value, 'function') ? (value as (target: this) => TWhenParameter)(this) : value;

            if (args.size() === 0) {
                return new HigherOrderWhenProxy(this) as WhenProxyCapture<this>;
            }

            if (args.size() === 1) {
                return new HigherOrderWhenProxy(this).condition(Util.truthy(value)) as WhenProxyConditioned<this>;
            }

            if (Util.truthy(value)) {
                return callback!(this, value as TWhenParameter) ?? this;
            } else if (Util.truthy(_default)) {
                return _default!(this, value as TWhenParameter) ?? this;
            }

            return this;
        }

        /** Apply the callback if the given "value" is (or resolves to) falsy. */
        public unless(): WhenProxyCapture<this>;
        public unless<TUnlessParameter extends defined>(
            value: ConditionValue<this, TUnlessParameter>,
        ): WhenProxyConditioned<this>;
        public unless<TUnlessParameter extends defined, TUnlessReturnType extends defined>(
            value: ConditionValue<this, TUnlessParameter>,
            callback: ConditionCallback<this, TUnlessParameter, TUnlessReturnType>,
            _default?: ConditionCallback<this, TUnlessParameter, TUnlessReturnType>,
        ): this | TUnlessReturnType;
        public unless<TUnlessParameter extends defined, TUnlessReturnType extends defined>(
            ...args: ConditionArguments<this, TUnlessParameter, TUnlessReturnType>
        ): ConditionResult<this, TUnlessReturnType>
        {
            let [value, callback, _default] = args;

            value = typeIs(value, 'function') ? (value as (target: this) => TUnlessParameter)(this) : value;

            if (args.size() === 0) {
                return new HigherOrderWhenProxy(this).negateConditionOnCapture() as WhenProxyCapture<this>;
            }

            if (args.size() === 1) {
                return new HigherOrderWhenProxy(this).condition(!Util.truthy(value)) as WhenProxyConditioned<this>;
            }

            if (!Util.truthy(value)) {
                return callback!(this, value as TUnlessParameter) ?? this;
            } else if (Util.truthy(_default)) {
                return _default!(this, value as TUnlessParameter) ?? this;
            }

            return this;
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
 * `func_num_args()` is the rest parameter's `size()`, which cannot see a
 * trailing explicit `undefined` -- `when(undefined)` reads as `when()`, where
 * PHP's `when(null)` counts one argument.
 */
export function Conditionable<TBase extends Constructor>(
    Base: TBase = Trait as never,
): TBase & Constructor<ConditionableShape>
{
    return conditionable(Base) as never;
}
