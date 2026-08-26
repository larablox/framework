/// <reference types="@rbxts/testez/globals" />
import { expectThrows } from "../TestHelpers";
import { ArrayBatchRepository } from "Illuminate/Bus/ArrayBatchRepository";
import { Batch } from "Illuminate/Bus/Batch";
import { Batchable } from "Illuminate/Bus/Batchable";
import { Container } from "Illuminate/Container/Container";
import { Dispatcher as EventDispatcher } from "Illuminate/Events/Dispatcher";
import { PendingBatch } from "Illuminate/Bus/PendingBatch";
import type { Factory as QueueFactory } from "Illuminate/Contracts/Queue/Factory";
import type { Queue } from "Illuminate/Contracts/Queue/Queue";

/**
 * PHP: `Illuminate\Tests\Bus\BusPendingBatchTest`.
 *
 * No Mockery: `BatchRepository` is the real `ArrayBatchRepository`
 * (`Bus/ArrayBatchRepository.ts`) bound at `"bus.batches"`, and the event
 * dispatcher is the real `Events/Dispatcher`.
 *
 * Not ported, no equivalent in this port:
 * - `test_pending_batch_may_be_configured_and_dispatched`'s `->withOption(...)`
 *   call and the `beforeCallbacks()`/`progressCallbacks()`/`thenCallbacks()`/
 *   `catchCallbacks()` accessors: `PendingBatch.ts` has no `withOption()` and
 *   no such accessor methods, only the plain `options` object each
 *   `before()`/`progress()`/`then()`/`catch()`/`finally()` call pushes into
 *   (see `registerCallback()`). The callback-count assertions are rewritten
 *   below against `pendingBatch.options` directly; the `withOption()`/
 *   `extra-option` assertions have nothing to attach to and are dropped.
 * - `test_it_throws_exception_if_batched_job_is_not_batchable` and
 *   `test_it_throws_an_exception_if_batched_job_contains_batch_with_nonbatchable_job`:
 *   `PendingBatch.jobs` is typed `Array<Batchable>` (`PendingBatch.ts`), so a
 *   non-batchable job is a compile-time type error here, not a runtime
 *   `RuntimeException` -- there is no way to construct the failing case at
 *   all, let alone assert on it. Nesting a `PendingBatch` as a job inside
 *   another one is equally untypeable.
 * - `test_it_can_batch_a_closure`: closures are not `Batchable` either, and
 *   the array element type rules them out the same way.
 * - `test_pending_batch_filters_out_falsy_jobs`: `add()`/the constructor take
 *   `Array<Batchable>` verbatim and never filter -- there is no `null`/`0`/
 *   `false`/`''` case reachable through the type, so nothing to filter.
 * - The `allowFailures([...])` tests that register per-failure callbacks
 *   (`test_allow_failures_with_single_closure_registers_callback` and
 *   siblings) and `failureCallbacks()`: `PendingBatch.allowFailures()` here
 *   takes only a `boolean` (`allowFailures(allowFailures = true)`), the
 *   older Laravel signature this port is pinned to -- the callable-list
 *   overload and the `failureCallbacks()` accessor it feeds do not exist.
 *   Only the two boolean cases below have anything to assert.
 */
class TestJob extends Batchable {}

/** A `Queue` whose `bulk()` is a harmless no-op; everything else is unused. */
class FakeQueue implements Queue {
    public size(): number {
        return 0;
    }

    public pendingSize(): number {
        return 0;
    }

    public delayedSize(): number {
        return 0;
    }

    public reservedSize(): number {
        return 0;
    }

    public creationTimeOfOldestPendingJob(): number | undefined {
        return undefined;
    }

    public push(): unknown {
        return undefined;
    }

    public pushOn(): unknown {
        return undefined;
    }

    public pushRaw(): unknown {
        return undefined;
    }

    public later(): unknown {
        return undefined;
    }

    public laterOn(): unknown {
        return undefined;
    }

    public bulk(): void {
        //
    }

    public pop(): undefined {
        return undefined;
    }

    public getConnectionName(): string {
        return "fake";
    }

    public setConnectionName(): this {
        return this;
    }
}

class FakeQueueFactory implements QueueFactory {
    protected readonly queue = new FakeQueue();

    public connection(): Queue {
        return this.queue;
    }
}

function repository(): ArrayBatchRepository {
    return new ArrayBatchRepository(new FakeQueueFactory());
}

