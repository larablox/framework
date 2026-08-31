/// <reference types="@rbxts/testez/globals" />
import { ArrayBatchRepository } from 'Illuminate/Bus/ArrayBatchRepository';
import { Batch } from 'Illuminate/Bus/Batch';
import { BatchCanceled } from 'Illuminate/Bus/Events/BatchCanceled';
import { BatchFinished } from 'Illuminate/Bus/Events/BatchFinished';
import { BatchStarted } from 'Illuminate/Bus/Events/BatchStarted';
import { Batchable } from 'Illuminate/Bus/Batchable';
import { Container } from 'Illuminate/Container/Container';
import { Dispatcher as EventDispatcher } from 'Illuminate/Events/Dispatcher';
import { PendingBatch } from 'Illuminate/Bus/PendingBatch';
import { RuntimeException } from 'Illuminate/Exception';
import type { Factory as QueueFactory } from 'Illuminate/Contracts/Queue/Factory';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/**
 * PHP: `Illuminate\Tests\Bus\BusBatchTest`.
 *
 * The `DatabaseBatchRepository`/`BatchFactory`/sqlite fixture upstream sets up
 * in `setUp()` has no analogue here: the repository under test is the real
 * `ArrayBatchRepository` (`Bus/ArrayBatchRepository.ts`), the same one
 * `BusServiceProvider` wires up, backed by an in-memory table instead of a
 * database. `$_SERVER['__*.count']`/`['__*.batch']` superglobals become local
 * mutable variables captured by the callbacks, as in `EventsDispatcher.spec.ts`.
 *
 * Not ported, no equivalent in this port -- see `agent_docs/laravel-parity.md`'s
 * "Батчи: счётчики в памяти, коллбэки замыканиями" and `Bus/PendingBatch.ts`'s
 * doc comment:
 * - `test_jobs_can_be_added_to_the_pending_batch_from_iterable`: `add()` takes
 *   `Array<Batchable>`, not a PHP generator/iterable.
 * - `test_pending_batch_filters_out_falsy_jobs`: the typed array admits no
 *   falsy element to filter.
 * - `test_failure_callbacks_execute_correctly`: exercises
 *   `PendingBatch::allowFailures([...closures...])`, the newer
 *   per-failure-callback overload; `allowFailures()` here only takes a
 *   `boolean`.
 * - `test_chain_can_be_added_to_batch`,
 *   `test_chained_jobs_in_batch_preserve_their_queue_when_batch_has_no_queue`,
 *   `test_chained_closure_after_multiple_batches_is_properly_dispatched`:
 *   a chain nested inside a batch job list (`[$chainHeadJob, $secondJob, ...]`
 *   as one batch entry) is `ChainedBatch`, explicitly not ported; the third
 *   test also needs `Queue::fake()` and the `Bus`/`Facade` machinery this
 *   suite does not set up.
 * - `test_options_serialization_on_postgres` /
 *   `test_options_unserialize_on_postgres`: exercise `DatabaseBatchRepository`
 *   against a `PostgresConnection` directly -- there is no database-backed
 *   batch repository in this port at all (`ArrayBatchRepository` is the only
 *   one), so nothing here reads or writes a `postgres`-shaped `options` column.
 * - `test_batch_state_can_be_inspected`'s `json_encode($batch)` assertion:
 *   `Batch` has no `toArray()`/`jsonSerialize()` (`Batch.ts`'s doc comment).
 *   The rest of that test is ported below by constructing fresh `Batch`
 *   instances with the desired readonly fields directly, since `Batch`'s
 *   constructor parameters are `public readonly` here and cannot be mutated
 *   in place the way PHP's public properties are in the original test.
 */
class TestJob extends Batchable
{}

/** A `Queue` that records every `bulk()` call it receives. */
class FakeQueue implements Queue
{
    public bulkCalls = new Array<[unknown, unknown, string | undefined]>();

