import { Container } from 'Illuminate/Container/Container';
import { RateLimiter } from 'Illuminate/Cache/RateLimiter';
import { Reflector } from 'Illuminate/Support/Reflector';
import type { InteractsWithQueue } from 'Illuminate/Queue/InteractsWithQueue';
import type { Next } from 'Illuminate/Pipeline/Pipeline';

/** A test run against the exception a job threw. */
export type ExceptionTest = (e: unknown) => boolean;

/**
 * PHP: `Illuminate\Queue\Middleware\ThrottlesExceptions`.
 *
 * A circuit breaker: once a job has thrown often enough, the middleware stops
 * running it for a while and just releases it.
 *
 * `report()` needs the exceptions component, so `reportWhen()` is not ported.
 * `ThrottlesExceptionsWithRedis` is the Lua-script variant of the same thing.
 *
 * PHP has a `$byJob` property beside a `byJob()` method; a Luau table holds one
 * value per key, so the property is `byJobUuid`.
 *
 * The middleware is handed the *command* -- the job object the application
 * wrote -- not the queue job carrying it, which is why it reaches the queue
 * through `InteractsWithQueue`, exactly as PHP does.
 */
export class ThrottlesExceptions {
    /** The developer specified key. */
    protected key = '';

    /** Indicates whether the throttle key should use the job's uuid. */
    protected byJobUuid = false;

    /**
     * The number of **minutes** to wait before retrying after an exception.
     *
     * Minutes, not seconds: `backoff()` on this middleware takes minutes in
     * Laravel while `backoff()` on a job takes seconds. The inconsistency is
     * upstream and kept on purpose.
     */
    protected retryAfterMinutes: number | ((e: unknown) => number) = 0;

    /** The callback that decides whether the exception counts. */
    protected whenCallback?: ExceptionTest;

    /** The callbacks that decide whether the job should be deleted. */
    protected deleteWhenCallbacks = new Array<ExceptionTest>();

    /** The callbacks that decide whether the job should fail outright. */
    protected failWhenCallbacks = new Array<ExceptionTest>();

    /** The prefix of the rate limiter key. */
    protected prefix = 'laravel_throttles_exceptions:';

    /** Create a new middleware instance. */
    public constructor(
        protected readonly maxAttempts = 10,
        protected readonly decaySeconds = 600,
    ) {}

    /** Process the job. */
    public handle(job: InteractsWithQueue, _next: Next): unknown {
        const limiter = Container.getInstance().make<RateLimiter>(RateLimiter);

        const key = this.getKey(job);

        if (limiter.tooManyAttempts(key, this.maxAttempts)) {
            job.release(this.getTimeUntilNextRetry(limiter, key));

            return undefined;
        }

        const [ok, thrown] = pcall(() => _next(job));

        if (ok) {
            limiter.clear(key);

            return thrown;
        }

        if (this.whenCallback !== undefined && !this.whenCallback(thrown)) {
            throw thrown;
        }

        if (this.shouldDelete(thrown)) {
            job.delete();

            return undefined;
        }

        if (this.shouldFail(thrown)) {
            job.fail(thrown);

            return undefined;
        }

        limiter.hit(key, this.decaySeconds);

        job.release(this.getTimeUntilNextRetryAfterException(thrown));

        return undefined;
    }

    /** Specify a callback that should determine if the exception counts. */
    public when(callback: ExceptionTest): this {
        this.whenCallback = callback;

        return this;
    }

    /** Specify a callback that should determine if the job should be deleted. */
    public deleteWhen(callback: ExceptionTest): this {
        this.deleteWhenCallbacks.push(callback);

        return this;
    }

    /** Specify a callback that should determine if the job should fail. */
    public failWhen(callback: ExceptionTest): this {
        this.failWhenCallbacks.push(callback);

        return this;
    }

    /** Set the prefix of the rate limiter key. */
    public withPrefix(prefix: string): this {
        this.prefix = prefix;

        return this;
    }

    /** Set the value that the rate limiter key should be built from. */
    public by(key: string): this {
        this.key = key;

        return this;
    }

    /** Indicate that the throttle key should use the job's uuid. */
    public byJob(): this {
        this.byJobUuid = true;

        return this;
    }

    /** Set the number of minutes to wait before retrying a throttled job. */
    public backoff(minutes: number | ((e: unknown) => number)): this {
        this.retryAfterMinutes = minutes;

        return this;
    }

    /** Get the number of seconds to wait before retrying after an exception. */
    protected getTimeUntilNextRetryAfterException(e: unknown): number {
        const backoff = typeIs(this.retryAfterMinutes, 'function')
            ? (this.retryAfterMinutes as (e: unknown) => number)(e)
            : (this.retryAfterMinutes as number);

        return backoff * 60;
    }

    /** Determine whether the job should be deleted after the given exception. */
    protected shouldDelete(e: unknown): boolean {
        for (const callback of this.deleteWhenCallbacks) {
            if (callback(e)) {
                return true;
            }
        }

        return false;
    }

    /** Determine whether the job should fail after the given exception. */
    protected shouldFail(e: unknown): boolean {
        for (const callback of this.failWhenCallbacks) {
            if (callback(e)) {
                return true;
            }
        }

        return false;
    }

    /** Get the cache key associated for the rate limiter. */
    protected getKey(job: InteractsWithQueue): string {
        if (this.key !== '') {
            return this.prefix + this.key;
        }

        if (this.byJobUuid) {
            return this.prefix + (job.job?.uuid() ?? '');
        }

        const displayName = (job as { displayName?: unknown }).displayName;

        return (
            this.prefix +
            (typeIs(displayName, 'function')
                ? (displayName as (self: object) => string)(job)
                : Reflector.className(Reflector.classOf(job)))
        );
    }

    /** Get the number of seconds until the job should be retried. */
    protected getTimeUntilNextRetry(limiter: RateLimiter, key: string): number {
        return limiter.availableIn(key) + 3;
    }
}
