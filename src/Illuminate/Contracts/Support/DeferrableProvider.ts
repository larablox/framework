import { Attributes } from "Illuminate/Container/Attributes/Attributes";
import { LogicException } from "Illuminate/Exception";
import { Reflector } from "Illuminate/Support/Reflector";
import type { Abstract } from "Illuminate/Container/Types";

/**
 * PHP: `interface DeferrableProvider`, whose presence marks a provider as
 * deferred.
 *
 * Interfaces are erased, so the mark is a class decorator recorded the way
 * `ShouldQueue` is, and read back by `ServiceProvider::isDeferred()`. What
 * PHP enforces by having the interface declare `provides()` the decorator
 * enforces at load time: it refuses a class whose chain does not declare its
 * own `provides()`.
 *
 * ```ts
 * @DeferrableProvider()
 * export class PipelineServiceProvider extends ServiceProvider { ... }
 * ```
 */
export interface DeferrableProvider {
    /** Get the services provided by the provider. */
    provides(): Array<Abstract>;
}

export function DeferrableProvider() {
    return (target: object): void => {
        // Every class of the chain except the root: for a provider the root
        // is the base ServiceProvider, whose empty `provides()` must not
        // satisfy the check.
        let declaresProvides = false;
        let current: object | undefined = target;

        while (current !== undefined && Reflector.parentClass(current) !== undefined) {
            if (rawget(current, "provides") !== undefined) {
                declaresProvides = true;
                break;
            }

            current = Reflector.parentClass(current);
        }

        if (!declaresProvides) {
            throw new LogicException(`Deferrable provider [${tostring(target)}] must declare its own provides().`);
        }

        Attributes.add(target, DeferrableProvider, {});
    };
}
