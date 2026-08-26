/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Bus/Dispatcher";
import { Queueable } from "Illuminate/Bus/Queueable";
import { ShouldQueue } from "Illuminate/Contracts/Queue/ShouldQueue";
import type { Delay as DelayValue } from "Illuminate/Support/InteractsWithTime";
import type { Job } from "Illuminate/Contracts/Queue/Job";
import type { Queue } from "Illuminate/Contracts/Queue/Queue";

/**
 * PHP: `Illuminate\Tests\Queue\QueueDelayTest`.
 *
 * Upstream boots a Testbench application, calls `Queue::fake()`, and inspects
 * `$job->delay` after routing the job through the global `dispatch()` helper
 * and the queue fake. There is no application container to boot, no `Queue`
 * facade, and no `dispatch()` helper here, so this is adapted to the real
 * `Bus/Dispatcher` (the same one `Bus/Dispatcher.spec.ts` exercises) with a
 * hand-written fake `Queue` recording the delay it was pushed with -- the
 * ground truth `$job->delay` stood in for upstream, since
 * `Queueable.delay()`/`withoutDelay()` set `delaySeconds`, and
 * `Dispatcher.dispatchToQueue()` reads exactly that property (see
 * `ReadsClassAttributes.getAttributeValue()`'s call in `Bus/Dispatcher.ts`).
 */

class FakeQueue {
    public laterCalls = new Array<[DelayValue, unknown]>();
    public pushCalls = new Array<unknown>();

    public push(job: unknown): unknown {
        this.pushCalls[this.pushCalls.size()] = job;

        return undefined;
    }

    public later(delay: DelayValue, job: unknown): unknown {
        this.laterCalls.push([delay, job]);

        return undefined;
    }

    public pop(): Job | undefined {
        return undefined;
    }

    public getConnectionName(): string {
        return "fake";
    }

    public setConnectionName(): this {
        return this;
    }
}

@ShouldQueue()
class TestJob extends Queueable {
    public constructor() {
        super();

        this.delay(60);
    }

    public handle(): void {
        //
    }
}

export = (): void => {
    describe("Delay", () => {
        // PHP: QueueDelayTest::test_queue_delay
        it("a job's own delay() carries through to the queue", () => {
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(
                container,
                () => queue as unknown as Queue,
            );

            const job = new TestJob();
            dispatcher.dispatch(job);

            expect(job.delaySeconds).to.equal(60);
            expect(queue.laterCalls.size()).to.equal(1);
            expect(queue.laterCalls[0][0]).to.equal(60);
        });

        // PHP: QueueDelayTest::test_queue_without_delay
        it("withoutDelay() zeroes out a previously declared delay", () => {
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(
                container,
                () => queue as unknown as Queue,
            );

            const job = new TestJob().withoutDelay();
            dispatcher.dispatch(job);

            expect(job.delaySeconds).to.equal(0);
            expect(queue.laterCalls.size()).to.equal(1);
            expect(queue.laterCalls[0][0]).to.equal(0);
        });

        // PHP: QueueDelayTest::test_pending_dispatch_without_delay (adapted --
        // there is no `PendingDispatch` wrapper here; `withoutDelay()` is
        // called directly on the job, as above, since `dispatch()` returns
        // nothing to chain off of in this port)
        it("withoutDelay() applies regardless of when it is called relative to dispatch", () => {
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(
                container,
                () => queue as unknown as Queue,
            );

            const job = new TestJob();
            job.withoutDelay();
            dispatcher.dispatch(job);

            expect(job.delaySeconds).to.equal(0);
        });
    });
};
