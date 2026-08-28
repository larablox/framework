/// <reference types="@rbxts/testez/globals" />
import { RuntimeException } from "Illuminate/Exception";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { JobPopped } from "Illuminate/Queue/Events/JobPopped";
import { JobPopping } from "Illuminate/Queue/Events/JobPopping";
import { JobProcessed } from "Illuminate/Queue/Events/JobProcessed";
import { JobProcessing } from "Illuminate/Queue/Events/JobProcessing";
import { WorkerOptions } from "Illuminate/Queue/WorkerOptions";
import { WorkerStopReason } from "Illuminate/Queue/WorkerStopReason";
import { WorkerStopping } from "Illuminate/Queue/Events/WorkerStopping";
import { Worker } from "Illuminate/Queue/Worker";
import type { Abstract } from "Illuminate/Container/Types";
import type { Factory } from "Illuminate/Contracts/Queue/Factory";
import type { Job, JobHandler, JobPayload } from "Illuminate/Contracts/Queue/Job";
import type { Queue } from "Illuminate/Contracts/Queue/Queue";

/**
 * PHP: `Illuminate\Tests\Queue\QueueWorkerTest`.
 *
 * Upstream mocks `Container`/`Dispatcher`/`ExceptionHandler` with Mockery
 * spies and overrides `currentTime()`/`memoryExceeded()` on a `WorkerFake`
 * subclass. Neither seam exists here -- `Worker.ts` reads `os.clock()`/
 * `InteractsWithTime.currentTime()` directly (see `ArrayStore.spec.ts`'s
 * class comment on the same gap) and `memoryExceeded()` reads
 * `Stats.GetTotalMemoryUsageMb()`, a real Roblox service -- so time-dependent
 * cases (`testWorkerStopsWhenQueueIsEmptyForConfiguredSeconds`,
 * `testWorkerResetsQueueEmptyTimerAfterProcessingJob`) and the
 * memory-exceeded daemon case (`testWorkerStopsWhenMemoryExceeded`) are not
 * ported; `memoryExceeded()`'s own threshold logic is still exercised
 * directly below, the way `testWorkerMemoryExceededWhenMemoryIsZero`/
 * `Negative`/`GreaterThanZero` do. `WorkerFakeJob`/`WorkerFakeConnection`
 * become `FakeJob`/`FakeConnection` below: hand-written fakes recording what
 * they were called with, the same shape as `Bus/Dispatcher.spec.ts`'s
 * `FakeQueue`. The real `Illuminate/Events/Dispatcher` replaces the Mockery
 * spy, so assertions below count events it actually dispatched.
 *
 * Not ported beyond the two gaps above: `notifyJobOfSignal()`/`Interruptible`
 * (no OS signals, see `Worker.ts`'s class comment), `daemonShouldRun()`
 * maintenance-mode overrides (no maintenance mode in this port), and
 * `BrokenQueueConnection`/exception-handler-report cases that assert against
 * a mocked `ExceptionHandler` -- `Worker`'s constructor takes a plain
 * `ExceptionReporter` callback here (see its class comment), exercised below
 * by asserting the callback itself was invoked.
 */

function fakePayload(): JobPayload {
    return {} as unknown as JobPayload;
}

class FakeJob implements Job {
    public fired = false;
    public deletedFlag = false;
    public releasedFlag = false;
    public failedFlag = false;
    public attemptsCount = 1;
    public maxTriesValue?: number;
    public retryUntilValue?: number;

    public constructor(private readonly callback?: () => void) {}

    public getJobId(): string {
        return "";
    }

    public fire(): void {
        this.fired = true;
        this.callback?.();
    }

    public payload(): JobPayload {
        return fakePayload();
    }

    public getRawBody(): JobPayload {
        return fakePayload();
    }

    public uuid(): string | undefined {
        return "fake-uuid";
    }

    public attempts(): number {
        return this.attemptsCount;
    }

    public delete(): void {
        this.deletedFlag = true;
    }

    public isDeleted(): boolean {
        return this.deletedFlag;
    }

    public release(): void {
        this.releasedFlag = true;
    }

