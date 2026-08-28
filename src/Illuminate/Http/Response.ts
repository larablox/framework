import { OrderedMap } from 'Illuminate/Support/OrderedMap';

/**
 * PHP: `Illuminate\Http\Response` plus the parts of `ResponseTrait` and of
 * Symfony's `Response` that still mean something without HTTP.
 *
 * The content is any value the transport can carry, not a string: a remote
 * call hands back a Luau value, so there is nothing to encode. That also makes
 * `JsonResponse` redundant -- `response()->json($data)` and
 * `response()->make($data)` would build the same object.
 *
 * Headers survive because ported middleware writes them (`ThrottleRequests`
 * sets `X-RateLimit-*`). Symfony exposes them as a public `ParameterBag`
 * property; property access cannot be intercepted here, so they are reached
 * through methods.
 *
 * Not ported: cookies, `sendHeaders`/`sendContent`/`send`, the charset and
 * protocol version, caching directives (`setCache`, `setEtag`, ...),
 * `RedirectResponse`, `StreamedResponse`, `BinaryFileResponse`.
 */
export class Response
{
    public static readonly HTTP_OK = 200;

    public static readonly HTTP_CREATED = 201;

    public static readonly HTTP_ACCEPTED = 202;

    public static readonly HTTP_NO_CONTENT = 204;

    public static readonly HTTP_BAD_REQUEST = 400;

    public static readonly HTTP_UNAUTHORIZED = 401;

    public static readonly HTTP_FORBIDDEN = 403;

    public static readonly HTTP_NOT_FOUND = 404;

    public static readonly HTTP_METHOD_NOT_ALLOWED = 405;

    public static readonly HTTP_UNPROCESSABLE_ENTITY = 422;

    public static readonly HTTP_TOO_MANY_REQUESTS = 429;

    public static readonly HTTP_INTERNAL_SERVER_ERROR = 500;

    public static readonly HTTP_SERVICE_UNAVAILABLE = 503;

    /** The response content. */
    protected responseContent: unknown;

    /** The response status code. */
    protected statusCode: number;

    /** The headers set on the response. */
    protected responseHeaders = new OrderedMap<string, string>();

    /** The exception that caused the response, if any. */
    protected responseException?: unknown;

    /** Create a new response instance. */
    public constructor(content?: unknown, status: number = Response.HTTP_OK, headers?: Record<string, string>)
    {
        this.responseContent = content;
        this.statusCode = status;

        if (headers !== undefined) {
            this.withHeaders(headers);
        }
    }

    /** Set the content on the response. */
    public setContent(content: unknown): this
    {
        this.responseContent = content;

        return this;
    }

    /** Get the content of the response. */
    public getContent(): unknown
    {
        return this.responseContent;
    }

    /** Get the content of the response. */
    public content(): unknown
    {
        return this.getContent();
    }

    /**
     * Prepare the response for the given request.
     *
     * PHP: `Symfony\Component\HttpFoundation\Response::prepare()`, which
     * `Router::toResponse()` calls on its way out. Almost all of it is about
     * HTTP headers, charsets and protocol versions that a remote call has no
     * use for; the one rule that carries over is that a HEAD request answers
     * with the headers of a GET and no body at all.
     */
    public prepare(request: { method(): string; }): this
    {
        if (request.method() === 'HEAD') {
            this.setContent(undefined);
        }

        return this;
    }

    /** Get the status code for the response. */
    public getStatusCode(): number
    {
        return this.statusCode;
    }

    /** Get the status code for the response. */
    public status(): number
    {
        return this.getStatusCode();
    }

    /** Set the status code for the response. */
    public setStatusCode(code: number): this
    {
        this.statusCode = code;

        return this;
    }

    /** Set a header on the response. */
    public header(key: string, value: string, replace = true): this
    {
        if (replace || !this.responseHeaders.has(key)) {
            this.responseHeaders.set(key, value);
        }

        return this;
    }

    /** Add an array of headers to the response. */
    public withHeaders(headers: Record<string, string>): this
    {
        for (const [key, value] of pairs(headers)) {
            this.responseHeaders.set(key as string, value as string);
        }

        return this;
    }

    /**
     * Get the headers set on the response.
     *
     * PHP reads them off the public `headers` property, a `ParameterBag`.
     */
    public getHeaders(): OrderedMap<string, string>
    {
        return this.responseHeaders;
    }

    /**
     * Set the exception to attach to the response.
     *
     * PHP: `ResponseTrait::withException()`. The response a thrown exception
     * turned into keeps a pointer back to it, so a listener on
     * `RequestHandled` -- or a middleware the response passes on its way out --
     * can tell an answered request from a failed one.
     */
    public withException(e: unknown): this
    {
        this.responseException = e;

        return this;
    }

    /** The exception that caused the response, if any. */
    public exception(): unknown
    {
        return this.responseException;
    }

    /** Is the response successful? */
    public isSuccessful(): boolean
    {
        return this.statusCode >= 200 && this.statusCode < 300;
    }

    /** Is the response OK? */
    public isOk(): boolean
    {
        return this.statusCode === Response.HTTP_OK;
    }

    /** Is there a client error? */
    public isClientError(): boolean
    {
        return this.statusCode >= 400 && this.statusCode < 500;
    }

    /** Was there a server side error? */
    public isServerError(): boolean
    {
        return this.statusCode >= 500 && this.statusCode < 600;
    }

    /** Is the response empty? */
    public isEmpty(): boolean
    {
        return this.statusCode === Response.HTTP_NO_CONTENT || this.statusCode === 304;
    }
}
