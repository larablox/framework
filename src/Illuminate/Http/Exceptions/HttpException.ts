import { RuntimeException } from 'Illuminate/Exception';

/**
 * PHP: `Symfony\Component\HttpKernel\Exception\HttpException`.
 *
 * Symfony is not ported, but the routing code throws these by name and the
 * status they carry is what the client is answered with, so the family lives
 * here -- under `Illuminate\Http`, which is as close as this port gets.
 *
 * `getHeaders()` is kept because `MethodNotAllowedHttpException` fills in
 * `Allow`, exactly as it does in Symfony.
 */
export class HttpException extends RuntimeException
{
    /** Create a new HTTP exception instance. */
    public constructor(
        protected readonly statusCode: number,
        message = '',
        protected readonly headers: Record<string, string> = {},
    )
    {
        super(message, statusCode);
    }

    /** Get the status code the exception should be answered with. */
    public getStatusCode(): number
    {
        return this.statusCode;
    }

    /** Get the headers the exception should be answered with. */
    public getHeaders(): Record<string, string>
    {
        return this.headers;
    }
}

/** PHP: `Symfony\Component\HttpKernel\Exception\NotFoundHttpException`. */
export class NotFoundHttpException extends HttpException
{
    public constructor(message = '')
    {
        super(404, message);
    }
}

/** PHP: `Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException`. */
export class MethodNotAllowedHttpException extends HttpException
{
    public constructor(allowed: Array<string>, message = '')
    {
        super(405, message, { Allow: allowed.join(',') });
    }
}

/** PHP: `Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException`. */
export class TooManyRequestsHttpException extends HttpException
{
    public constructor(retryAfter?: number, message = '', headers: Record<string, string> = {})
    {
        super(429, message, TooManyRequestsHttpException.withRetryAfter(headers, retryAfter));
    }

    /**
     * Add the `Retry-After` header, when there is one to add.
     *
     * Spelled out rather than spread conditionally into the literal: the
     * compiler emits a call whose type `luau-lsp` cannot pin down, and the
     * analyzer is the only thing here that reads the generated Luau.
     */
    protected static withRetryAfter(headers: Record<string, string>, retryAfter?: number): Record<string, string>
    {
        const merged = table.clone(headers);

        if (retryAfter !== undefined) {
            merged['Retry-After'] = tostring(retryAfter);
        }

        return merged;
    }
}
