import type { Batchable } from 'Illuminate/Bus/Batchable';
import type { Next } from 'Illuminate/Pipeline/Pipeline';

/** PHP: `Illuminate\Queue\Middleware\SkipIfBatchCancelled`. */
export class SkipIfBatchCancelled {
    /** Process the job. */
    public handle(job: Batchable, _next: Next): unknown {
        if (job.batch()?.cancelled() === true) {
            return undefined;
        }

        return _next(job);
    }
}
