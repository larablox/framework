import { MaxAttemptsExceededException } from "Illuminate/Queue/MaxAttemptsExceededException";
import type { Job } from "Illuminate/Contracts/Queue/Job";

/** PHP: `Illuminate\Queue\TimeoutExceededException`. */
export class TimeoutExceededException extends MaxAttemptsExceededException {
    /** Create a new instance for the given job. */
    public static forJob(job: Job): TimeoutExceededException {
        const e = new TimeoutExceededException(`${job.resolveName()} has timed out.`);

        e.job = job;

        return e;
    }
}
