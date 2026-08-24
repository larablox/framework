import { Attributes } from "Illuminate/Container/Attributes/Attributes";
import { Reflector } from "Illuminate/Support/Reflector";

/**
 * PHP: `interface ShouldQueue`, whose presence tells the bus to queue a job
 * instead of running it at once.
 *
 * Interfaces are erased, and this one declares no method to look for the way
 * `DeferrableProvider` does. It is a class decorator here, recorded in the same
 * table the container's class attributes live in, and read back by
 * `isShouldQueue()`.
 *
 * ```ts
 * @ShouldQueue()
 * export class SendWelcome {}
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ShouldQueue {}

export function ShouldQueue() {
    return (target: object): void => {
        Attributes.add(target, ShouldQueue, {});
    };
}

/** PHP: `$job instanceof ShouldQueue`. */
export function isShouldQueue(job: unknown): job is ShouldQueue {
    if (!typeIs(job, "table")) {
        return false;
    }

    // PHP asks the question of a class as readily as of an object -- the event
    // dispatcher checks a listener's class before ever building it.
    let current: object | undefined = Reflector.isInstance(job)
        ? Reflector.classOf(job as object)
        : (job as object);

    while (current !== undefined) {
        if (Attributes.has(current, ShouldQueue)) {
            return true;
        }

        current = Reflector.parentClass(current);
    }

    return false;
}
