import { PendingRequest } from 'Illuminate/Http/Client/PendingRequest';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { RequestException } from 'Illuminate/Http/Client/RequestException';
import type { Response } from 'Illuminate/Http/Client/Response';

/** PHP: `$sleepMilliseconds`, which may be a closure. */
type RetryDelay = number | ((attempts: number, exception: unknown) => number);

/**
 * PHP: `Illuminate\Http\Client\Factory`.
 *
 * PHP forwards every unknown call to a fresh `PendingRequest` through
 * `__call`; there is no `__call`, so the forwarded surface is written out --
 * the same trade the facades make.
 *
 * Not ported: `fake()`, `preventStrayRequests()`, the recorder and the
 * assertions (there is no test suite to fake for), `pool()` and the promise
 * machinery, and the global middleware, which is a Guzzle stack.
 */
export class Factory {
    /** Create a new pending request instance for this factory. */
    public createPendingRequest(): PendingRequest {
        return new PendingRequest();
    }

    /** Send the request over the remote that expects no response. */
    public withoutWaiting(): PendingRequest {
        return this.createPendingRequest().withoutWaiting();
    }

    /** Send the request over the remote that may drop it. */
    public unreliable(): PendingRequest {
        return this.createPendingRequest().unreliable();
    }

    /** Specify the number of times the request should be attempted. */
    public retry(
        times: number | Array<number>,
        sleepMilliseconds: RetryDelay = 0,
        when?: (exception: unknown, request: PendingRequest) => boolean,
        throwOnFailure = true,
    ): PendingRequest {
        return this.createPendingRequest().retry(times, sleepMilliseconds, when, throwOnFailure);
    }

    /** Throw an exception if a server or client error occurs. */
    public throw(callback?: (response: Response, exception: RequestException) => void): PendingRequest {
        return this.createPendingRequest().throw(callback);
    }

    /** Throw an exception if a server or client error occurred and the given condition evaluates to true. */
    public throwIf(
        condition: boolean | ((response: Response) => boolean),
        callback?: (response: Response, exception: RequestException) => void,
    ): PendingRequest {
        return this.createPendingRequest().throwIf(condition, callback);
    }

    /** Issue a GET request to the given path. */
    public get(path: string, query?: ArrayAccessible): Response {
        return this.createPendingRequest().get(path, query);
    }

    /** Issue a POST request to the given path. */
    public post(path: string, data?: ArrayAccessible): Response {
        return this.createPendingRequest().post(path, data);
    }

    /** Issue a PUT request to the given path. */
    public put(path: string, data?: ArrayAccessible): Response {
        return this.createPendingRequest().put(path, data);
    }

    /** Issue a PATCH request to the given path. */
    public patch(path: string, data?: ArrayAccessible): Response {
        return this.createPendingRequest().patch(path, data);
    }

    /** Issue a DELETE request to the given path. */
    public delete(path: string, data?: ArrayAccessible): Response {
        return this.createPendingRequest().delete(path, data);
    }

    /** Send the request to the given path. */
    public send(method: string, path: string, data?: ArrayAccessible): Response {
        return this.createPendingRequest().send(method, path, data);
    }
}
