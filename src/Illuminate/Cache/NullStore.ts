import { NoLock } from 'Illuminate/Cache/NoLock';
import type { Lock } from 'Illuminate/Contracts/Cache/Lock';
import type { LockProvider } from 'Illuminate/Contracts/Cache/LockProvider';
import type { Store } from 'Illuminate/Contracts/Cache/Store';

/** PHP: `Illuminate\Cache\NullStore`. */
/* eslint-disable @typescript-eslint/no-unused-vars -- storing nothing is the
   whole point of this store. */
export class NullStore implements Store, LockProvider
{
    /** Retrieve an item from the cache by key. */
    public get(key: string): unknown
    {
        return undefined;
    }

    /** Retrieve multiple items from the cache by key. */
    public many(keys: Array<string>): Map<string, unknown>
    {
        const values = new Map<string, unknown>();

        for (const key of keys) {
            values.set(key, undefined);
        }

        return values;
    }

    /** Store an item in the cache for a given number of seconds. */
    public put(key: string, value: unknown, seconds: number): boolean
    {
        return false;
    }

    /** Store multiple items in the cache for a given number of seconds. */
    public putMany(values: Map<string, unknown>, seconds: number): boolean
    {
        return false;
    }

    /** Increment the value of an item in the cache. */
    public increment(key: string, value = 1): number | false
    {
        return false;
    }

    /** Decrement the value of an item in the cache. */
    public decrement(key: string, value = 1): number | false
    {
        return false;
    }

    /** Store an item in the cache indefinitely. */
    public forever(key: string, value: unknown): boolean
    {
        return false;
    }

    /** Set a new expiration time on an item that is already stored. */
    public touch(key: string, seconds: number): boolean
    {
        return false;
    }

    /** Remove an item from the cache. */
    public forget(key: string): boolean
    {
        return true;
    }

    /** Remove all items from the cache. */
    public flush(): boolean
    {
        return true;
    }

    /** Get a lock instance. */
    public lock(name: string, seconds = 0, owner?: string): Lock
    {
        return new NoLock(name, seconds, owner);
    }

    /** Restore a lock instance using the owner identifier. */
    public restoreLock(name: string, owner: string): Lock
    {
        return this.lock(name, 0, owner);
    }

    /** Get the cache key prefix. */
    public getPrefix(): string
    {
        return '';
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
