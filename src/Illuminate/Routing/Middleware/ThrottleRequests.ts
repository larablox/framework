import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import { Limit } from 'Illuminate/Cache/RateLimiting/Limit';
import { RateLimiter } from 'Illuminate/Cache/RateLimiter';
import { Response } from 'Illuminate/Http/Response';
import { ThrottleRequestsException } from 'Illuminate/Http/Exceptions/ThrottleRequestsException';
import { Unlimited } from 'Illuminate/Cache/RateLimiting/Unlimited';
import { Util } from 'Illuminate/Container/Util';
import type { Next } from 'Illuminate/Pipeline/Pipeline';
import type { Request } from 'Illuminate/Http/Request';

/** One limit as the middleware works with it. */
interface ResolvedLimit
{
    key: string;
    maxAttempts: number;
    decaySeconds: number;
}

/**
 * PHP: `Illuminate\Routing\Middleware\ThrottleRequests`.
 *
 * The one middleware this platform cannot do without: a client can call
 * `InvokeServer` in a loop, and nothing but this stands between that loop and
 * the server.
 *
 * The request signature is the caller's `UserId`. PHP has to fall back to the
 * IP when there is no authenticated user and hashes the result; here the
 * engine names the player on every call, and a `UserId` is neither secret nor
 * long, so it is used as it is.
 *
 * Not ported: `ThrottleRequestsWithRedis` (the store is chosen by
 * `cache.limiter`, not by the middleware), `$maxAttempts` given as
 * `"60|120"` or as a user attribute (both read the authenticated user), and
 * `after`/`response` callbacks on a named limiter's `Limit`.
 */
export class ThrottleRequests
{
    /** Create a new request throttler. */
    public constructor(@Inject(RateLimiter) protected readonly limiter: RateLimiter)
    {}

    /** Handle an incoming request. */
    public handle(
        request: Request,
        _next: Next,
        maxAttempts: number | string = 60,
        decayMinutes: number | string = 1,
        prefix = '',
    ): unknown
    {
        const named = typeIs(maxAttempts, 'string') && this.limiter.limiter(maxAttempts) !== undefined;

        if (named) {
            return this.handleRequestUsingNamedLimiter(request, _next, maxAttempts as string);
        }

        return this.handleRequest(request, _next, [
            {
                key: `${prefix}${this.resolveRequestSignature(request)}`,
                maxAttempts: this.resolveMaxAttempts(maxAttempts),
                decaySeconds: 60 * (tonumber(decayMinutes) ?? 1),
            },
        ]);
    }

    /** Handle a request that is limited by a named limiter. */
    protected handleRequestUsingNamedLimiter(request: Request, _next: Next, limiterName: string): unknown
    {
        const limiter = this.limiter.limiter(limiterName) as (request: Request) => unknown;

        const limiterResponse = limiter(request);

        if (limiterResponse instanceof Response) {
            return limiterResponse;
        }

        if (limiterResponse instanceof Unlimited) {
            return _next(request);
        }

        const limits = new Array<ResolvedLimit>();

        for (const limit of Util.arrayWrap(limiterResponse as Limit | Array<Limit>)) {
            limits.push({
                key: `${limiterName}:${limit.key}`,
                maxAttempts: limit.maxAttempts,
                decaySeconds: limit.decaySeconds,
            });
        }

        return this.handleRequest(request, _next, limits);
    }

    /** Handle an incoming request against the given limits. */
    protected handleRequest(request: Request, _next: Next, limits: Array<ResolvedLimit>): unknown
    {
        for (const limit of limits) {
            if (this.limiter.tooManyAttempts(limit.key, limit.maxAttempts)) {
                throw this.buildException(limit.key, limit.maxAttempts);
            }
        }

        for (const limit of limits) {
            this.limiter.hit(limit.key, limit.decaySeconds);
        }

        let response = _next(request) as Response;

        for (const limit of limits) {
            response = this.addHeaders(
                response,
                limit.maxAttempts,
                this.calculateRemainingAttempts(limit.key, limit.maxAttempts),
            );
        }

        return response;
    }

    /** Resolve the number of attempts if the user is authenticated or not. */
    protected resolveMaxAttempts(maxAttempts: number | string): number
    {
        return tonumber(maxAttempts) ?? 60;
    }

    /**
     * Resolve request signature.
     *
     * PHP keys on the authenticated user, or on the domain and IP. The engine
     * hands over the player on every remote call, so the key is never in doubt
     * and never needs a fallback.
     */
    protected resolveRequestSignature(request: Request): string
    {
        return tostring(request.player().UserId);
    }

    /** Create a "too many attempts" exception. */
    protected buildException(key: string, maxAttempts: number): ThrottleRequestsException
    {
        const retryAfter = this.getTimeUntilNextRetry(key);

        return new ThrottleRequestsException('Too Many Attempts.', this.getHeaders(maxAttempts, 0, retryAfter));
    }

    /** Get the number of seconds until the next retry. */
    protected getTimeUntilNextRetry(key: string): number
    {
        return this.limiter.availableIn(key);
    }

    /** Add the limit header information to the given response. */
    protected addHeaders(
        response: Response,
        maxAttempts: number,
        remainingAttempts: number,
        retryAfter?: number,
    ): Response
    {
        return response.withHeaders(this.getHeaders(maxAttempts, remainingAttempts, retryAfter));
    }

    /** Get the limit headers information. */
    protected getHeaders(maxAttempts: number, remainingAttempts: number, retryAfter?: number): Record<string, string>
    {
        const headers: Record<string, string> = {
            ['X-RateLimit-Limit']: tostring(maxAttempts),
            ['X-RateLimit-Remaining']: tostring(remainingAttempts),
        };

        if (retryAfter !== undefined) {
            headers['Retry-After'] = tostring(retryAfter);
            headers['X-RateLimit-Reset'] = tostring(InteractsWithTime.availableAt(retryAfter));
        }

        return headers;
    }

    /** Calculate the number of remaining attempts. */
    protected calculateRemainingAttempts(key: string, maxAttempts: number): number
    {
        return this.limiter.retriesLeft(key, maxAttempts);
    }
}
