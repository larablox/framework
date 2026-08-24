import type { Request } from "Illuminate/Http/Request";

/** PHP: `Illuminate\Routing\Events\PreparingResponse`. */
export class PreparingResponse {
    /** Create a new event instance. */
    public constructor(
        public readonly request: Request,
        public readonly response: unknown,
    ) {}
}
