import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { Store } from "Illuminate/Contracts/Cache/Store";

/** PHP: `\DateTimeInterface|\DateInterval|int|null $ttl`. */
export type Ttl = Delay | undefined;

/**
 * PHP: `Illuminate\Contracts\Cache\Repository`.
 *
 * PHP's contract extends PSR-16's `CacheInterface`; there is no PSR here, so
 * the methods it contributed (`set`, `delete`, `getMultiple`, ...) are on the
 * class rather than in this contract.
 */
export interface Repository {
    /** Determine if an item exists in the cache. */
    has(key: string): boolean;

    /** Determine if an item doesn't exist in the cache. */
    missing(key: string): boolean;

    /** Retrieve an item from the cache by key. */
    get(key: string, dflt?: unknown): unknown;

    /** Retrieve an item from the cache and delete it. */
    pull(key: string, dflt?: unknown): unknown;

    /** Store an item in the cache. */
    put(key: string, value: unknown, ttl?: Ttl): boolean;

    /** Store an item in the cache if the key does not exist. */
    add(key: string, value: unknown, ttl?: Ttl): boolean;

    /** Increment the value of an item in the cache. */
    increment(key: string, value?: number): number | false;

    /** Decrement the value of an item in the cache. */
    decrement(key: string, value?: number): number | false;

    /** Store an item in the cache indefinitely. */
    forever(key: string, value: unknown): boolean;

    /** Get an item from the cache, or execute the given callback and store the result. */
    remember<T>(key: string, ttl: Ttl, callback: () => T): T;

    /** Get an item from the cache, or execute the given callback and store the result forever. */
    sear<T>(key: string, callback: () => T): T;

    /** Get an item from the cache, or execute the given callback and store the result forever. */
    rememberForever<T>(key: string, callback: () => T): T;

    /** Set a new expiration time on an item that is already stored. */
    touch(key: string, ttl: Ttl): boolean;

    /** Remove an item from the cache. */
    forget(key: string): boolean;

    /** Get the cache store implementation. */
    getStore(): Store;
}
