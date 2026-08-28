import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { Limit } from "Illuminate/Cache/RateLimiting/Limit";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import type { Repository as Cache } from "Illuminate/Cache/Repository";

/** PHP: the closure registered with `RateLimiter::for()`. */
export type LimiterCallback = (...args: Array<never>) => Limit | Array<Limit> | undefined;

/**
 * PHP: `Illuminate\Cache\RateLimiter`.
 *
 * Counts attempts against a key in the cache, which means a limiter over the
 * `memorystore` cache counts across every server of the universe, and one over
 * `array` counts only here.
 *
 * `cleanRateLimiterKey()` strips HTML entities in PHP; there is no HTML and no
 * `htmlentities`, so a key is used as it is. `withoutSerializationOrCompression`
 * is a phpredis detail with nothing behind it here.
 */
export class RateLimiter {
    /** The configured limit object resolvers. */
    protected limiters = new OrderedMap<string, LimiterCallback>();

    /** Create a new rate limiter instance. */
    public constructor(protected readonly cache: Cache) {}

    /** Register a named limiter configuration. */
    public for(name: string, callback: LimiterCallback): this {
        this.limiters.set(name, callback);

        return this;
    }

    /** Get the given named rate limiter. */
    public limiter(name: string): LimiterCallback | undefined {
        return this.limiters.get(name);
    }

    /** Attempts to execute a callback if it's not limited. */
    public attempt<T>(key: string, maxAttempts: number, callback: () => T, decaySeconds = 60): T | boolean {
        if (this.tooManyAttempts(key, maxAttempts)) {
            return false;
        }

        const result = callback();

        this.hit(key, decaySeconds);

        return result === undefined ? true : result;
    }

    /** Determine if the given key has been "accessed" too many times. */
    public tooManyAttempts(key: string, maxAttempts: number): boolean {
        if (this.attempts(key) >= maxAttempts) {
            if (this.cache.has(`${key}:timer`)) {
                return true;
            }

            this.resetAttempts(key);
        }

        return false;
    }

    /** Increment the counter for a given key for a given decay time. */
    public hit(key: string, decaySeconds = 60): number {
        return this.increment(key, decaySeconds);
    }

    /** Increment the counter for a given key for a given decay time. */
    public increment(key: string, decaySeconds = 60, amount = 1): number {
        this.cache.add(`${key}:timer`, InteractsWithTime.availableAt(decaySeconds), decaySeconds);

        const added = this.cache.add(key, 0, decaySeconds);

        const hits = tonumber(this.cache.increment(key, amount)) ?? 0;

        if (!added && hits === amount) {
            this.cache.put(key, amount, decaySeconds);
        }

        return hits;
    }

    /** Decrement the counter for a given key for a given decay time. */
    public decrement(key: string, decaySeconds = 60, amount = 1): number {
        return this.increment(key, decaySeconds, amount * -1);
    }

    /** Get the number of attempts for the given key. */
    public attempts(key: string): number {
        return tonumber(this.cache.get(key, 0)) ?? 0;
    }

    /** Reset the number of attempts for the given key. */
    public resetAttempts(key: string): boolean {
        return this.cache.forget(key);
    }

    /** Get the number of retries left for the given key. */
    public remaining(key: string, maxAttempts: number): number {
        return math.max(0, maxAttempts - this.attempts(key));
    }

    /** Get the number of retries left for the given key. */
    public retriesLeft(key: string, maxAttempts: number): number {
        return this.remaining(key, maxAttempts);
    }

    /** Clear the hits and lockout timer for the given key. */
    public clear(key: string): void {
        this.resetAttempts(key);

        this.cache.forget(`${key}:timer`);
    }

    /** Get the number of seconds until the "key" is accessible again. */
    public availableIn(key: string): number {
        const timer = tonumber(this.cache.get(`${key}:timer`)) ?? 0;

        return math.max(0, timer - InteractsWithTime.currentTime());
    }

    /** Clean the rate limiter key from unicode characters. */
    public cleanRateLimiterKey(key: string): string {
        return key;
    }
}
