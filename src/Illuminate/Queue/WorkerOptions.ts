/**
 * PHP: `Illuminate\Queue\WorkerOptions`.
 *
 * Two defaults differ, and both because a Roblox server is not a PHP process:
 *
 * - `memory` is 0, which turns the check off. PHP counts the memory of one
 *   worker process against 128 MB; the only figure available here is the whole
 *   server's, which starts well above that.
 * - `timeout` is 0, likewise off. A job is only interruptible while it is
 *   suspended (see `Worker`), so a timeout is a best effort rather than the
 *   guarantee `pcntl_alarm` gives.
 *
 * `force` survives for shape only: it tells PHP to keep working while the
 * application is in maintenance mode, and there is no maintenance mode.
 */
export class WorkerOptions {
    /** Create a new worker options instance. */
    public constructor(
        public name = "default",
        public backoff: number | string = 0,
        public memory = 0,
        public timeout = 0,
        public sleep = 3,
        public maxTries = 1,
        public force = false,
        public stopWhenEmpty = false,
        public maxJobs = 0,
        public maxTime = 0,
        public rest = 0,
        public stopWhenEmptyFor = 0,
    ) {}
}
