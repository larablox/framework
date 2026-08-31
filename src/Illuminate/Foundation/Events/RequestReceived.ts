import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Request } from 'Illuminate/Http/Request';

/**
 * PHP: `Laravel\Octane\Events\RequestReceived`.
 *
 * The sandbox exists and nothing has touched it yet: the place to put back
 * whatever the previous request left behind. `app` is the root application,
 * which outlives the request; `sandbox` is the copy handling it.
 */
export class RequestReceived
{
    /** Create a new event instance. */
    public constructor(
        public readonly app: Application,
        public readonly sandbox: Application,
        public readonly request: Request,
    )
    {}
}
