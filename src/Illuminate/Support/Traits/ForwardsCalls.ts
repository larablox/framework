import { BadMethodCallException } from "Illuminate/Exception";
import { Reflector } from "Illuminate/Support/Reflector";
import { Trait } from "Illuminate/Support/Traits/Trait";
import type {
    AssertNoExtraMembers,
    AssertTrue,
    Constructor,
} from "Illuminate/Support/Traits/Trait";

/**
 * The instance type `ForwardsCalls()` mixes in.
 *
 * Named rather than inferred so that declaration emit can write it down with
 * its `protected` members intact -- see the note on `ConditionablePublicShape`
 * in `Illuminate/Support/Traits/Conditionable`, which explains the whole
 * pattern.
 *
 * This trait is the one that is entirely `protected`, so unlike the others it
 * is not split into a public half: `keyof` already yields nothing here, which
 * is exactly what `ForwardsCallsExtra` below asserts. Both members are on the
 * honour system -- change one and change it here.
 */
export declare class ForwardsCallsShape {
    /** Type-only: there is no such value in the compiled Luau. */
    private constructor();

    /** Forward a method call to the given object. */
    protected forwardCallTo(
        target: object,
        method: string,
        parameters: Array<unknown>,
    ): unknown;

    /**
     * Forward a method call to the given object, returning $this if the
     * forwarded call returned itself.
     */
    protected forwardDecoratedCallTo(
        target: object,
        method: string,
        parameters: Array<unknown>,
    ): unknown;
}

/**
 * The trait itself.
 *
 * Split out of `ForwardsCalls()` below and left unannotated so that
 * `ForwardsCallsExtra` has something concrete to look at -- see the note on
 * `conditionable` in `Illuminate/Support/Traits/Conditionable`.
 */
function forwardsCalls<TBase extends Constructor>(Base: TBase) {
    return class extends Base {
        /** Forward a method call to the given object. */
        protected forwardCallTo(
            target: object,
            method: string,
            parameters: Array<unknown>,
        ): unknown {
            const callable = (target as Record<string, unknown>)[method];

            if (!typeIs(callable, "function")) {
                throw new BadMethodCallException(
                    `Call to undefined method ${Reflector.className(
                        Reflector.classOf(target) ?? target,
                    )}::${method}()`,
                );
            }

            return (callable as Callback)(target, ...parameters);
        }

        /**
         * Forward a method call to the given object, returning $this if the
         * forwarded call returned itself.
         */
        protected forwardDecoratedCallTo(
            target: object,
            method: string,
            parameters: Array<unknown>,
        ): unknown {
            const result = this.forwardCallTo(target, method, parameters);

            return result === target ? this : result;
        }
    };
}

/**
 * Every public member the trait has that the shape does not list.
 *
 * The shape has no public member at all, so this asserts that the trait has
 * not grown one behind its back.
 */
type ForwardsCallsExtra = Exclude<
    keyof InstanceType<ReturnType<typeof forwardsCalls<typeof Trait>>>,
    keyof ForwardsCallsShape
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the assertion is the point: it fails to compile when the trait has a public member the shape does not list.
type ForwardsCallsIsExact = AssertTrue<
    AssertNoExtraMembers<ForwardsCallsExtra>
>;

/**
 * PHP: `trait Illuminate\Support\Traits\ForwardsCalls`.
 *
 * PHP calls the method and turns the resulting `Error` back into a
 * `BadMethodCallException`, matching the engine's message to be sure the error
 * came from the forwarded call and not from inside it. Nothing is thrown here
 * for a missing method -- indexing a table just yields `nil` -- so the check
 * comes first and the message-matching dance disappears with it.
 *
 * A method reached through an index gets no receiver, so the target is passed
 * as the first argument; see the compiled-class notes in
 * `agent_docs/roblox-ts-constraints.md`.
 */
export function ForwardsCalls<TBase extends Constructor>(
    Base: TBase = Trait as never,
): TBase & Constructor<ForwardsCallsShape> {
    return forwardsCalls(Base) as never;
}

/** PHP: `static::throwBadMethodCallException($method)`. */
export function throwBadMethodCallException(
    target: unknown,
    method: string,
): never {
    throw new BadMethodCallException(
        `Call to undefined method ${Reflector.className(target)}::${method}()`,
    );
}
