import { SyncQueue } from 'Illuminate/Queue/SyncQueue';
import type { JobTarget } from 'Illuminate/Contracts/Queue/Queue';

/**
 * PHP: `Illuminate\Queue\DeferredQueue`.
 *
 * `SyncQueue` whose `push()` runs after the current work is done. PHP defers to
 * `Illuminate\Support\defer()`, which fires once the response has been sent;
 * `task.defer` is the same idea one layer down -- the job runs at the end of
 * the current resumption cycle, off the frame that queued it.
 *
 * Nothing is stored and nothing is retried: a job that throws throws inside its
 * own thread, where the caller is no longer listening.
 */
export class DeferredQueue extends SyncQueue
{
    /** Push a new job onto the queue. */
    public push(job: JobTarget, data: unknown = '', queue?: string): unknown
    {
        task.defer(() => {
            super.push(job, data, queue);
        });

        return undefined;
    }
}