    public isReleased(): boolean {
        return this.releasedFlag;
    }

    public isDeletedOrReleased(): boolean {
        return this.deletedFlag || this.releasedFlag;
    }

    public hasFailed(): boolean {
        return this.failedFlag;
    }

    public markAsFailed(): void {
        this.failedFlag = true;
    }

    public fail(): void {
        this.markAsFailed();
        this.deletedFlag = true;
    }

    public maxTries(): number | undefined {
        return this.maxTriesValue;
    }

    public maxExceptions(): number | undefined {
        return undefined;
    }

    public timeout(): number | undefined {
        return undefined;
    }

    public retryUntil(): number | undefined {
        return this.retryUntilValue;
    }

    public getName(): JobHandler {
        return "fake" as unknown as JobHandler;
    }

    public resolveName(): string {
        return "FakeJob";
    }

    public resolveQueuedJobClass(): Abstract {
        return "FakeJob" as unknown as Abstract;
    }

    public getConnectionName(): string {
        return "default";
    }

    public getQueue(): string {
        return "default";
    }
}

class FakeConnection implements Partial<Queue> {
    public constructor(
        private readonly connectionName: string,
        private readonly jobs: Record<string, Array<Job>>,
    ) {}

    public pop(queue?: string): Job | undefined {
        const list = this.jobs[queue ?? "default"];

        return list?.shift();
    }

    public getConnectionName(): string {
        return this.connectionName;
    }
}

class FakeManager implements Factory {
    public constructor(private readonly connectionInstance: Queue) {}

    public connection(): Queue {
        return this.connectionInstance;
    }
}

function getWorker(jobs: Record<string, Array<Job>>): [Worker, Dispatcher, Array<unknown>] {
    const events = new Dispatcher();
    const reported = new Array<unknown>();
    const connection = new FakeConnection("default", jobs);
    const manager = new FakeManager(connection as unknown as Queue);

    const worker = new Worker(manager, events, (e) => (reported[reported.size()] = e));

    return [worker, events, reported];
}

