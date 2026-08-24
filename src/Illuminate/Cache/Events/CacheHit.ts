import { CacheEvent } from "Illuminate/Cache/Events/CacheEvent";

/** PHP: `IlluminateCacheEventsCacheHit`. */
export class CacheHit extends CacheEvent {
    /** Create a new event instance. */
    public constructor(
        storeName: string | undefined,
        key: string,
        public readonly value: unknown,
    ) {
        super(storeName, key);
    }
}
