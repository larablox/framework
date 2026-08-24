import { ReadsClassAttributes } from "Illuminate/Support/Traits/ReadsClassAttributes";
import { Reflector } from "Illuminate/Support/Reflector";
import { UniqueFor } from "Illuminate/Queue/Attributes/UniqueFor";
import type { Repository as Cache } from "Illuminate/Cache/Repository";

/**
 * PHP: `Illuminate\Bus\UniqueLock`.
 *
 * Holds a cache lock for as long as a job marked `ShouldBeUnique` should keep
 * its twins off the queue.
 *
 * PHP hashes the display name into the key with `xxh128`; there is no hash
 * function here, so the name goes in as it is. The key is longer and just as
 * unique, and `uniqueVia()` -- picking another cache store for the lock -- is
 * not ported.
 *
 * The constructor asks for the concrete repository rather than the contract:
 * `lock()` is not on the contract in PHP either, and reaching it through a cast
 * would compile to a dot call and lose the receiver.
 */
export class UniqueLock {
    /** Create a new unique lock manager instance. */
    public constructor(protected readonly cache: Cache) {}

    /** Attempt to acquire a lock for the given job. */
    public acquire(job: object): boolean {
        const declared = (job as { uniqueFor?: unknown }).uniqueFor;

        const uniqueFor = typeIs(declared, "function")
            ? ((declared as (self: object) => number)(job) ?? 0)
            : ((ReadsClassAttributes.getAttributeValue(
                  job,
                  UniqueFor,
                  "uniqueFor",
              ) as number | undefined) ?? 0);

        return (
            this.cache.lock(UniqueLock.getKey(job), uniqueFor).get() === true
        );
    }

    /** Release the lock for the given job. */
    public release(job: object): void {
        this.cache.lock(UniqueLock.getKey(job)).forceRelease();
    }

    /** Generate the lock key for the given job. */
    public static getKey(job: object): string {
        const declared = (job as { uniqueId?: unknown }).uniqueId;

        const uniqueId = typeIs(declared, "function")
            ? tostring((declared as (self: object) => unknown)(job))
            : declared !== undefined
              ? tostring(declared)
              : "";

        const name = Reflector.className(Reflector.classOf(job));

        return `laravel_unique_job:${name}:${uniqueId}`;
    }
}
