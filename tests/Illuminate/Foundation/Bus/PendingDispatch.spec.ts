/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { PendingDispatch } from "Illuminate/Foundation/Bus/PendingDispatch";
import { Queueable } from "Illuminate/Bus/Queueable";

/**
 * PHP: `Illuminate\Tests\Bus\BusPendingDispatchTest`.
 *
 * Upstream's `PendingDispatchWithoutDestructor` overrides `__destruct()` so
 * that configuring the pending dispatch inside a test never actually sends
 * the job -- `PendingDispatch::__destruct()` is what fires it there. This
 * port replaces the destructor with `task.defer(() => this.send())`
 * (`Foundation/Bus/PendingDispatch.ts`'s doc comment), and the same fixture
 * is needed for the same reason: returning from the `it()` body does not
 * escape a deferred callback, it only outruns it. The send fires a moment
 * later, hands `FakeJob` to the real bus, and raises inside a thread no test
 * is watching -- the suite stays green and the console fills with
 * `Method [__invoke] does not exist on [FakeJob]`.
 *
 * `FakeJob` stands in for the `Mockery`-mocked `stdClass` job: it extends the
 * real `Queueable` (`Bus/Queueable.ts`, the class every job in this port
 * ultimately extends) and records each call it cares about instead of
 * setting a Mockery expectation.
 *
 * Not ported, no equivalent in this port:
 * - `testAfterResponse`: `afterResponse()` is not ported at all (no response
 *   to come after -- see `PendingDispatch.ts`'s doc comment and
 *   `agent_docs/laravel-parity.md`).
 * - `testDynamicallyProxyMethods`: relies on PHP's `__call()` magic method
 *   forwarding an unknown method call (`appendToChain()`) straight through to
 *   the underlying job. There is no `__call` in Luau and `PendingDispatch.ts`
 *   declares no such forwarding -- only the handful of methods it explicitly
 *   wraps exist on it.
 * - `testAfterCommit` / `testBeforeCommit`: `Queueable` has `afterCommitting()`/
 *   `beforeCommit()` (renamed from PHP's `afterCommit()`/`beforeCommit()`, see
 *   `Queueable.ts`), but `PendingDispatch` never wraps either one -- there is
 *   no `pendingDispatch.afterCommit()`/`.beforeCommit()` to call.
 * - `testWhenMethodOfConditionableTraitWithTrue/False` and
 *   `testUnlessMethodOfConditionableTraitWithTrue/False`: `PendingDispatch`
 *   does not mix in `Conditionable` (`Support/Traits/Conditionable.ts`) --
 *   there is no `when()`/`unless()` on it to call.
 */
class FakeJob extends Queueable {
    public onConnectionCalls = new Array<string | undefined>();
    public onQueueCalls = new Array<string | undefined>();
    public allOnConnectionCalls = new Array<string | undefined>();
    public allOnQueueCalls = new Array<string | undefined>();
    public delayCalls = new Array<unknown>();
    public withoutDelayCalls = 0;
    public chainCalls = new Array<Array<object>>();

    public onConnection(connection?: string): this {
        this.onConnectionCalls[this.onConnectionCalls.size()] = connection;

        return super.onConnection(connection);
    }

    public onQueue(queue?: string): this {
        this.onQueueCalls[this.onQueueCalls.size()] = queue;

        return super.onQueue(queue);
    }

    public allOnConnection(connection?: string): this {
        this.allOnConnectionCalls[this.allOnConnectionCalls.size()] =
            connection;

        return super.allOnConnection(connection);
    }

    public allOnQueue(queue?: string): this {
        this.allOnQueueCalls[this.allOnQueueCalls.size()] = queue;

        return super.allOnQueue(queue);
    }

    public delay(delay?: unknown): this {
        this.delayCalls[this.delayCalls.size()] = delay;

        return super.delay(delay as never);
    }

    public withoutDelay(): this {
        this.withoutDelayCalls++;

        return super.withoutDelay();
    }

    public chain(chain: Array<object>): this {
        this.chainCalls.push(chain);

        return super.chain(chain);
    }
}

/** PHP: `PendingDispatchWithoutDestructor` -- configured, never sent. */
class PendingDispatchWithoutSend extends PendingDispatch {
    public send(): unknown {
        return undefined;
    }
}

export = (): void => {
    describe("PendingDispatch", () => {
        it("onConnection() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testOnConnection
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            pendingDispatch.onConnection("test-connection");

            expectDeepEqual(job.onConnectionCalls, ["test-connection"]);
        });

        it("onQueue() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testOnQueue
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            pendingDispatch.onQueue("test-queue");

            expectDeepEqual(job.onQueueCalls, ["test-queue"]);
        });

        it("allOnConnection() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testAllOnConnection
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            pendingDispatch.allOnConnection("test-connection");

            expectDeepEqual(job.allOnConnectionCalls, ["test-connection"]);
        });

        it("allOnQueue() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testAllOnQueue
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            pendingDispatch.allOnQueue("test-queue");

            expectDeepEqual(job.allOnQueueCalls, ["test-queue"]);
        });

        it("delay() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testDelay
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            pendingDispatch.delay(60);

            expectDeepEqual(job.delayCalls, [60]);
        });

        it("withoutDelay() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testWithoutDelay
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            pendingDispatch.withoutDelay();

            expect(job.withoutDelayCalls).to.equal(1);
        });

        it("chain() forwards to the job", () => {
            // PHP: BusPendingDispatchTest::testChain
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            const chain = [{}];
            pendingDispatch.chain(chain);

            expect(job.chainCalls.size()).to.equal(1);
            expect(job.chainCalls[0]).to.equal(chain);
        });

        it("getJob() returns the underlying job instance", () => {
            // PHP: BusPendingDispatchTest::testGetJob
            const job = new FakeJob();
            const pendingDispatch = new PendingDispatchWithoutSend(job);

            expect(pendingDispatch.getJob()).to.equal(job);
        });
    });
};
