import { Attributes } from "Illuminate/Container/Attributes/Attributes";
import { Reflector } from "Illuminate/Support/Reflector";

/**
 * PHP: `interface ShouldBeUnique`, which keeps a second copy of a job off the
 * queue while the first is still there.
 *
 * A marker with no methods, so there is nothing to look for at runtime: it is a
 * class decorator, like `ShouldQueue`.
 *
 * ```ts
 * @ShouldQueue()
 * @ShouldBeUnique()
 * export class SyncPlayer extends Dispatchable {
 *     public uniqueId(): string { return tostring(this.userId); }
 *     public uniqueFor(): number { return 60; }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ShouldBeUnique {}

export function ShouldBeUnique() {
    return (target: object): void => {
        Attributes.add(target, ShouldBeUnique, {});
    };
}

/** PHP: `$job instanceof ShouldBeUnique`. */
export function isShouldBeUnique(job: unknown): job is ShouldBeUnique {
    if (!typeIs(job, "table")) {
        return false;
    }

    let current: object | undefined = Reflector.isInstance(job) ? Reflector.classOf(job as object) : (job as object);

    while (current !== undefined) {
        if (Attributes.has(current, ShouldBeUnique)) {
            return true;
        }

        current = Reflector.parentClass(current);
    }

    return false;
}
