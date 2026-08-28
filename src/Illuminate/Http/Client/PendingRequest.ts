import { Conditionable } from 'Illuminate/Support/Traits/Conditionable';
import { ConnectionException } from 'Illuminate/Http/Client/ConnectionException';
import { Remote } from 'Illuminate/Http/Remote';
import { Response } from 'Illuminate/Http/Client/Response';
import { retry } from 'Illuminate/Support/Helpers';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused in the code, but declaration emit writes the specifier from this import; without it the `.d.ts` keeps the baseUrl path, which no consumer can resolve.
import type { ConditionableShape } from 'Illuminate/Support/Traits/Conditionable';
import type { RequestException } from 'Illuminate/Http/Client/RequestException';
import type { ResponseEnvelope, Transport } from 'Illuminate/Http/Remote';

/** PHP: `$sleepMilliseconds`, which may be a closure. */
type RetryDelay = number | ((attempts: number, exception: unknown) => number);

/**
 * PHP: `Illuminate\Http\Client\PendingRequest`.
 *
 * A request the client is about to make -- which here means a remote call to
 * the server, so the URL, the headers, the body format and the middleware
 * stack all fall away and what remains is the verb, the path and the payload.
 *
 * Two methods have no PHP counterpart, and both pick the transport, which is
 * the closest thing to choosing a URL scheme:
 *
 * - `withoutWaiting()` sends over the plain remote event: nothing comes back,
 *   and the answer is an immediate 204;
 * - `unreliable()` sends over the unreliable remote event, which the engine
 *   caps at 1000 bytes and is free to drop.
 *
 * Not ported: `timeout()` and `connectTimeout()` -- a yielded `InvokeServer`
 * cannot be abandoned, so a timeout would be a lie; `async()` and `pool()` --
 * no promises; `baseUrl`, headers, cookies, authentication, `asForm`,
 * `asMultipart`, `attach`, `withOptions`, the middleware and the event hooks --
 * all of them address HTTP, and none of it crosses a remote.
 */
export class PendingRequest extends Conditionable() {
    /** Which remote the request will leave on. */
    protected transport: Transport = 'call';

    /** The number of times to try the request. */
    protected tries: number | Array<number> = 1;

    /** The number of milliseconds to wait between retries. */
    protected retryDelay: RetryDelay = 0;

    /** The callback that will determine if the request should be retried. */
    protected retryWhenCallback?: (exception: unknown, request: PendingRequest) => boolean;

    /** Whether to throw an exception when all retries fail. */
    protected retryThrow = true;

    /** A callback to run when throwing a request exception. */
    protected throwCallback?: (response: Response, exception: RequestException) => void;

    /** A callback to check if an exception should be thrown when a server error occurs. */
    protected throwIfCallback?: (response: Response) => boolean;

    /** Send the request over the remote that expects no response. */
    public withoutWaiting(): this {
        this.transport = 'send';

        return this;
    }

    /** Send the request over the remote that may drop it. */
    public unreliable(): this {
        this.transport = 'stream';

        return this;
    }

    /** Specify the number of times the request should be attempted. */
    public retry(
        times: number | Array<number>,
        sleepMilliseconds: RetryDelay = 0,
        when?: (exception: unknown, request: PendingRequest) => boolean,
        throwOnFailure = true,
    ): this {
        this.tries = times;
        this.retryDelay = sleepMilliseconds;
        this.retryWhenCallback = when;
        this.retryThrow = throwOnFailure;

        return this;
    }

    /** Throw an exception if a server or client error occurs. */
    public throw(callback?: (response: Response, exception: RequestException) => void): this {
        this.throwCallback = callback ?? (() => {});

        return this;
    }

    /** Throw an exception if a server or client error occurred and the given condition evaluates to true. */
    public throwIf(
        condition: boolean | ((response: Response) => boolean),
        callback?: (response: Response, exception: RequestException) => void,
    ): this {
        if (typeIs(condition, 'function')) {
            this.throwIfCallback = condition as (response: Response) => boolean;

            return this.throw(callback);
        }

        return condition ? this.throw(callback) : this;
    }

    /**
     * Issue a GET request to the given path.
     *
     * PHP hangs the query on the URL; there is no URL here, so a GET carries
     * its data in the payload like every other verb.
     */
    public get(path: string, query?: ArrayAccessible): Response {
        return this.send('GET', path, query);
    }

    /** Issue a POST request to the given path. */
    public post(path: string, data?: ArrayAccessible): Response {
        return this.send('POST', path, data);
    }

    /** Issue a PUT request to the given path. */
    public put(path: string, data?: ArrayAccessible): Response {
        return this.send('PUT', path, data);
    }

    /** Issue a PATCH request to the given path. */
    public patch(path: string, data?: ArrayAccessible): Response {
        return this.send('PATCH', path, data);
    }

    /** Issue a DELETE request to the given path. */
    public delete(path: string, data?: ArrayAccessible): Response {
        return this.send('DELETE', path, data);
    }

    /** Send the request to the given path. */
    public send(method: string, path: string, data?: ArrayAccessible): Response {
        if (this.transport !== 'call') {
            this.fire(method, path, data);

            // Nothing will come back, so the caller is answered the way a
            // handler that produced no content would have answered.
            return new Response({ status: 204 });
        }

        let shouldRetry: boolean | undefined;

        return retry(
            this.tries,
            (attempt) => {
                const response = this.invoke(method, path, data);

                if (response.successful()) {
                    return response;
                }

                shouldRetry =
                    this.retryWhenCallback !== undefined ? this.retryWhenCallback(response.toException(), this) : true;

                if (
                    this.throwCallback !== undefined &&
                    (this.throwIfCallback === undefined || this.throwIfCallback(response))
                ) {
                    response.throw(this.throwCallback);
                }

                if (attempt < this.potentialTries() && shouldRetry) {
                    response.throw();
                }

                if (this.potentialTries() > 1 && this.retryThrow) {
                    response.throw();
                }

                return response;
            },
            this.retryDelay,
            (exception) => {
                const result =
                    shouldRetry ??
                    (this.retryWhenCallback !== undefined ? this.retryWhenCallback(exception, this) : true);

                shouldRetry = undefined;

                return result;
            },
        );
    }

    /** How many attempts the configured `tries` amounts to. */
    protected potentialTries(): number {
        return typeIs(this.tries, 'table') ? this.tries.size() + 1 : this.tries;
    }

    /** Send a request that nothing is waiting on. */
    protected fire(method: string, path: string, data?: ArrayAccessible): void {
        if (this.transport === 'stream') {
            Remote.stream().FireServer(method, path, data);

            return;
        }

        Remote.send().FireServer(method, path, data);
    }

    /** Send a request and wait for the server to answer it. */
    protected invoke(method: string, path: string, data?: ArrayAccessible): Response {
        let envelope: unknown;

        try {
            envelope = Remote.call().InvokeServer(method, path, data) as unknown;
        } catch (exception) {
            throw new ConnectionException(`Could not reach the server for [${method} ${path}]: ${tostring(exception)}`);
        }

        if (!typeIs(envelope, 'table') || !typeIs((envelope as ResponseEnvelope).status, 'number')) {
            throw new ConnectionException(
                `The server answered [${method} ${path}] with something that is not a response.`,
            );
        }

        return new Response(envelope as ResponseEnvelope);
    }
}