    public size(): number
    {
        return 0;
    }

    public pendingSize(): number
    {
        return 0;
    }

    public delayedSize(): number
    {
        return 0;
    }

    public reservedSize(): number
    {
        return 0;
    }

    public creationTimeOfOldestPendingJob(): number | undefined
    {
        return undefined;
    }

    public push(): unknown
    {
        return undefined;
    }

    public pushOn(): unknown
    {
        return undefined;
    }

    public pushRaw(): unknown
    {
        return undefined;
    }

    public later(): unknown
    {
        return undefined;
    }

    public laterOn(): unknown
    {
        return undefined;
    }

    public bulk(jobs: unknown, data?: unknown, queue?: string): void
    {
        this.bulkCalls.push([
            jobs,
            data,
            queue,
        ]);
    }

    public pop(): undefined
    {
        return undefined;
    }

    public getConnectionName(): string
    {
        return 'fake';
    }

    public setConnectionName(): this
    {
        return this;
    }
}

/** A `Factory` that only ever hands out a connection named `"test-connection"`. */
class FakeQueueFactory implements QueueFactory
{
    public readonly queue = new FakeQueue();
    public connectionCalls = new Array<string | undefined>();

    public connection(name?: string): Queue
    {
        this.connectionCalls[this.connectionCalls.size()] = name;

        return this.queue;
    }
}

/** Builds the same batch every `createTestBatch()` helper in the PHP test built. */
function createTestBatch(
    container: Container,
    queueFactory: FakeQueueFactory,
    counters: {
        progress: number;
        then: number;
        catch: number;
        finally: number;
    },
    lastBatch: {
        progress?: Batch;
        then?: Batch;
        catch?: Batch;
        finally?: Batch;
    },
    lastException: { catch?: unknown; },
    allowFailures = false,
): Batch
{
    const repository = new ArrayBatchRepository(queueFactory);
    container.instance('bus.batches', repository);

    const pendingBatch = new PendingBatch(container, [])
        .progress((batch) => {
            lastBatch.progress = batch;
            counters.progress++;
        })
        .then((batch) => {
            lastBatch.then = batch;
            counters.then++;
        })
        .catch((batch, e) => {
            lastBatch.catch = batch;
            lastException.catch = e;
            counters.catch++;
        })
        .finally((batch) => {
            lastBatch.finally = batch;
            counters.finally++;
        })
        .allowFailures(allowFailures)
        .onConnection('test-connection')
        .onQueue('test-queue');

    return repository.store(pendingBatch);
}

