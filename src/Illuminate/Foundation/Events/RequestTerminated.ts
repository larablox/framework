import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';

/**
 * PHP: `Laravel\Octane\Events\RequestTerminated`.
 *
 * The response is out and the terminable middleware has run. The last look at
 * the sandbox before it is flushed.
 */
export class RequestTerminated {
    /** Create a new event instance. */
    public constructor(
        public readonly app: Application,
        public readonly sandbox: Application,
        public readonly request: Request,
        public readonly response: Response,
    ) {}
}
