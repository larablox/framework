import { Arr } from 'Illuminate/Support/Arr';
import { Collection } from 'Illuminate/Support/Collection';
import { Conditionable } from 'Illuminate/Support/Traits/Conditionable';
import { DeterminesStatusCode } from 'Illuminate/Http/Client/Concerns/DeterminesStatusCode';
import { RequestException } from 'Illuminate/Http/Client/RequestException';
import { data_get } from 'Illuminate/Support/helpers';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused in the code, but declaration emit writes the specifier from this import; without it the `.d.ts` keeps the baseUrl path, which no consumer can resolve.
import type { ConditionableShape } from 'Illuminate/Support/Traits/Conditionable';
import type { ResponseEnvelope } from 'Illuminate/Http/Remote';

/**
 * PHP: `Illuminate\Http\Client\Response`.
 *
 * PHP wraps a PSR-7 response and decodes its body on demand; the envelope that
 * comes back over a remote is already a Luau value, so `body()` and `json()`
 * answer the same thing -- the second one only adds the dot-notation lookup.
 *
 * Not ported: `object()`, `resource()` (no JSON decoding to steer),
 * `effectiveUri()`, `reason()` (no reason phrase), `cookies()`,
 * `handlerStats()`, `close()`, the PSR conversions, `redirect()`, and the
 * `dump`/`dd` family.
 */
export class Response extends DeterminesStatusCode(Conditionable())
{
    /** Create a new response instance. */
    public constructor(protected readonly envelope: ResponseEnvelope)
    {
        super();
    }

    /** Get the body of the response. */
    public body(): unknown
    {
        return this.envelope.data;
    }

    /** Get the decoded body of the response. */
    public json(key?: string, defaultValue?: unknown): unknown
    {
        if (key === undefined) {
            return this.envelope.data;
        }

        return data_get(this.envelope.data, key, defaultValue);
    }

    /** Get the JSON decoded body of the response as a collection. */
    public collect(key?: string): Collection<defined, defined>
    {
        const value = this.json(key);

        if (Arr.accessible(value)) {
            return new Collection(value as Record<string, defined>);
        }

        return new Collection(value === undefined ? new Array<defined>() : [value as defined]);
    }

    /** Get a header from the response. */
    public header(header: string): string
    {
        return this.envelope.headers?.[header] ?? '';
    }

    /** Get the headers from the response. */
    public headers(): Record<string, string>
    {
        const headers = this.envelope.headers;

        return headers === undefined ? {} : table.clone(headers);
    }

    /** Get the status code of the response. */
    public status(): number
    {
        return this.envelope.status;
    }

    /** Determine if the request was successful. */
    public successful(): boolean
    {
        return this.status() >= 200 && this.status() < 300;
    }

    /** Determine if the response indicates a client or server error occurred. */
    public failed(): boolean
    {
        return this.serverError() || this.clientError();
    }

    /** Determine if the response indicates a client error occurred. */
    public clientError(): boolean
    {
        return this.status() >= 400 && this.status() < 500;
    }

    /** Determine if the response indicates a server error occurred. */
    public serverError(): boolean
    {
        return this.status() >= 500;
    }

    /** Execute the given callback if there was a server or client error. */
    public onError(callback: (response: this) => void): this
    {
        if (this.failed()) {
            callback(this);
        }

        return this;
    }

    /** Create an exception if a server or client error occurred. */
    public toException(): RequestException | undefined
    {
        return this.failed() ? new RequestException(this) : undefined;
    }

    /** Throw an exception if a server or client error occurred. */
    public throw(callback?: (response: this, exception: RequestException) => void): this
    {
        if (this.failed()) {
            const exception = new RequestException(this);

            if (callback !== undefined) {
                callback(this, exception);
            }

            throw exception;
        }

        return this;
    }

    /** Throw an exception if a server or client error occurred and the given condition evaluates to true. */
    public throwIf(
        condition: boolean | ((response: this) => boolean),
        callback?: (response: this, exception: RequestException) => void,
    ): this
    {
        const met: boolean = typeIs(condition, 'function')
            ? (condition as (response: this) => boolean)(this)
            : condition;

        return met ? this.throw(callback) : this;
    }

    /** Throw an exception if the response status code matches the given code. */
    public throwIfStatus(status: number | ((status: number, response: this) => boolean)): this
    {
        const met: boolean = typeIs(status, 'function')
            ? (status as (status: number, response: this) => boolean)(this.status(), this)
            : this.status() === status;

        // PHP raises the exception here itself rather than going through
        // `throw()`, so a status that matches raises even when it is not a
        // failure -- `throwIfStatus(201)` on a 201 response throws.
        if (met) {
            throw new RequestException(this);
        }

        return this;
    }

    /** Throw an exception unless the response status code matches the given code. */
    public throwUnlessStatus(status: number | ((status: number, response: this) => boolean)): this
    {
        const met: boolean = typeIs(status, 'function')
            ? (status as (status: number, response: this) => boolean)(this.status(), this)
            : this.status() === status;

        // Raised directly, for the same reason as in `throwIfStatus()`.
        if (!met) {
            throw new RequestException(this);
        }

        return this;
    }

    /** Throw an exception if the response status code is a 4xx level code. */
    public throwIfClientError(): this
    {
        return this.clientError() ? this.throw() : this;
    }

    /** Throw an exception if the response status code is a 5xx level code. */
    public throwIfServerError(): this
    {
        return this.serverError() ? this.throw() : this;
    }
}
