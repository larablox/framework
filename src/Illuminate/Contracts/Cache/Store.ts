/** PHP: `Illuminate\Contracts\Cache\Store`. */
export interface Store {
    /** Retrieve an item from the cache by key. */
    get(key: string): unknown;

    /** Retrieve multiple items from the cache by key. */
    many(keys: Array<string>): Map<string, unknown>;

    /** Store an item in the cache for a given number of seconds. */
    put(key: string, value: unknown, seconds: number): boolean;

    /** Store multiple items in the cache for a given number of seconds. */
    putMany(values: Map<string, unknown>, seconds: number): boolean;

    /** Increment the value of an item in the cache. */
    increment(key: string, value?: number): number | false;

    /** Decrement the value of an item in the cache. */
    decrement(key: string, value?: number): number | false;

    /** Store an item in the cache indefinitely. */
    forever(key: string, value: unknown): boolean;

    /** Set a new expiration time on an item that is already stored. */
    touch(key: string, seconds: number): boolean;

    /** Remove an item from the cache. */
    forget(key: string): boolean;

    /** Remove all items from the cache. */
    flush(): boolean;

    /** Get the cache key prefix. */
    getPrefix(): string;
}
