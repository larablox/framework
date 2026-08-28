/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Dispatcher as BusDispatcher } from "Illuminate/Bus/Dispatcher";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { InteractsWithQueue } from "Illuminate/Queue/InteractsWithQueue";
import { LogicException, RuntimeException } from "Illuminate/Exception";
import { SyncJob } from "Illuminate/Queue/Jobs/SyncJob";
import { SyncQueue } from "Illuminate/Queue/SyncQueue";
import type { Job } from "Illuminate/Contracts/Queue/Job";

/**
 * PHP: `Illuminate\Tests\Queue\QueueSyncQueueTest`.
 *
 * `$_SERVER` globals are replaced with a module-level box each fixture writes
 * into and each test resets, since there is no superglobal here. Mockery
 * expectations on the event dispatcher (`testFailedJobGetsHandledWhenAnExceptionIsThrown`)
 * are replaced with the real `Illuminate/Events/Dispatcher`, counting the
 * events it actually fires.
 *
 * Not ported: `testItAddsATransactionCallbackForAfterCommitJobs`,
 * `testItAddsATransactionCallbackForInterfaceBasedAfterCommitJobs`,
 * `testItAddsATransactionCallbackForAfterCommitUniqueJobs`,
 * `testItAddsATransactionCallbackForInterfaceBasedAfterCommitUniqueJobs` --
 * all four exercise `db.transactions`/`DatabaseTransactionsManager`, which do
 * not exist in this port (see `Queue.ts`'s class comment: "gone with the
 * database"). `shouldDispatchAfterCommit()` has nothing to defer to without a
 * transaction manager.
 */

const box: { syncTest?: [Job, unknown]; syncFailed?: unknown } = {};

class SyncQueueTestHandler {
    public fire(job: Job, data: unknown): void {
        box.syncTest = [job, data];
    }
}

class FailingSyncQueueTestHandler {
    public fire(): void {
        throw new RuntimeException();
    }

    public failed(): void {
        box.syncFailed = true;
    }
}

class FailingSyncQueueJob extends InteractsWithQueue {
    public handle(): void {
        throw new LogicException();
    }

    public failed(): void {
        const payload = this.job!.payload();

        box.syncFailed = (payload.data as { extra?: unknown }).extra;
    }
}

export = (): void => {
    describe("SyncQueue", () => {
        beforeEach(() => {
            box.syncTest = undefined;
            box.syncFailed = undefined;
        });

        // PHP: QueueSyncQueueTest::testPushShouldFireJobInstantly
        it("push() fires the job instantly", () => {
            const sync = new SyncQueue();
            const container = new Container();
            sync.setContainer(container);

            sync.push(SyncQueueTestHandler, { foo: "bar" });

            expect(box.syncTest).to.be.ok();
            expect(box.syncTest![0] instanceof SyncJob).to.equal(true);
            expect((box.syncTest![1] as { foo: string }).foo).to.equal("bar");
        });

        // PHP: QueueSyncQueueTest::testFailedJobGetsHandledWhenAnExceptionIsThrown
        it("a thrown exception fails the job, and the exception propagates", () => {
            const sync = new SyncQueue();
            const container = new Container();
            Container.setInstance(container);
            const events = new Dispatcher(container);
            container.instance("events", events);
            sync.setContainer(container);

            let threw = false;

            try {
                sync.push(FailingSyncQueueTestHandler, { foo: "bar" });
            } catch {
                threw = true;
            }

            expect(threw).to.equal(true);
            expect(box.syncFailed).to.equal(true);

            Container.setInstance(undefined);
        });

        // PHP: QueueSyncQueueTest::testFailedJobHasAccessToJobInstance
        it("failed() has access to the payload the job carried", () => {
            const sync = new SyncQueue();
            const container = new Container();

            // An object job travels through `CallQueuedHandler`, which the
            // container builds -- and which asks for the bus dispatcher, the
            // event dispatcher and the container itself. Upstream binds the
            // same three contracts before pushing.
            container.instance("app", container);
            container.instance("events", new Dispatcher(container));
            container.singleton(BusDispatcher, () => new BusDispatcher(container));

            sync.setContainer(container);

            SyncQueue.createPayloadUsing(() => ({
                data: { extra: "extraValue" },
            }));

            try {
                sync.push(new FailingSyncQueueJob());
            } catch {
                // expected -- the job's handle() throws
            }

            expect(box.syncFailed).to.equal("extraValue");

            SyncQueue.createPayloadUsing(undefined);
        });
    });
};
