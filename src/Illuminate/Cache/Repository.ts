import { CacheHit } from 'Illuminate/Cache/Events/CacheHit';
import { CacheMissed } from 'Illuminate/Cache/Events/CacheMissed';
import { ForgettingKey } from 'Illuminate/Cache/Events/ForgettingKey';
import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import { KeyForgetFailed } from 'Illuminate/Cache/Events/KeyForgetFailed';
import { KeyForgotten } from 'Illuminate/Cache/Events/KeyForgotten';
import { KeyWriteFailed } from 'Illuminate/Cache/Events/KeyWriteFailed';
import { KeyWritten } from 'Illuminate/Cache/Events/KeyWritten';
import { RetrievingKey } from 'Illuminate/Cache/Events/RetrievingKey';
import { WritingKey } from 'Illuminate/Cache/Events/WritingKey';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Lock } from 'Illuminate/Contracts/Cache/Lock';
import type { LockProvider } from 'Illuminate/Contracts/Cache/LockProvider';
import type { Repository as RepositoryContract, Ttl } from 'Illuminate/Contracts/Cache/Repository';
import type { Store } from 'Illuminate/Contracts/Cache/Store';

/**
 * PHP: `Illuminate\Cache\Repository`.
 *
 * The store with the conveniences on top: events, `remember()`, default TTL,
 * typed getters.
 *
 * Not ported: tags (`tags()`, `TaggedCache`) -- no store here supports them
 * yet; `flexible()` and `funnel()`, which lean on locks and deferred callbacks;
 * `float()`, because Luau has one numeric type and `integer()` covers it; the
 * PSR-16 surface beyond `set`/`delete`/`clear`; and `ArrayAccess`, which needs
 * `__get`/`__set`.
 */
export class Repository implements RepositoryContract
{
    /** The default number of seconds to store items. */
    protected defaultCacheTime = 3600;

    /** The event dispatcher implementation. */
    protected events?: Dispatcher;

    /** Create a new cache repository instance. */
    public constructor(
        protected store: Store,
        protected readonly config: ArrayAccessible = {},
    )
    {}

    /** Determine if an item exists in the cache. */
    public has(key: string): boolean
    {
        return this.get(key) !== undefined;
    }

    /** Determine if an item doesn't exist in the cache. */
    public missing(key: string): boolean
    {
        return !this.has(key);
    }

    /** Retrieve an item from the cache by key. */
    public get(key: string, dflt?: unknown): unknown
    {
        this.event(new RetrievingKey(this.getName(), key));

        const value = this.store.get(this.itemKey(key));

        if (value === undefined) {
            this.event(new CacheMissed(this.getName(), key));

            return typeIs(dflt, 'function') ? (dflt as Callback)() : dflt;
        }

        this.event(new CacheHit(this.getName(), key, value));

        return value;
    }

    /** Retrieve multiple items from the cache by key. */
    public many(keys: Array<string>): Map<string, unknown>
    {
        const values = new Map<string, unknown>();

        for (const key of keys) {
            values.set(key, this.get(key));
        }

        return values;
    }

    /** Retrieve an item from the cache and delete it. */
    public pull(key: string, dflt?: unknown): unknown
    {
        const value = this.get(key, dflt);

        this.forget(key);

        return value;
    }

    /** Store an item in the cache. */
    public put(key: string, value: unknown, ttl?: Ttl): boolean
    {
        if (ttl === undefined) {
            return this.forever(key, value);
        }

        const seconds = this.getSeconds(ttl);

        if (seconds <= 0) {
            return this.forget(key);
        }

        this.event(new WritingKey(this.getName(), key, value, seconds));

        const result = this.store.put(this.itemKey(key), value, seconds);

        this.event(
            result
                ? new KeyWritten(this.getName(), key, value, seconds)
                : new KeyWriteFailed(this.getName(), key, value, seconds),
        );

        return result;
    }

    /** PSR-16: store an item in the cache. */
    public set(key: string, value: unknown, ttl?: Ttl): boolean
    {
        return this.put(key, value, ttl);
    }

    /** Store multiple items in the cache for a given number of seconds. */
    public putMany(values: Map<string, unknown>, ttl?: Ttl): boolean
    {
        let result = true;

        for (const [key, value] of values) {
            if (!this.put(key, value, ttl)) {
                result = false;
            }
        }

        return result;
    }

    /** Store an item in the cache if the key does not exist. */
    public add(key: string, value: unknown, ttl?: Ttl): boolean
    {
        let seconds: number | undefined;

        if (ttl !== undefined) {
            seconds = this.getSeconds(ttl);

            if (seconds <= 0) {
                return false;
            }

            const adder = (this.store as { add?: unknown; }).add;

            if (typeIs(adder, 'function')) {
                return (adder as (self: Store, key: string, value: unknown, seconds: number) => boolean)(
                    this.store,
                    this.itemKey(key),
                    value,
                    seconds,
                );
            }
        }

        if (this.get(key) === undefined) {
            return this.put(key, value, seconds);
        }

        return false;
    }

