import { CacheEvent } from 'Illuminate/Cache/Events/CacheEvent';

/** PHP: `IlluminateCacheEvents${name}`. */
export class KeyWritten extends CacheEvent
{
    /** Create a new event instance. */
    public constructor(
        storeName: string | undefined,
        key: string,
        public readonly value: unknown,
        public readonly seconds?: number,
    )
    {
        super(storeName, key);
    }
}
