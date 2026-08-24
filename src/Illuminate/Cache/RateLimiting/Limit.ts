/**
 * PHP: `Illuminate\Cache\RateLimiting\Limit`.
 *
 * `response()` is not ported -- it builds the HTTP response a throttled request
 * gets back, and there are no requests here.
 */
export class Limit {
    /** The callback that runs when the limit is exceeded. */
    public afterCallback?: Callback;

    /** Create a new limit instance. */
    public constructor(
        public key: string = "",
        public maxAttempts = 60,
        public decaySeconds = 60,
    ) {}

    /** Create a new rate limit. */
    public static perSecond(maxAttempts: number, decaySeconds = 1): Limit {
        return new Limit("", maxAttempts, decaySeconds);
    }

    /** Create a new rate limit. */
    public static perMinute(maxAttempts: number, decayMinutes = 1): Limit {
        return new Limit("", maxAttempts, 60 * decayMinutes);
    }

    /** Create a new rate limit using minutes as the decay time. */
    public static perMinutes(decayMinutes: number, maxAttempts: number): Limit {
        return new Limit("", maxAttempts, 60 * decayMinutes);
    }

    /** Create a new rate limit using hours as the decay time. */
    public static perHour(maxAttempts: number, decayHours = 1): Limit {
        return new Limit("", maxAttempts, 60 * 60 * decayHours);
    }

    /** Create a new rate limit using days as the decay time. */
    public static perDay(maxAttempts: number, decayDays = 1): Limit {
        return new Limit("", maxAttempts, 60 * 60 * 24 * decayDays);
    }

    /** Set the key of the rate limit. */
    public by(key: string): this {
        this.key = key;

        return this;
    }

    /** Set the callback that should run when the limit is exceeded. */
    public after(callback: Callback): this {
        this.afterCallback = callback;

        return this;
    }

    /** Get the fallback key, used when two limits collide. */
    public fallbackKey(): string {
        const prefix = this.key !== "" ? `${this.key}:` : "";

        return `${prefix}attempts:${this.maxAttempts}:decay:${this.decaySeconds}`;
    }
}