    /** Increment the value of an item in the cache. */
    public increment(key: string, value = 1): number | false
    {
        return this.store.increment(this.itemKey(key), value);
    }

    /** Decrement the value of an item in the cache. */
    public decrement(key: string, value = 1): number | false
    {
        return this.store.decrement(this.itemKey(key), value);
    }

    /** Store an item in the cache indefinitely. */
    public forever(key: string, value: unknown): boolean
    {
        this.event(new WritingKey(this.getName(), key, value));

        const result = this.store.forever(this.itemKey(key), value);

        this.event(
            result ? new KeyWritten(this.getName(), key, value) : new KeyWriteFailed(this.getName(), key, value),
        );

        return result;
    }

    /** Get an item from the cache, or execute the given callback and store the result. */
    public remember<T>(key: string, ttl: Ttl, callback: () => T): T
    {
        const value = this.get(key);

        if (value !== undefined) {
            return value as T;
        }

        const fresh = callback();

        this.put(key, fresh, ttl);

        return fresh;
    }

    /** Get an item from the cache, or execute the given callback and store the result forever. */
    public sear<T>(key: string, callback: () => T): T
    {
        return this.rememberForever(key, callback);
    }

    /** Get an item from the cache, or execute the given callback and store the result forever. */
    public rememberForever<T>(key: string, callback: () => T): T
    {
        const value = this.get(key);

        if (value !== undefined) {
            return value as T;
        }

        const fresh = callback();

        this.forever(key, fresh);

        return fresh;
    }

    /** Set a new expiration time on an item that is already stored. */
    public touch(key: string, ttl: Ttl): boolean
    {
        return this.store.touch(this.itemKey(key), this.getSeconds(ttl));
    }

    /** Remove an item from the cache. */
    public forget(key: string): boolean
    {
        this.event(new ForgettingKey(this.getName(), key));

        const result = this.store.forget(this.itemKey(key));

        this.event(result ? new KeyForgotten(this.getName(), key) : new KeyForgetFailed(this.getName(), key));

        return result;
    }

    /** PSR-16: remove an item from the cache. */
    public delete(key: string): boolean
    {
        return this.forget(key);
    }

    /** PSR-16: remove all items from the cache. */
    public clear(): boolean
    {
        return this.store.flush();
    }

    /** Get a lock instance. */
    public lock(name: string, seconds = 0, owner?: string): Lock
    {
        return (this.store as unknown as LockProvider).lock(name, seconds, owner);
    }

    /** Restore a lock instance using the owner identifier. */
    public restoreLock(name: string, owner: string): Lock
    {
        return (this.store as unknown as LockProvider).restoreLock(name, owner);
    }

    /** Retrieve an item from the cache as a string. */
    public string(key: string, dflt?: string): string
    {
        const value = this.get(key, dflt);

        return value === undefined ? '' : tostring(value);
    }

    /** Retrieve an item from the cache as a number. */
    public integer(key: string, dflt?: number): number
    {
        const value = this.get(key, dflt);

        return typeIs(value, 'number') ? value : (tonumber(value) ?? 0);
    }

    /** Retrieve an item from the cache as a boolean. */
    public boolean(key: string, dflt?: boolean): boolean
    {
        const value = this.get(key, dflt);

        return value === true || value === 'true' || value === 1;
    }

    /** Retrieve an item from the cache as an array. */
    public array(key: string, dflt?: Array<defined>): Array<defined>
    {
        const value = this.get(key, dflt);

        return typeIs(value, 'table') ? (value as Array<defined>) : [];
    }

    /** Calculate the number of seconds for the given TTL. */
    protected getSeconds(ttl: Ttl): number
    {
        if (ttl === undefined) {
            return 0;
        }

        const seconds = InteractsWithTime.secondsUntil(ttl);

        return seconds > 0 ? seconds : 0;
    }

    /** Format the key for a cache item. */
    protected itemKey(key: string): string
    {
        return key;
    }

    /** Get the name of the cache store. */
    public getName(): string | undefined
    {
        return this.config.store as string | undefined;
    }

    /** Get the default cache time. */
    public getDefaultCacheTime(): number
    {
        return this.defaultCacheTime;
    }

    /** Set the default cache time in seconds. */
    public setDefaultCacheTime(seconds: number): this
    {
        this.defaultCacheTime = seconds;

        return this;
    }

    /** Get the cache store implementation. */
    public getStore(): Store
    {
        return this.store;
    }

    /** Set the cache store implementation. */
    public setStore(store: Store): this
    {
        this.store = store;

        return this;
    }

    /** Fire an event for this cache instance. */
    protected event(event: object): void
    {
        if (this.events !== undefined) {
            this.events.dispatch(event);
        }
    }

    /** Get the event dispatcher instance. */
    public getEventDispatcher(): Dispatcher | undefined
    {
        return this.events;
    }

    /** Set the event dispatcher instance. */
    public setEventDispatcher(events: Dispatcher): void
    {
        this.events = events;
    }
}
