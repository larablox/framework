import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';

/** PHP: `Illuminate\Routing\Events\ResponsePrepared`. */
export class ResponsePrepared {
    /** Create a new event instance. */
    public constructor(
        public readonly request: Request,
        public readonly response: Response,
    ) {}
}
