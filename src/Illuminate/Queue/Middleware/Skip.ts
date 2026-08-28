import type { InteractsWithQueue } from "Illuminate/Queue/InteractsWithQueue";
import type { Next } from "Illuminate/Pipeline/Pipeline";

/** PHP: `Illuminate\Queue\Middleware\Skip`. */
export class Skip {
    /** Create a new middleware instance. */
    public constructor(protected readonly skip = false) {}

    /** Skip the job when the condition holds. */
    public static when(condition: boolean | (() => boolean)): Skip {
        return new Skip(typeIs(condition, "function") ? condition() : condition);
    }

    /** Skip the job unless the condition holds. */
    public static unless(condition: boolean | (() => boolean)): Skip {
        return new Skip(!(typeIs(condition, "function") ? condition() : condition));
    }

    /** Process the job. */
    public handle(job: InteractsWithQueue, _next: Next): unknown {
        if (this.skip) {
            return false;
        }

        return _next(job);
    }
}
