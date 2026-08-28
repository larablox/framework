import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import { ManuallyFailedException } from 'Illuminate/Queue/ManuallyFailedException';
import type { Delay } from 'Illuminate/Support/InteractsWithTime';
import type { Job } from 'Illuminate/Contracts/Queue/Job';

/**
 * PHP: `Illuminate\Queue\InteractsWithQueue`.
 *
 * A trait a job uses to reach the queue job carrying it. TypeScript has no
 * multiple inheritance, so a job extends this class instead -- which is also
 * what `CallQueuedHandler` tests for, in place of `class_uses_recursive()`.
 *
 * The `assert*` helpers and `withFakeQueueInteractions()` are PHPUnit; there is
 * no test runner here.
 */
export class InteractsWithQueue {
    /** The underlying queue job instance. */
    public job?: Job;

    /** Get the number of times the job has been attempted. */
    public attempts(): number {
        return this.job !== undefined ? this.job.attempts() : 1;
    }

    /** Delete the job from the queue. */
    public delete(): void {
        if (this.job !== undefined) {
            this.job.delete();
        }
    }

    /** Fail the job from the queue. */
    public fail(exception?: unknown): void {
        const failure = typeIs(exception, 'string') ? new ManuallyFailedException(exception) : exception;

        if (this.job !== undefined) {
            this.job.fail(failure);
        }
    }

    /** Release the job back into the queue after (n) seconds. */
    public release(delay: Delay = 0): void {
        if (this.job !== undefined) {
            this.job.release(InteractsWithTime.secondsUntil(delay));
        }
    }

    /** Set the base queue job instance. */
    public setJob(job: Job): this {
        this.job = job;

        return this;
    }
}
