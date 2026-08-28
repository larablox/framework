import { HttpClientException } from 'Illuminate/Http/Client/HttpClientException';
import type { Response } from 'Illuminate/Http/Client/Response';

/**
 * PHP: `Illuminate\Http\Client\RequestException`.
 *
 * PHP appends a truncated body summary to the message, which Guzzle produces
 * from the PSR response; the content here is a Luau value and not a stream, so
 * the message stops at the status code. `truncateExceptionsAt()` and the
 * `dontTruncate` switch go with it.
 *
 * The response is imported as a type only: it holds a `RequestException` back,
 * and a cycle between two value imports takes the whole module down.
 */
export class RequestException extends HttpClientException
{
    /** Create a new exception instance. */
    public constructor(public readonly response: Response)
    {
        super(`HTTP request returned status code ${response.status()}`, response.status());
    }
}