export = (): void => {
    describe("Worker", () => {
        // PHP: QueueWorkerTest::testJobCanBeFired
        it("runNextJob() fires the next job and dispatches its lifecycle events", () => {
            const job = new FakeJob();
            const [worker, events] = getWorker({ queue: [job] });

            let popping = 0;
            let popped = 0;
            let processing = 0;
            let processed = 0;
            events.listen(JobPopping, () => {
                popping += 1;
            });
            events.listen(JobPopped, () => {
                popped += 1;
            });
            events.listen(JobProcessing, () => {
                processing += 1;
            });
            events.listen(JobProcessed, () => {
                processed += 1;
            });

            worker.runNextJob("default", "queue", new WorkerOptions());

            expect(job.fired).to.equal(true);
            expect(popping).to.equal(1);
            expect(popped).to.equal(1);
            expect(processing).to.equal(1);
            expect(processed).to.equal(1);
        });

        // PHP: QueueWorkerTest::testJobPoppingEvent
        it("the JobPopping event carries the connection and queue names", () => {
            const job = new FakeJob();
            const [worker, events] = getWorker({ queue: [job] });

            let seen: JobPopping | undefined;
            events.listen(JobPopping, (event) => {
                seen = event as JobPopping;
            });

            worker.runNextJob("default", "queue", new WorkerOptions());

            expect(seen).to.be.ok();
            expect(seen!.connectionName).to.equal("default");
            expect(seen!.queue).to.equal("queue");
        });

        // PHP: QueueWorkerTest::testWorkerCanWorkUntilQueueIsEmpty
        it("daemon() with stopWhenEmpty runs until the queue is empty, then stops cleanly", () => {
            const first = new FakeJob();
            const second = new FakeJob();
            const [worker] = getWorker({ queue: [first, second] });

            const options = new WorkerOptions();
            options.stopWhenEmpty = true;

            const status = worker.daemon("default", "queue", options);

            expect(second.fired).to.equal(true);
            expect(status).to.equal(Worker.EXIT_SUCCESS);
        });

        // PHP: QueueWorkerTest::testJobCanBeFiredBasedOnPriority
        it("runNextJob() honours a comma-separated priority list of queues", () => {
            const highJob = new FakeJob();
            const secondHighJob = new FakeJob();
            const lowJob = new FakeJob();
            const [worker] = getWorker({
                high: [highJob, secondHighJob],
                low: [lowJob],
            });

            worker.runNextJob("default", "high,low", new WorkerOptions());

            expect(highJob.fired).to.equal(true);
            expect(secondHighJob.fired).to.equal(false);
            expect(lowJob.fired).to.equal(false);

            worker.runNextJob("default", "high,low", new WorkerOptions());

            expect(secondHighJob.fired).to.equal(true);
            expect(lowJob.fired).to.equal(false);
        });

        // PHP: QueueWorkerTest::testWorkerMemoryExceededWhenMemoryIsZero /
        // testWorkerMemoryExceededWhenMemoryGreaterThanZero /
        // testWorkerMemoryExceededWhenMemoryIsNegative
        it("memoryExceeded() is off at zero, and on above it", () => {
            const [worker] = getWorker({});

            expect(worker.memoryExceeded(0)).to.equal(false);
            expect(worker.memoryExceeded(-1)).to.equal(false);
            // A limit above zero is real Roblox server memory (`Stats`), which
            // is comfortably above any small positive threshold in practice.
            expect(worker.memoryExceeded(1)).to.equal(true);
        });

        // Not directly in the PHP suite (the daemon max-jobs case is spread
        // across several upstream tests) -- exercises `stopWhenNecessary()`'s
        // `maxJobs` branch and the resulting `WorkerStopping` event's reason.
        it("daemon() stops once maxJobs is reached, with the right stop reason", () => {
            const job = new FakeJob();
            const [worker, events] = getWorker({ queue: [job] });

            let reason: WorkerStopReason | undefined;
            events.listen(WorkerStopping, (event) => {
                reason = (event as WorkerStopping).reason;
            });

            const options = new WorkerOptions();
            options.maxJobs = 1;

            const status = worker.daemon("default", "queue", options);

            expect(status).to.equal(Worker.EXIT_SUCCESS);
            expect(reason).to.equal(WorkerStopReason.MaxJobsExceeded);
        });

        // PHP: no direct equivalent -- exercises `markJobAsFailedIfAlreadyExceedsMaxAttempts()`,
        // the guard `process()` runs before firing a job at all. Routed through
        // `runNextJob()`, since `process()`'s own failure path rethrows and
        // `runJob()` is what normally catches that (see `Worker.ts`'s `runJob()`).
        it("a job that has exceeded its max tries fails outright, without firing", () => {
            const job = new FakeJob();
            job.maxTriesValue = 1;
            job.attemptsCount = 2;
            const [worker] = getWorker({ queue: [job] });

            worker.runNextJob("default", "queue", new WorkerOptions());

            expect(job.fired).to.equal(false);
            expect(job.hasFailed()).to.equal(true);
        });

        // PHP: no direct equivalent -- exercises `handleJobException()`
        // releasing a job that threw and was not itself deleted/released/failed.
        it("a job that throws is released, when it has attempts left", () => {
            let reported: unknown;
            const events = new Dispatcher();
            // An exception object, not a bare string: Luau prefixes a string
            // error with the position it was raised at, and every rethrow on
            // the way out prefixes it again -- so the value the reporter sees
            // would never compare equal to what was thrown.
            const thrown = new RuntimeException("boom");
            const job = new FakeJob(() => {
                throw thrown;
            });
            job.maxTriesValue = 5;
            const connection = new FakeConnection("default", { queue: [job] });
            const manager = new FakeManager(connection as unknown as Queue);
            const worker = new Worker(manager, events, (e) => {
                reported = e;
            });

            worker.runNextJob("default", "queue", new WorkerOptions());

            expect(reported).to.equal(thrown);
            expect(job.isReleased()).to.equal(true);
            expect(job.hasFailed()).to.equal(false);
        });
    });
};
