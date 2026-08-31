import { JobAttempted } from 'Illuminate/Queue/Events/JobAttempted';
import { JobExceptionOccurred } from 'Illuminate/Queue/Events/JobExceptionOccurred';
import { JobPopped } from 'Illuminate/Queue/Events/JobPopped';
import { JobPopping } from 'Illuminate/Queue/Events/JobPopping';
import { JobProcessed } from 'Illuminate/Queue/Events/JobProcessed';
import { JobProcessing } from 'Illuminate/Queue/Events/JobProcessing';
import { JobReleasedAfterException } from 'Illuminate/Queue/Events/JobReleasedAfterException';
import { JobTimedOut } from 'Illuminate/Queue/Events/JobTimedOut';
import { Looping } from 'Illuminate/Queue/Events/Looping';
import { MaxAttemptsExceededException } from 'Illuminate/Queue/MaxAttemptsExceededException';
import { TimeoutExceededException } from 'Illuminate/Queue/TimeoutExceededException';
import { WorkerIdle } from 'Illuminate/Queue/Events/WorkerIdle';
import { WorkerStarting } from 'Illuminate/Queue/Events/WorkerStarting';
import { WorkerStopReason } from 'Illuminate/Queue/WorkerStopReason';
import { WorkerStopping } from 'Illuminate/Queue/Events/WorkerStopping';
import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Factory } from 'Illuminate/Contracts/Queue/Factory';
import type { Repository as Cache } from 'Illuminate/Contracts/Cache/Repository';
import type { Job } from 'Illuminate/Contracts/Queue/Job';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';
import type { WorkerOptions } from 'Illuminate/Queue/WorkerOptions';

const Stats = game.GetService('Stats');

/**
 * PHP: `ExceptionHandler::report()`.
 *
 * The exceptions component is not ported; the worker is handed a reporter
 * instead, and the service provider passes one that writes to the log.
 */
export type ExceptionReporter = (e: unknown) => void;

/** What `stopIfNecessary()` answers with. */
type StopDecision = [number, WorkerStopReason] | undefined;

/**
 * PHP: `Illuminate\Queue\Worker`.
 *
 * The daemon is a coroutine rather than a process, which changes three things.
 *
 * **Yielding.** A PHP worker may spin as hard as it likes in its own process.
 * Here the loop shares a thread with the game, so it yields whenever it has run
 * for longer than `Worker.frameBudget` without doing so. Without that, a full
 * queue would hold the frame.
 *
 * **Timeouts.** `pcntl_alarm` has no counterpart. A job runs in its own
 * coroutine and `task.cancel` takes it down when `timeout` passes -- but only
 * while it is suspended. A job that never yields cannot be interrupted, so the
 * timeout is best effort and off by default.
 *
 * **Signals and restarts.** `SIGTERM`, `SIGUSR2` and the cache-backed restart
 * signal are gone with the process: `stop()` sets a flag, and a shutdown hook
 * is the place to call it. `queueShouldRestart()` and `getPausedQueues()` still
 * wait on the cache-backed restart and pause flags.
 */
export class Worker
{
    public static readonly EXIT_SUCCESS = 0;
    public static readonly EXIT_ERROR = 1;
    public static readonly EXIT_MEMORY_LIMIT = 12;

    /** Seconds the loop may run without yielding to the scheduler. */
    public static frameBudget = 0.004;

    /** The name of the worker. */
    protected name = 'default';

    /** Indicates if the worker should exit. */
    protected shouldQuit = false;

    /** Indicates if the worker is paused. */
    protected paused = false;

    /** The job the worker is currently running. */
    protected currentJob?: Job;

    /** The cache repository, used to count exceptions per job. */
    protected cache?: Cache;

    /** Create a new queue worker. */
    public constructor(
        protected readonly manager: Factory,
        protected readonly events: Dispatcher,
        protected readonly exceptions: ExceptionReporter,
        protected readonly resetScope?: () => void,
    )
    {}