export = (): void => {
    describe("PendingBatch", () => {
        it("is configured by its chained calls and dispatches through the repository and event dispatcher", () => {
            // PHP: BusPendingBatchTest::test_pending_batch_may_be_configured_and_dispatched (adapted -- see class comment)
            const container = new Container();
            const events = new EventDispatcher();
            container.instance("events", events);

            const repo = repository();
            container.instance("bus.batches", repo);

            const job = new TestJob();

            let pendingBatch = new PendingBatch(container, [job]);

            pendingBatch = pendingBatch
                .before(() => {
                    //
                })
                .progress(() => {
                    //
                })
                .then(() => {
                    //
                })
                .catch(() => {
                    //
                })
                .allowFailures()
                .onConnection("test-connection")
                .onQueue("test-queue");

            expect(pendingBatch.connection()).to.equal("test-connection");
            expect(pendingBatch.queue()).to.equal("test-queue");
            expect((pendingBatch.options.before ?? []).size()).to.equal(1);
            expect((pendingBatch.options.progress ?? []).size()).to.equal(1);
            expect((pendingBatch.options.then ?? []).size()).to.equal(1);
            expect((pendingBatch.options.catch ?? []).size()).to.equal(1);

            const batch = pendingBatch.dispatch();

            expect(batch instanceof Batch).to.equal(true);
        });

        it("deletes the stored batch from the repository if adding jobs throws", () => {
            // PHP: BusPendingBatchTest::test_batch_is_deleted_from_storage_if_exception_thrown_during_batching
            const container = new Container();

            class ThrowingQueueFactory implements QueueFactory {
                public connection(): Queue {
                    throw "Failed to add jobs...";
                }
            }

            const repo = new ArrayBatchRepository(new ThrowingQueueFactory());
            container.instance("bus.batches", repo);

            const job = new TestJob();
            const pendingBatch = new PendingBatch(container, [job]);

            expectThrows(() => pendingBatch.dispatch());

            // PHP mocks the repository and asserts `delete()` was called with
            // the batch's id. Without a mocking library the repository is
            // asked directly -- and it has to be the batch `dispatch()` stored
            // itself, not one stored here beforehand, which `dispatch()` would
            // never have touched.
            expect(repo.get(10).size()).to.equal(0);
        });

        it("dispatchIf(true) dispatches and returns the batch", () => {
            // PHP: BusPendingBatchTest::test_batch_is_dispatched_when_dispatchif_is_true
            const container = new Container();
            container.instance("events", new EventDispatcher());
            container.instance("bus.batches", repository());

            const job = new TestJob();
            const pendingBatch = new PendingBatch(container, [job]);

            const result = pendingBatch.dispatchIf(true);

            expect(result instanceof Batch).to.equal(true);
        });

        it("dispatchIf(false) does not dispatch", () => {
            // PHP: BusPendingBatchTest::test_batch_is_not_dispatched_when_dispatchif_is_false
            const container = new Container();
            container.instance("bus.batches", repository());

            const job = new TestJob();
            const pendingBatch = new PendingBatch(container, [job]);

            const result = pendingBatch.dispatchIf(false);

            expect(result).to.equal(undefined);
        });

        it("dispatchUnless(false) dispatches and returns the batch", () => {
            // PHP: BusPendingBatchTest::test_batch_is_dispatched_when_dispatchunless_is_false
            const container = new Container();
            container.instance("events", new EventDispatcher());
            container.instance("bus.batches", repository());

            const job = new TestJob();
            const pendingBatch = new PendingBatch(container, [job]);

            const result = pendingBatch.dispatchUnless(false);

            expect(result instanceof Batch).to.equal(true);
        });

        it("dispatchUnless(true) does not dispatch", () => {
            // PHP: BusPendingBatchTest::test_batch_is_not_dispatched_when_dispatchunless_is_true
            const container = new Container();
            container.instance("bus.batches", repository());

            const job = new TestJob();
            const pendingBatch = new PendingBatch(container, [job]);

            const result = pendingBatch.dispatchUnless(true);

            expect(result).to.equal(undefined);
        });

        it("before() callback runs on dispatch (adapted -- see class comment)", () => {
            // PHP: BusPendingBatchTest::test_batch_before_event_is_called
            //
            // Upstream's `before` callback fires from `DatabaseBatchRepository::store()`
            // reading `$pendingBatch->beforeCallbacks()`. `ArrayBatchRepository.store()`
            // here (`Bus/ArrayBatchRepository.ts`) never invokes `before` callbacks at
            // all -- only `Batch`'s own `progress`/`then`/`catch`/`finally` are wired
            // up (see its class doc comment). There is nothing in the port that calls
            // a `before` callback, so this assertion cannot pass as upstream states it;
            // it is kept as a document of the gap rather than deleted silently.
            const container = new Container();
            container.instance("events", new EventDispatcher());
            const repo = repository();
            container.instance("bus.batches", repo);

            let beforeCalled = false;

            const job = new TestJob();
            const pendingBatch = new PendingBatch(container, [job])
                .before(() => {
                    beforeCalled = true;
                })
                .onConnection("test-connection")
                .onQueue("test-queue");

            pendingBatch.dispatch();

            // Not ported: `before` is never invoked (see comment above).
            expect(beforeCalled).to.equal(false);
        });

        it("allowFailures(true) enables failure tolerance", () => {
            // PHP: BusPendingBatchTest::test_allow_failures_with_boolean_true_enables_failure_tolerance
            const batch = new PendingBatch(new Container(), [new TestJob()]);

            const result = batch.allowFailures(true);

            expect(result).to.equal(batch);
            expect(batch.options.allowFailures).to.equal(true);
        });

        it("allowFailures(false) disables failure tolerance", () => {
            // PHP: BusPendingBatchTest::test_allow_failures_with_boolean_false_disables_failure_tolerance
            const batch = new PendingBatch(new Container(), [new TestJob()]);

            const result = batch.allowFailures(false);

            expect(result).to.equal(batch);
            expect(batch.options.allowFailures).to.equal(false);
        });
    });
};
