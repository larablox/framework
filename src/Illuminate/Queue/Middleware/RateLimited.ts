import { Container } from "Illuminate/Container/Container";
import { RateLimiter } from "Illuminate/Cache/RateLimiter";
import { Unlimited } from "Illuminate/Cache/RateLimiting/Unlimited";
import { Util } from "Illuminate/Container/Util";
import type { InteractsWithQueue } from "Illuminate/Queue/InteractsWithQueue";
import type { Limit } from "Illuminate/Cache/RateLimiting/Limit";
import type { Next } from "Illuminate/Pipeline/Pipeline";

/** One limit, reduced to what the middleware needs. */
interface ResolvedLimit {
    key: string;
    maxAttempts: number;
    decaySeconds: number;
}

/**
 * PHP: `Illuminate\Queue\Middleware\RateLimited`.
 *
 * Holds a job back when its named limiter says the rate is exceeded, releasing
 * it to be tried again later.
 *
 * PHP hashes the key with `md5`; there is no hash function here, so the limiter
 * name and the limit key are joined as they are. `RateLimitedWithRedis` is a
 * Lua-script variant of the same middleware and has nothing to port to.
 */
export class RateLimited {
    /** The rate limiter instance. */
    protected limiter: RateLimiter;

    /** The number of seconds a job is released for. */
    public releaseAfterSeconds?: number;

    /** Indicates if the job should be released when the limit is hit. */
    public shouldRelease = true;

    /** Create a new middleware instance. */
    public constructor(protected readonly limiterName: string) {
        this.limiter = Container.getInstance().make<RateLimiter>(RateLimiter);
    }

    /** Process the job. */
    public handle(job: InteractsWithQueue, _next: Next): unknown {
        const limiter = this.limiter.limiter(this.limiterName);

        if (limiter === undefined) {
            return _next(job);
        }

        const response = limiter(job as never);

        if (response === undefined || response instanceof Unlimited) {
            return _next(job);
        }

        const limits = (Util.isArray(response) ? (response as Array<Limit>) : [response as Limit]).map((limit) => ({
            key: `${this.limiterName}${limit.key}`,
            maxAttempts: limit.maxAttempts,
            decaySeconds: limit.decaySeconds,
        }));

        return this.handleJob(job, _next, limits);
    }

    /** Process the job, given the resolved limits. */
    protected handleJob(job: InteractsWithQueue, _next: Next, limits: Array<ResolvedLimit>): unknown {
        for (const limit of limits) {
            if (this.limiter.tooManyAttempts(limit.key, limit.maxAttempts)) {
                if (!this.shouldRelease) {
                    return false;
                }

                job.release(this.releaseAfterSeconds ?? this.getTimeUntilNextRetry(limit.key));

                return undefined;
            }

            this.limiter.hit(limit.key, limit.decaySeconds);
        }

        return _next(job);
    }

    /** Set the number of seconds the job should be released for. */
    public releaseAfter(seconds: number): this {
        this.releaseAfterSeconds = seconds;

        return this;
    }

    /** Do not release the job back to the queue when the limit is hit. */
    public dontRelease(): this {
        this.shouldRelease = false;

        return this;
    }

    /** Get the number of seconds that should elapse before the job is retried. */
    protected getTimeUntilNextRetry(key: string): number {
        return this.limiter.availableIn(key) + 3;
    }
}
