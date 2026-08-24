/** PHP: `Illuminate\Bus\UpdatedBatchJobCounts`. */
export class UpdatedBatchJobCounts {
    /** Create a new batch job counts object. */
    public constructor(
        public readonly pendingJobs = 0,
        public readonly failedJobs = 0,
    ) {}

    /** Determine if all jobs have run exactly once. */
    public allJobsHaveRanExactlyOnce(): boolean {
        return this.pendingJobs - this.failedJobs === 0;
    }
}
