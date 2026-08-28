import { MemoryStoreLock } from 'Illuminate/Cache/MemoryStoreLock';
import { Serializer } from 'Illuminate/Support/Serializer';
import type { Lock } from 'Illuminate/Contracts/Cache/Lock';
import type { LockProvider } from 'Illuminate/Contracts/Cache/LockProvider';
import type { Store } from 'Illuminate/Contracts/Cache/Store';

const MemoryStoreService = game.GetService('MemoryStoreService');

/** The longest a MemoryStore item may live: 45 days. */
export const MAX_EXPIRATION = 3_888_000;

/**
 * PHP: `Illuminate\Cache\RedisStore`, over `MemoryStoreService`.
 *
 * A cache shared by every server of the universe, which is what makes locks
 * worth having: `ShouldBeUnique`, rate limiting and `WithoutOverlapping` all
 * need one server to be able to tell another that something is taken.
 *
 * Values are serialised the way the Redis store serialises them, and for the
 * same reason -- a class has to come back a class. Numbers are stored raw so
 * that `increment()` can work on them.
 *
 * Two limits are the platform's. Nothing lives forever: `forever()` stores for
 * 45 days, the longest MemoryStore allows. And there is no "delete everything"
 * call, so `flush()` answers `false` rather than pretending.
 */
export class MemoryStoreStore implements Store, LockProvider
{
    /** Create a new MemoryStore store. */
    public constructor(
        protected readonly mapName = 'cache',
        protected readonly prefix = '',
        protected readonly defaultExpiration = MAX_EXPIRATION,
    )
    {}

    /** The hash map holding the cache. */
    protected map(): MemoryStoreHashMap
    {
        return MemoryStoreService.GetHashMap(this.mapName);
    }

    /** Retrieve an item from the cache by key. */
    public get(key: string): unknown
    {
        return this.decode(this.map().GetAsync(this.prefix + key));
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

    /** Store an item in the cache for a given number of seconds. */
    public put(key: string, value: unknown, seconds: number): boolean
    {
        this.map().SetAsync(this.prefix + key, this.encode(value) as never, this.expiration(seconds));

        return true;
    }

    /** Store multiple items in the cache for a given number of seconds. */
    public putMany(values: Map<string, unknown>, seconds: number): boolean
    {
        for (const [key, value] of values) {
            this.put(key, value, seconds);
        }

        return true;
    }

    /**
     * Store an item in the cache if the key does not exist.
     *
     * `UpdateAsync` abandons the write when the transform answers nothing,
     * which is the compare-and-set every "only if absent" needs.
     */
    public add(key: string, value: unknown, seconds: number): boolean
    {
        const encoded = this.encode(value);

        const written = this.map().UpdateAsync(
            this.prefix + key,
            (held: unknown) => (held === undefined ? (encoded as never) : undefined),
            this.expiration(seconds),
        );

        return written !== undefined;
    }

    /** Increment the value of an item in the cache. */
    public increment(key: string, value = 1): number | false
    {
        const updated = this.map().UpdateAsync(
            this.prefix + key,
            (held: unknown) => ((tonumber(held) ?? 0) + value) as never,
            this.expiration(this.defaultExpiration),
        );

        return tonumber(updated) ?? false;
    }

    /** Decrement the value of an item in the cache. */
    public decrement(key: string, value = 1): number | false
    {
        return this.increment(key, value * -1);
    }

    /** Store an item in the cache indefinitely. */
    public forever(key: string, value: unknown): boolean
    {
        return this.put(key, value, MAX_EXPIRATION);
    }

    /** Set a new expiration time on an item that is already stored. */
    public touch(key: string, seconds: number): boolean
    {
        const held = this.map().GetAsync(this.prefix + key);

        if (held === undefined) {
            return false;
        }

        this.map().SetAsync(this.prefix + key, held as never, this.expiration(seconds));

        return true;
    }

    /** Remove an item from the cache. */
    public forget(key: string): boolean
    {
        this.map().RemoveAsync(this.prefix + key);

        return true;
    }

    /** Remove all items from the cache: MemoryStore has no such call. */
    public flush(): boolean
    {
        return false;
    }

    /** Get a lock instance. */
    public lock(name: string, seconds = 0, owner?: string): Lock
    {
        return new MemoryStoreLock(this, name, seconds, owner);
    }

    /** Restore a lock instance using the owner identifier. */
    public restoreLock(name: string, owner: string): Lock
    {
        return this.lock(name, 0, owner);
    }

    /** The hash map a lock writes into. */
    public lockMap(): MemoryStoreHashMap
    {
        return this.map();
    }

    /** The longest lifetime MemoryStore accepts, in seconds. */
    public maxExpiration(): number
    {
        return MAX_EXPIRATION;
    }

    /** The prefix a lock writes under. */
    public getPrefix(): string
    {
        return this.prefix;
    }

    /** Keep the expiration inside what MemoryStore accepts. */
    protected expiration(seconds: number): number
    {
        return math.clamp(math.floor(seconds), 1, MAX_EXPIRATION);
    }

    /** Numbers travel as they are; everything else is serialised. */
    protected encode(value: unknown): unknown
    {
        return typeIs(value, 'number') ? value : Serializer.serialize(value);
    }

    /** Read a value back out of storage. */
    protected decode(value: unknown): unknown
    {
        if (value === undefined || typeIs(value, 'number')) {
            return value;
        }

        const [ok, decoded] = pcall(() => Serializer.unserialize(value as string));

        return ok ? decoded : value;
    }
}
