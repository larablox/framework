import { RuntimeException } from 'Illuminate/Exception';
import type { Response } from 'Illuminate/Http/Response';

/**
 * PHP: `Illuminate\Http\Exceptions\HttpResponseException`.
 *
 * The escape hatch a handler throws to answer immediately, from wherever it
 * is: `Route::run()` catches it and takes the response it carries. Validation
 * will throw it once it exists.
 */
export class HttpResponseException extends RuntimeException {
    /** Create a new HTTP response exception instance. */
    public constructor(protected readonly response: Response) {
        super();
    }

    /** Get the underlying response instance. */
    public getResponse(): Response {
        return this.response;
    }
}
