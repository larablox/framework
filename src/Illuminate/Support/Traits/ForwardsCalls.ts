import { BadMethodCallException } from "Illuminate/Exception";
import { Reflector } from "Illuminate/Support/Reflector";
import { Trait } from "Illuminate/Support/Traits/Trait";
import type { Constructor } from "Illuminate/Support/Traits/Trait";

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
) {
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

/** PHP: `static::throwBadMethodCallException($method)`. */
export function throwBadMethodCallException(
    target: unknown,
    method: string,
): never {
    throw new BadMethodCallException(
        `Call to undefined method ${Reflector.className(target)}::${method}()`,
    );
}