    /** Listen to the given queue in a loop. */
    public daemon(connectionName: string, queue: string, options: WorkerOptions): number
    {
        const startTime = InteractsWithTime.currentTime();

        let jobsProcessed = 0;
        let lastJobProcessedAt = startTime;
        let lastYield = os.clock();

        this.raiseWorkerStartingEvent(connectionName, queue, options);

        while (true) {
            if (os.clock() - lastYield >= Worker.frameBudget) {
                task.wait();

                lastYield = os.clock();
            }

            // Before reserving any jobs, we will make sure this queue is not paused and
            // if it is we will just pause this worker for a given amount of time and
            // make sure we do not need to kill this worker process off completely.
            if (!this.daemonShouldRun(options, connectionName, queue)) {
                const paused = this.pauseWorker(options, startTime, jobsProcessed, lastJobProcessedAt);

                lastYield = os.clock();

                if (paused !== undefined) {
                    return this.stop(paused[0], options, paused[1]);
                }

                continue;
            }

            if (this.resetScope !== undefined) {
                this.resetScope();
            }

            // First, we will attempt to get the next job off of the queue.
            const job = this.getNextJob(this.manager.connection(connectionName), queue);

            if (job !== undefined) {
                jobsProcessed += 1;

                this.runJob(job, connectionName, options);

                lastJobProcessedAt = InteractsWithTime.currentTime();

                if (options.rest > 0) {
                    this.sleep(options.rest);

                    lastYield = os.clock();
                }
            } else {
                this.events.dispatch(new WorkerIdle(connectionName, queue, options));

                this.sleep(options.sleep);

                lastYield = os.clock();
            }

            // Finally, we will check to see if we have exceeded our memory limits or if
            // the queue should stop for one of the other reasons it may have.
            const decision = this.stopIfNecessary(options, startTime, jobsProcessed, job, lastJobProcessedAt);

            if (decision !== undefined) {
                return this.stop(decision[0], options, decision[1]);
            }
        }
    }

    /** Determine if the daemon should process on this iteration. */
    protected daemonShouldRun(options: WorkerOptions, connectionName: string, queue: string): boolean
    {
        return !(this.paused || this.events.until(new Looping(connectionName, queue, options)) === false);
    }

    /** Pause the worker for the current loop. */
    protected pauseWorker(
        options: WorkerOptions,
        startTime: number,
        jobsProcessed: number,
        lastJobProcessedAt: number,
    ): StopDecision
    {
        this.sleep(options.sleep > 0 ? options.sleep : 1);

        return this.stopIfNecessary(options, startTime, jobsProcessed, undefined, lastJobProcessedAt);
    }

    /** Determine the exit code to stop the process if necessary. */
    protected stopIfNecessary(
        options: WorkerOptions,
        startTime: number,
        jobsProcessed: number,
        job: Job | undefined,
        lastJobProcessedAt: number,
    ): StopDecision
    {
        if (this.shouldQuit) {
            return [
                Worker.EXIT_SUCCESS,
                WorkerStopReason.Interrupted,
            ];
        }

        if (this.memoryExceeded(options.memory)) {
            return [
                Worker.EXIT_MEMORY_LIMIT,
                WorkerStopReason.MaxMemoryExceeded,
            ];
        }

        if (options.stopWhenEmpty && job === undefined) {
            return [
                Worker.EXIT_SUCCESS,
                WorkerStopReason.QueueEmpty,
            ];
        }

        if (
            options.stopWhenEmptyFor > 0
            && job === undefined
            && InteractsWithTime.currentTime() - lastJobProcessedAt >= options.stopWhenEmptyFor
        ) {
            return [
                Worker.EXIT_SUCCESS,
                WorkerStopReason.QueueEmptyFor,
            ];
        }

        if (options.maxTime > 0 && InteractsWithTime.currentTime() - startTime >= options.maxTime) {
            return [
                Worker.EXIT_SUCCESS,
                WorkerStopReason.MaxTimeExceeded,
            ];
        }

        if (options.maxJobs > 0 && jobsProcessed >= options.maxJobs) {
            return [
                Worker.EXIT_SUCCESS,
                WorkerStopReason.MaxJobsExceeded,
            ];
        }

        return undefined;
    }

    /** Process the next job on the queue. */
    public runNextJob(connectionName: string, queue: string, options: WorkerOptions): void
    {
        const job = this.getNextJob(this.manager.connection(connectionName), queue);

        if (job !== undefined) {
            this.runJob(job, connectionName, options);

            return;
        }

        this.sleep(options.sleep);
    }

    /** Get the next job from the queue connection. */
    protected getNextJob(connection: Queue, queue: string): Job | undefined
    {
        this.raiseBeforeJobPopEvent(connection.getConnectionName(), queue);

        const [ok, result] = pcall(() => {
            for (const name of queue.split(',')) {
                const job = connection.pop(name);

                if (job !== undefined) {
                    return job;
                }
            }

            return undefined;
        });

        if (!ok) {
            this.exceptions(result);

            this.sleep(1);

            return undefined;
        }

        const job = result as Job | undefined;

        if (job !== undefined) {
            this.raiseAfterJobPopEvent(connection.getConnectionName(), job);
        }

        return job;
    }

