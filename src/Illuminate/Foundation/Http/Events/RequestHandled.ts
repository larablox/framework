import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';

/** PHP: `Illuminate\Foundation\Http\Events\RequestHandled`. */
export class RequestHandled {
    /** Create a new event instance. */
    public constructor(
        public readonly request: Request,
        public readonly response: Response,
    ) {}
}
