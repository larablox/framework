import { ArrayLock } from "Illuminate/Cache/ArrayLock";
import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import type { Lock } from "Illuminate/Contracts/Cache/Lock";
import type { LockProvider } from "Illuminate/Contracts/Cache/LockProvider";
import type { Store } from "Illuminate/Contracts/Cache/Store";

/** One item as the store keeps it. */
interface ArrayItem {
    value: unknown;
    expiresAt: number;
}

/** A lock as the store keeps it. */
export interface ArrayLockRecord {
    owner: string;
    expiresAt?: number;
}

/**
 * PHP: `Illuminate\Cache\ArrayStore`.
 *
 * The cache that lives in this server's memory and dies with it.
 *
 * `$serializesValues` is not ported: it exists so that PHP can hand out copies
 * rather than shared object references, and `Support/Serializer` cannot round
 * trip everything a cache may hold. A value comes back as the very object that
 * was put in.
 */
export class ArrayStore implements Store, LockProvider {
    /** The array of stored values. */
    protected storage = new OrderedMap<string, ArrayItem>();

    /** The array of locks. */
    public locks = new OrderedMap<string, ArrayLockRecord>();

    /** Retrieve an item from the cache by key. */
    public get(key: string): unknown {
        const item = this.storage.get(key);

        if (item === undefined) {
            return undefined;
        }

        if (
            item.expiresAt !== 0 &&
            InteractsWithTime.currentTime() >= item.expiresAt
        ) {
            this.forget(key);

            return undefined;
        }

        return item.value;
    }

    /** Retrieve multiple items from the cache by key. */
    public many(keys: Array<string>): Map<string, unknown> {
        const values = new Map<string, unknown>();

        for (const key of keys) {
            values.set(key, this.get(key));
        }

        return values;
    }

    /** Store an item in the cache for a given number of seconds. */
    public put(key: string, value: unknown, seconds: number): boolean {
        this.storage.set(key, {
            value,
            expiresAt: this.calculateExpiration(seconds),
        });

        return true;
    }

    /** Store multiple items in the cache for a given number of seconds. */
    public putMany(values: Map<string, unknown>, seconds: number): boolean {
        for (const [key, value] of values) {
            this.put(key, value, seconds);
        }

        return true;
    }

    /** Store an item in the cache if the key does not exist. */
    public add(key: string, value: unknown, seconds: number): boolean {
        if (this.get(key) !== undefined) {
            return false;
        }

        return this.put(key, value, seconds);
    }

    /** Increment the value of an item in the cache. */
    public increment(key: string, value = 1): number | false {
        const existing = this.get(key);

        if (existing === undefined) {
            this.forever(key, value);

            return value;
        }

        const incremented = (tonumber(existing) ?? 0) + value;

        (this.storage.get(key) as ArrayItem).value = incremented;

        return incremented;
    }

    /** Decrement the value of an item in the cache. */
    public decrement(key: string, value = 1): number | false {
        return this.increment(key, value * -1);
    }

    /** Store an item in the cache indefinitely. */
    public forever(key: string, value: unknown): boolean {
        return this.put(key, value, 0);
    }

    /** Set a new expiration time on an item that is already stored. */
    public touch(key: string, seconds: number): boolean {
        const item = this.storage.get(key);

        if (item === undefined) {
            return false;
        }

        item.expiresAt = this.calculateExpiration(seconds);

        return true;
    }

    /** Remove an item from the cache. */
    public forget(key: string): boolean {
        return this.storage.delete(key);
    }

    /** Remove all items from the cache. */
    public flush(): boolean {
        this.storage.clear();

        return true;
    }

    /** Remove all of the locks from the cache. */
    public flushLocks(): boolean {
        this.locks.clear();

        return true;
    }

    /** Get a lock instance. */
    public lock(name: string, seconds = 0, owner?: string): Lock {
        return new ArrayLock(this, name, seconds, owner);
    }

    /** Restore a lock instance using the owner identifier. */
    public restoreLock(name: string, owner: string): Lock {
        return this.lock(name, 0, owner);
    }

    /** Get the expiration time of the key. */
    protected calculateExpiration(seconds: number): number {
        return seconds === 0
            ? 0
            : InteractsWithTime.currentTime() + math.floor(seconds);
    }

    /** Get the cache key prefix. */
    public getPrefix(): string {
        return "";
    }
}