    /** Process the given job. */
    protected runJob(job: Job, connectionName: string, options: WorkerOptions): void
    {
        this.currentJob = job;

        try {
            this.process(connectionName, job, options);
        } catch (e) {
            this.exceptions(e);
        } finally {
            this.currentJob = undefined;
        }
    }

    /** Process the given job from the queue. */
    public process(connectionName: string, job: Job, options: WorkerOptions): void
    {
        let exceptionOccurred: unknown;

        try {
            this.raiseBeforeJobEvent(connectionName, job);

            this.markJobAsFailedIfAlreadyExceedsMaxAttempts(connectionName, job, options.maxTries);

            if (job.isDeleted()) {
                this.raiseAfterJobEvent(connectionName, job);

                return;
            }

            this.fireJob(connectionName, job, options);

            this.raiseAfterJobEvent(connectionName, job);
        } catch (e) {
            exceptionOccurred = e;

            this.handleJobException(connectionName, job, options, e);
        } finally {
            this.events.dispatch(new JobAttempted(connectionName, job, exceptionOccurred));
        }
    }

    /**
     * Fire the job, giving up on it once its timeout passes.
     *
     * PHP arms `pcntl_alarm` and lets the signal interrupt whatever the job is
     * doing. The job runs in its own coroutine here, and `task.cancel` reaches
     * it only while it is suspended -- which covers everything that waits on a
     * DataStore, a MemoryStore or a remote, and nothing that spins.
     */
    protected fireJob(connectionName: string, job: Job, options: WorkerOptions): void
    {
        const timeout = job.timeout() ?? options.timeout;

        const state: { done: boolean; ok: boolean; error: unknown; } = {
            done: false,
            ok: true,
            error: undefined,
        };

        const thread = task.spawn(() => {
            const [ok, thrown] = pcall(() => job.fire());

            state.ok = ok;
            state.error = thrown;
            state.done = true;
        });

        if (timeout > 0) {
            const deadline = os.clock() + timeout;

            while (!state.done && os.clock() < deadline) {
                task.wait();
            }

            if (!state.done) {
                pcall(() => task.cancel(thread));

                this.events.dispatch(new JobTimedOut(connectionName, job));

                const e = TimeoutExceededException.forJob(job);

                this.markJobAsFailedIfItShouldFailOnTimeout(connectionName, job, e);

                throw e;
            }
        } else {
            while (!state.done) {
                task.wait();
            }
        }

        if (!state.ok) {
            throw state.error;
        }
    }

    /** Handle an exception that occurred while the job was running. */
    protected handleJobException(connectionName: string, job: Job, options: WorkerOptions, e: unknown): never
    {
        try {
            if (!job.hasFailed()) {
                this.markJobAsFailedIfWillExceedMaxAttempts(connectionName, job, options.maxTries, e);

                this.markJobAsFailedIfWillExceedMaxExceptions(connectionName, job, e);
            }

            this.raiseExceptionOccurredJobEvent(connectionName, job, e);
        } finally {
            if (!job.isDeleted() && !job.isReleased() && !job.hasFailed()) {
                const backoff = this.calculateBackoff(job, options);

                job.release(backoff);

                this.events.dispatch(new JobReleasedAfterException(connectionName, job, backoff));
            }
        }

        throw e;
    }

    /** Mark the given job as failed if it has exceeded the maximum allowed attempts. */
    protected markJobAsFailedIfAlreadyExceedsMaxAttempts(connectionName: string, job: Job, maxTries: number): void
    {
        const tries = job.maxTries() ?? maxTries;

        const retryUntil = job.retryUntil();

        if (retryUntil !== undefined && InteractsWithTime.currentTime() <= retryUntil) {
            return;
        }

        if (retryUntil === undefined && (tries === 0 || job.attempts() <= tries)) {
            return;
        }

        const e = this.maxAttemptsExceededException(job);

        this.failJob(job, e);

        throw e;
    }

    /** Mark the given job as failed if it has exceeded the maximum allowed attempts. */
    protected markJobAsFailedIfWillExceedMaxAttempts(
        connectionName: string,
        job: Job,
        maxTries: number,
        e: unknown,
    ): void
    {
        const tries = job.maxTries() ?? maxTries;

        const retryUntil = job.retryUntil();

        if (retryUntil !== undefined && retryUntil <= InteractsWithTime.currentTime()) {
            this.failJob(job, e);
        }

        if (retryUntil === undefined && tries > 0 && job.attempts() >= tries) {
            this.failJob(job, e);
        }
    }

