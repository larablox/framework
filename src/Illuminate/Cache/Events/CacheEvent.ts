/** PHP: `IlluminateCacheEventsCacheEvent`. */
export abstract class CacheEvent
{
    /** Create a new event instance. */
    public constructor(
        public readonly storeName: string | undefined,
        public readonly key: string,
    )
    {}
}
