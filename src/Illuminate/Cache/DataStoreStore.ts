import { DataStoreLock } from 'Illuminate/Cache/DataStoreLock';
import { Concurrency } from 'Illuminate/Support/Concurrency';
import { DataStoreRequest } from 'Illuminate/Support/DataStoreRequest';
import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Serializer } from 'Illuminate/Support/Serializer';
import type { Lock } from 'Illuminate/Contracts/Cache/Lock';
import type { LockProvider } from 'Illuminate/Contracts/Cache/LockProvider';
import type { Store } from 'Illuminate/Contracts/Cache/Store';

const DataStoreService = game.GetService('DataStoreService');

/** The longest key DataStore accepts. */
export const MAX_KEY_LENGTH = 50;

/** One item as the store writes it. */
export interface DataStoreItem {
    /** The serialized value, or the number itself. */
    v: unknown;

    /** When the item expires; zero means never. */
    e: number;
}

/**
 * What `UpdateAsync` hands the key, and what it writes back.
 *
 * `@rbxts/types` says the transform returns a `LuaTuple`, because the platform
 * lets it answer with user ids and metadata as well. Only the value is used
 * here, so the transform is written plainly and cast at the call: returning
 * nothing aborts the write, which is the compare-and-set the drivers need.
 */
type Transform = (held?: DataStoreItem) => DataStoreItem | undefined;

/**
 * PHP: `Illuminate\Cache\DatabaseStore`, over `DataStoreService`.
 *
 * The only storage here that outlives the server. Like the database store, it
 * has no expiry of its own -- the expiration is written beside the value and
 * checked on the way out, which is what PHP's `expiration` column does.
 *
 * The platform's limits decide what this store is *for*:
 *
 * - a key may not exceed 50 characters, so a long key is refused rather than
 *   truncated into a collision;
 * - a value may not exceed 4 MB;
 * - reads and writes share a budget of `60 + players * 40` per minute, and
 *   `ListKeysAsync` -- which `flush()` needs -- gets `5 + players * 2`;
 * - writes to one key are throttled to roughly one per six seconds.
 *
 * That last one is why this is a cache for things read often and written
 * rarely -- player profiles, configuration -- and why locks and counters belong
 * on `MemoryStoreStore` instead.
 */
export class DataStoreStore implements Store, LockProvider {
    /** Create a new DataStore store. */
    public constructor(
        protected readonly storeName = 'cache',
        protected readonly prefix = '',
        protected readonly scope?: string,
    ) {}

    /** The data store holding the cache. */
    public store(): DataStore {
        return this.scope === undefined
            ? DataStoreService.GetDataStore(this.storeName)
            : DataStoreService.GetDataStore(this.storeName, this.scope);
    }

    /** Build, and check, the key an item is written under. */
    public itemKey(key: string): string {
        const full = this.prefix + key;

        if (full.size() > MAX_KEY_LENGTH) {
            throw new InvalidArgumentException(
                `The cache key [${full}] is ${full.size()} characters; DataStore accepts at most ${MAX_KEY_LENGTH}.`,
            );
        }

        return full;
    }

    /** Retrieve an item from the cache by key. */
    public get(key: string): unknown {
        const held = DataStoreRequest.run(() => {
            const [value] = this.store().GetAsync<DataStoreItem>(this.itemKey(key));

            return value;
        });

        if (held === undefined) {
            return undefined;
        }

        if (held.e !== 0 && InteractsWithTime.currentTime() >= held.e) {
            this.forget(key);

            return undefined;
        }

        return this.decode(held.v);
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
        DataStoreRequest.run(() =>
            this.store().SetAsync(this.itemKey(key), {
                v: this.encode(value),
                e: this.expiresAt(seconds),
            }),
        );

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
        const encoded = this.encode(value);

        const expiresAt = this.expiresAt(seconds);

        const transform: Transform = (held) => {
            const alive = held !== undefined && (held.e === 0 || InteractsWithTime.currentTime() < held.e);

            return alive ? undefined : { v: encoded, e: expiresAt };
        };

        const written = DataStoreRequest.run(() => {
            const [value] = this.store().UpdateAsync<DataStoreItem, DataStoreItem>(
                this.itemKey(key),
                transform as never,
            );

            return value;
        });

        return written !== undefined;
    }

    /** Increment the value of an item in the cache. */
    public increment(key: string, value = 1): number | false {
        const transform: Transform = (held) => ({
            v: (tonumber(held?.v) ?? 0) + value,
            e: held?.e ?? 0,
        });

        const updated = DataStoreRequest.run(() => {
            const [value] = this.store().UpdateAsync<DataStoreItem, DataStoreItem>(
                this.itemKey(key),
                transform as never,
            );

            return value;
        });

        return tonumber(updated?.v) ?? false;
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
        const expiresAt = this.expiresAt(seconds);

        const transform: Transform = (held) => (held === undefined ? undefined : { v: held.v, e: expiresAt });

        const updated = DataStoreRequest.run(() => {
            const [value] = this.store().UpdateAsync<DataStoreItem, DataStoreItem>(
                this.itemKey(key),
                transform as never,
            );

            return value;
        });

        return updated !== undefined;
    }

    /** Remove an item from the cache. */
    public forget(key: string): boolean {
        DataStoreRequest.run(() => this.store().RemoveAsync(this.itemKey(key)));

        return true;
    }

    /**
     * Remove all items from the cache.
     *
     * Every key is listed and removed one by one, which spends the listing
     * budget as well as the write budget. PHP truncates a table instead.
     */
    public flush(): boolean {
        const store = this.store();

        // A removed key stays in the listing unless it is excluded, so
        // flushing twice would spend a read on every tombstone.
        const pages = DataStoreRequest.run(() => store.ListKeysAsync(this.prefix, undefined, undefined, true));

        while (true) {
            const page = pages.GetCurrentPage() as Array<DataStoreKey>;

            // A removal costs about as long to wait for as a read, so a page
            // of them is overlapped rather than queued.
            Concurrency.run(
                page.map((entry) => () => {
                    DataStoreRequest.run(() => store.RemoveAsync(entry.KeyName));

                    return true;
                }),
            );

            if (pages.IsFinished) {
                break;
            }

            DataStoreRequest.run(() => pages.AdvanceToNextPageAsync());
        }

        return true;
    }

    /** Get a lock instance. */
    public lock(name: string, seconds = 0, owner?: string): Lock {
        return new DataStoreLock(this, name, seconds, owner);
    }

    /** Restore a lock instance using the owner identifier. */
    public restoreLock(name: string, owner: string): Lock {
        return this.lock(name, 0, owner);
    }

    /** Get the cache key prefix. */
    public getPrefix(): string {
        return this.prefix;
    }

    /** When an item written now should expire. */
    protected expiresAt(seconds: number): number {
        return seconds === 0 ? 0 : InteractsWithTime.currentTime() + math.floor(seconds);
    }

    /** Numbers travel as they are; everything else is serialised. */
    protected encode(value: unknown): unknown {
        return typeIs(value, 'number') ? value : Serializer.serialize(value);
    }

    /** Read a value back out of storage. */
    protected decode(value: unknown): unknown {
        if (value === undefined || typeIs(value, 'number')) {
            return value;
        }

        const [ok, decoded] = pcall(() => Serializer.unserialize(value as string));

        return ok ? decoded : value;
    }
}