export = (): void => {
    describe('Batch', () => {
        it('jobs are added to the batch (adapted -- see class comment)', () => {
            // PHP: BusBatchTest::test_jobs_can_be_added_to_the_batch
            const queueFactory = new FakeQueueFactory();
            const container = new Container();

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};

            const batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            const job = new TestJob();
            const secondJob = new TestJob();

            const added = batch.add([
                job,
                secondJob,
            ]);

            expect(queueFactory.connectionCalls[0]).to.equal('test-connection');
            expect(queueFactory.queue.bulkCalls.size()).to.equal(1);
            const [bulkJobs, , bulkQueue] = queueFactory.queue.bulkCalls[0];
            expect((bulkJobs as Array<unknown>).size()).to.equal(2);
            expect(bulkQueue).to.equal('test-queue');

            expect(added?.totalJobs).to.equal(2);
            expect(added?.pendingJobs).to.equal(2);
            expect(typeIs(job.batchId, 'string')).to.equal(true);
            expect(typeIs(secondJob.batchId, 'string')).to.equal(true);
            expect(typeIs(added?.createdAt, 'number')).to.equal(true);
        });

        it('jobs are added to a pending batch', () => {
            // PHP: BusBatchTest::test_jobs_can_be_added_to_pending_batch
            const batch = new PendingBatch(new Container(), []);
            expect(batch.jobs.size()).to.equal(0);

            const job = new TestJob();
            batch.add([job]);
            expect(batch.jobs.size()).to.equal(1);

            const secondJob = new TestJob();
            batch.add([secondJob]);
            expect(batch.jobs.size()).to.equal(2);
        });

        it('processedJobs() and progress() are computed from totalJobs and pendingJobs', () => {
            // PHP: BusBatchTest::test_processed_jobs_can_be_calculated
            const batch = new Batch(
                new FakeQueueFactory(),
                new ArrayBatchRepository(new FakeQueueFactory()),
                'test-id',
                'test-batch',
                10,
                4,
                0,
                [],
                {},
                0,
            );

            expect(batch.processedJobs()).to.equal(6);
            expect(batch.progress()).to.equal(60);
        });

        it('successful jobs are recorded and fire progress/then/finally callbacks', () => {
            // PHP: BusBatchTest::test_successful_jobs_can_be_recorded
            const queueFactory = new FakeQueueFactory();
            const container = new Container();

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};

            let batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            const job = new TestJob();
            const secondJob = new TestJob();
            batch = batch.add([
                job,
                secondJob,
            ]) as Batch;
            expect(batch.pendingJobs).to.equal(2);

            batch.recordSuccessfulJob('test-id');
            batch.recordSuccessfulJob('test-id');

            expect(lastBatch.finally instanceof Batch).to.equal(true);
            expect(lastBatch.progress instanceof Batch).to.equal(true);
            expect(lastBatch.then instanceof Batch).to.equal(true);

            batch = batch.fresh() as Batch;
            expect(batch.pendingJobs).to.equal(0);
            expect(batch.finished()).to.equal(true);
            expect(counters.finally).to.equal(1);
            expect(counters.progress).to.equal(2);
            expect(counters.then).to.equal(1);
        });

        it('BatchStarted and BatchFinished are dispatched once the batch finishes', () => {
            // PHP: BusBatchTest::test_batch_finished_event_is_dispatched
            const queueFactory = new FakeQueueFactory();
            const container = new Container();
            const events = new EventDispatcher();
            container.instance('events', events);
            Container.setInstance(container);

            const dispatched = new Array<object>();
            events.listen(BatchStarted, (event: BatchStarted) => {
                dispatched.push(event);
            });
            events.listen(BatchFinished, (event: BatchFinished) => {
                dispatched.push(event);
            });

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            let batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            const job = new TestJob();
            batch = batch.add([job]) as Batch;

            batch.recordSuccessfulJob('test-id');

            expect(dispatched.size()).to.equal(2);
            expect(dispatched[0] instanceof BatchStarted).to.equal(true);
            expect((dispatched[0] as BatchStarted).batch.id).to.equal(batch.id);
            expect(dispatched[1] instanceof BatchFinished).to.equal(true);
            expect((dispatched[1] as BatchFinished).batch.id).to.equal(batch.id);

            Container.setInstance(undefined);
        });

        it('BatchStarted fires once, on the very first job processed', () => {
            // PHP: BusBatchTest::test_batch_started_event_is_dispatched
            const queueFactory = new FakeQueueFactory();
            const container = new Container();
            const events = new EventDispatcher();
            container.instance('events', events);
            Container.setInstance(container);

            let startedCount = 0;
            let finishedCount = 0;
            events.listen(BatchStarted, () => {
                startedCount++;
            });
            events.listen(BatchFinished, () => {
                finishedCount++;
            });

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            let batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            const job = new TestJob();
            const secondJob = new TestJob();
            batch = batch.add([
                job,
                secondJob,
            ]) as Batch;

            batch.recordSuccessfulJob('test-id-1');
            batch.recordSuccessfulJob('test-id-2');

            expect(startedCount).to.equal(1);
            expect(finishedCount).to.equal(1);

            Container.setInstance(undefined);
        });

        it('BatchStarted fires when the first job fails, not just when one succeeds', () => {
            // PHP: BusBatchTest::test_batch_started_event_is_dispatched_when_first_job_fails
            const queueFactory = new FakeQueueFactory();
            const container = new Container();
            const events = new EventDispatcher();
            container.instance('events', events);
            Container.setInstance(container);

            let startedCount = 0;
            events.listen(BatchStarted, () => {
                startedCount++;
            });

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            let batch = createTestBatch(container, queueFactory, counters, lastBatch, {}, true);

            const job = new TestJob();
            const secondJob = new TestJob();
            batch = batch.add([
                job,
                secondJob,
            ]) as Batch;

            batch.recordFailedJob('test-id-1', new RuntimeException('Something went wrong.'));
            batch.recordFailedJob('test-id-2', new RuntimeException('Something else went wrong.'));

            expect(startedCount).to.equal(1);

            Container.setInstance(undefined);
        });

        it('failed jobs cancel the batch when failures are not allowed', () => {
            // PHP: BusBatchTest::test_failed_jobs_can_be_recorded_while_not_allowing_failures
            const queueFactory = new FakeQueueFactory();
            const container = new Container();

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            const lastException: { catch?: unknown; } = {};
            let batch = createTestBatch(container, queueFactory, counters, lastBatch, lastException, false);

            const job = new TestJob();
            const secondJob = new TestJob();
            batch = batch.add([
                job,
                secondJob,
            ]) as Batch;
            expect(batch.pendingJobs).to.equal(2);

            batch.recordFailedJob('test-id', new RuntimeException('Something went wrong.'));
            batch.recordFailedJob('test-id', new RuntimeException('Something else went wrong.'));

            expect(lastBatch.finally instanceof Batch).to.equal(true);
            expect(lastBatch.then).to.equal(undefined);

            batch = batch.fresh() as Batch;
            expect(batch.pendingJobs).to.equal(2);
            expect(batch.failedJobs).to.equal(2);
            expect(batch.finished()).to.equal(true);
            expect(batch.cancelled()).to.equal(true);
            expect(counters.finally).to.equal(1);
            expect(counters.progress).to.equal(0);
            expect(counters.catch).to.equal(1);
            expect((lastException.catch as RuntimeException).getMessage()).to.equal('Something went wrong.');
        });

        it('failed jobs do not cancel the batch when failures are allowed', () => {
            // PHP: BusBatchTest::test_failed_jobs_can_be_recorded_while_allowing_failures
            const queueFactory = new FakeQueueFactory();
            const container = new Container();

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            const lastException: { catch?: unknown; } = {};
            let batch = createTestBatch(container, queueFactory, counters, lastBatch, lastException, true);

            const job = new TestJob();
            const secondJob = new TestJob();
            batch = batch.add([
                job,
                secondJob,
            ]) as Batch;
            expect(batch.pendingJobs).to.equal(2);

            batch.recordFailedJob('test-id', new RuntimeException('Something went wrong.'));
            batch.recordFailedJob('test-id', new RuntimeException('Something else went wrong.'));

            // While allowing failures this batch never actually completes...
            expect(lastBatch.then).to.equal(undefined);

            batch = batch.fresh() as Batch;
            expect(batch.pendingJobs).to.equal(2);
            expect(batch.failedJobs).to.equal(2);
            expect(batch.finished()).to.equal(false);
            expect(batch.cancelled()).to.equal(false);
            expect(counters.catch).to.equal(1);
            expect(counters.progress).to.equal(2);
            expect((lastException.catch as RuntimeException).getMessage()).to.equal('Something went wrong.');
        });

        it('cancel() marks the batch cancelled', () => {
            // PHP: BusBatchTest::test_batch_can_be_cancelled
            const queueFactory = new FakeQueueFactory();
            const container = new Container();

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            let batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            batch.cancel();

            batch = batch.fresh() as Batch;
            expect(batch.cancelled()).to.equal(true);
        });

        it('cancel() dispatches BatchCanceled carrying the batch id and exception', () => {
            // PHP: BusBatchTest::test_batch_cancelled_event_is_dispatched
            const queueFactory = new FakeQueueFactory();
            const container = new Container();
            const events = new EventDispatcher();
            container.instance('events', events);
            Container.setInstance(container);

            let received: BatchCanceled | undefined;
            events.listen(BatchCanceled, (event: BatchCanceled) => {
                received = event;
            });

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            const batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            const exception = new RuntimeException('Something went wrong.');
            batch.cancel(exception);

            expect(received?.batch.id).to.equal(batch.id);
            expect(received?.exception).to.equal(exception);

            Container.setInstance(undefined);
        });

        it('delete() removes the batch from the repository', () => {
            // PHP: BusBatchTest::test_batch_can_be_deleted
            const queueFactory = new FakeQueueFactory();
            const container = new Container();

            const counters = { progress: 0, then: 0, catch: 0, finally: 0 };
            const lastBatch: {
                progress?: Batch;
                then?: Batch;
                catch?: Batch;
                finally?: Batch;
            } = {};
            const batch = createTestBatch(container, queueFactory, counters, lastBatch, {});

            batch.delete();

            expect(batch.fresh()).to.equal(undefined);
        });

        it('finished()/hasProgressCallbacks()/hasThenCallbacks()/allowsFailures()/hasFailures()/hasCatchCallbacks()/cancelled() reflect batch state (adapted -- see class comment)', () => {
            // PHP: BusBatchTest::test_batch_state_can_be_inspected (adapted -- see class comment)
            const repository = new ArrayBatchRepository(new FakeQueueFactory());

            let batch = new Batch(new FakeQueueFactory(), repository, 'test-id', 'test-batch', 0, 0, 0, [], {}, 0);
            expect(batch.finished()).to.equal(false);
            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                {},
                0,
                undefined,
                100,
            );
            expect(batch.finished()).to.equal(true);

            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { progress: [] },
                0,
            );
            expect(batch.hasProgressCallbacks()).to.equal(false);
            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { progress: [() => undefined] },
                0,
            );
            expect(batch.hasProgressCallbacks()).to.equal(true);

            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { then: [] },
                0,
            );
            expect(batch.hasThenCallbacks()).to.equal(false);
            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { then: [() => undefined] },
                0,
            );
            expect(batch.hasThenCallbacks()).to.equal(true);

            batch = new Batch(new FakeQueueFactory(), repository, 'test-id', 'test-batch', 0, 0, 0, [], {}, 0);
            expect(batch.allowsFailures()).to.equal(false);
            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { allowFailures: true },
                0,
            );
            expect(batch.allowsFailures()).to.equal(true);

            batch = new Batch(new FakeQueueFactory(), repository, 'test-id', 'test-batch', 0, 0, 0, [], {}, 0);
            expect(batch.hasFailures()).to.equal(false);
            batch = new Batch(new FakeQueueFactory(), repository, 'test-id', 'test-batch', 0, 0, 1, [], {}, 0);
            expect(batch.hasFailures()).to.equal(true);

            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { catch: [] },
                0,
            );
            expect(batch.hasCatchCallbacks()).to.equal(false);
            batch = new Batch(
                new FakeQueueFactory(),
                repository,
                'test-id',
                'test-batch',
                0,
                0,
                0,
                [],
                { catch: [() => undefined] },
                0,
            );
            expect(batch.hasCatchCallbacks()).to.equal(true);

            batch = new Batch(new FakeQueueFactory(), repository, 'test-id', 'test-batch', 0, 0, 0, [], {}, 0);
            expect(batch.cancelled()).to.equal(false);
            batch = new Batch(new FakeQueueFactory(), repository, 'test-id', 'test-batch', 0, 0, 0, [], {}, 0, 100);
            expect(batch.cancelled()).to.equal(true);
        });
    });
};
