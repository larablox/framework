import type { Request } from 'Illuminate/Http/Request';

/** PHP: `Illuminate\Routing\Events\Routing`. */
export class Routing
{
    /** Create a new event instance. */
    public constructor(public readonly request: Request)
    {}
}
