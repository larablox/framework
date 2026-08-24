import { RuntimeException } from "Illuminate/Exception";
import type { Job } from "Illuminate/Contracts/Queue/Job";

/** PHP: `Illuminate\Queue\MaxAttemptsExceededException`. */
export class MaxAttemptsExceededException extends RuntimeException {
    /** The job instance. */
    public job?: Job;

    /** Create a new instance for the given job. */
    public static forJob(job: Job): MaxAttemptsExceededException {
        const e = new MaxAttemptsExceededException(
            `${job.resolveName()} has been attempted too many times.`,
        );

        e.job = job;

        return e;
    }
}
