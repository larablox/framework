import { HttpClientException } from 'Illuminate/Http/Client/HttpClientException';

/**
 * PHP: `Illuminate\Http\Client\ConnectionException`.
 *
 * Thrown when the call never reached a handler: the remote errored, was never
 * listened on, or answered with something that is not a response envelope.
 */
export class ConnectionException extends HttpClientException
{}