    /**
     * Mark the given job as failed if it has exceeded the maximum allowed
     * attempts after an exception.
     *
     * The count lives in the cache, keyed by the job's uuid, so it survives the
     * job being released and picked up again -- possibly by another server.
     */
    protected markJobAsFailedIfWillExceedMaxExceptions(connectionName: string, job: Job, e: unknown): void
    {
        const uuid = job.uuid();

        const maxExceptions = job.maxExceptions();

        if (this.cache === undefined || uuid === undefined || maxExceptions === undefined) {
            return;
        }

        const key = `job-exceptions:${uuid}`;

        if (this.cache.get(key) === undefined) {
            this.cache.put(key, 0, 86400);
        }

        const seen = this.cache.increment(key);

        if (seen !== false && maxExceptions <= seen) {
            this.cache.forget(key);

            this.failJob(job, e);
        }
    }

    /** Set the cache repository implementation. */
    public setCache(cache: Cache): this
    {
        this.cache = cache;

        return this;
    }

    /** Mark the given job as failed if it should fail on timeouts. */
    protected markJobAsFailedIfItShouldFailOnTimeout(connectionName: string, job: Job, e: unknown): void
    {
        const shouldFail = (job as { shouldFailOnTimeout?: unknown; }).shouldFailOnTimeout;

        if (typeIs(shouldFail, 'function') && (shouldFail as (self: Job) => boolean)(job)) {
            this.failJob(job, e);
        }
    }

    /** Mark the given job as failed and raise the relevant event. */
    protected failJob(job: Job, e: unknown): void
    {
        job.fail(e);
    }

    /** Calculate the backoff for the given job. */
    protected calculateBackoff(job: Job, options: WorkerOptions): number
    {
        const declared = (job as { backoff?: unknown; }).backoff;

        const value = typeIs(declared, 'function')
            ? ((declared as (self: Job) => unknown)(job) ?? options.backoff)
            : options.backoff;

        const steps = tostring(value ?? 0).split(',');

        const step = steps[job.attempts() - 1] ?? steps[steps.size() - 1];

        return tonumber(step) ?? 0;
    }

    /** Raise the before job has been popped event. */
    protected raiseBeforeJobPopEvent(connectionName: string, queue: string): void
    {
        this.events.dispatch(new JobPopping(connectionName, queue));
    }

    /** Raise the after job has been popped event. */
    protected raiseAfterJobPopEvent(connectionName: string, job: Job): void
    {
        this.events.dispatch(new JobPopped(connectionName, job));
    }

    /** Raise the before queue job event. */
    protected raiseBeforeJobEvent(connectionName: string, job: Job): void
    {
        this.events.dispatch(new JobProcessing(connectionName, job));
    }

    /** Raise the after queue job event. */
    protected raiseAfterJobEvent(connectionName: string, job: Job): void
    {
        this.events.dispatch(new JobProcessed(connectionName, job));
    }

    /** Raise the exception occurred queue job event. */
    protected raiseExceptionOccurredJobEvent(connectionName: string, job: Job, e: unknown): void
    {
        this.events.dispatch(new JobExceptionOccurred(connectionName, job, e));
    }

    /** Raise the worker starting event. */
    protected raiseWorkerStartingEvent(connectionName: string, queue: string, options: WorkerOptions): void
    {
        this.events.dispatch(new WorkerStarting(connectionName, queue, options));
    }

    /** Create an instance of MaxAttemptsExceededException. */
    protected maxAttemptsExceededException(job: Job): MaxAttemptsExceededException
    {
        return MaxAttemptsExceededException.forJob(job);
    }

    /** Sleep the script for a given number of seconds. */
    public sleep(seconds: number): void
    {
        task.wait(seconds);
    }

    /**
     * Determine if the memory limit has been exceeded.
     *
     * PHP measures one process against the limit; the closest figure here is
     * the whole server's, which is why the default limit is off.
     */
    public memoryExceeded(memoryLimit: number): boolean
    {
        return memoryLimit > 0 && Stats.GetTotalMemoryUsageMb() >= memoryLimit;
    }

    /** Stop listening and bail out of the script. */
    public stop(status = 0, options?: WorkerOptions, reason?: WorkerStopReason): number
    {
        this.events.dispatch(new WorkerStopping(status, options, reason));

        return status;
    }

    /** Tell the worker to leave the loop after the current job. */
    public shutdown(): void
    {
        this.shouldQuit = true;
    }

    /** Pause the worker without leaving the loop. */
    public pause(): void
    {
        this.paused = true;
    }

    /** Resume a paused worker. */
    public resume(): void
    {
        this.paused = false;
    }

    /** Get the job the worker is currently running. */
    public getCurrentJob(): Job | undefined
    {
        return this.currentJob;
    }

    /** Set the name of the worker. */
    public setName(name: string): this
    {
        this.name = name;

        return this;
    }
}
