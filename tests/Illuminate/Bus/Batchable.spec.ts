/// <reference types="@rbxts/testez/globals" />
import { ArrayBatchRepository } from 'Illuminate/Bus/ArrayBatchRepository';
import { Batchable } from 'Illuminate/Bus/Batchable';
import { Container } from 'Illuminate/Container/Container';
import { PendingBatch } from 'Illuminate/Bus/PendingBatch';
import type { Factory as QueueFactory } from 'Illuminate/Contracts/Queue/Factory';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/**
 * PHP: `Illuminate\Tests\Bus\BusBatchableTest`.
 *
 * `test_with_fake_batch_sets_and_returns_fake`,
 * `test_batching_reflects_cancelled_state` and
 * `test_batching_returns_false_when_batch_is_finished` are not ported:
 * all three exercise `withFakeBatch()` / `BatchFake`
 * (`Illuminate\Support\Testing\Fakes\BatchFake`), a PHPUnit-only testing
 * double this port never introduced (`Batchable.ts`'s own doc comment: "a
 * testing helper with no test runner behind it"). `test_batching_reflects_cancelled_state`
 * is instead exercised below against a real `ArrayBatchRepository`, which is
 * the closest analogue available.
 */
class TestJob extends Batchable {}

/** A `Factory` that always hands back the same queue, itself unused here. */
class FakeQueueFactory implements QueueFactory {
    public connection(): Queue {
        throw 'not expected';
    }
}

export = (): void => {
    describe('Batchable', () => {
        it('withBatchId() returns the job and sets batchId; batch() resolves it through the container', () => {
            // PHP: BusBatchableTest::test_batch_may_be_retrieved
            const job = new TestJob();

            expect(job.withBatchId('test-batch-id')).to.equal(job);
            expect(job.batchId).to.equal('test-batch-id');

            const container = new Container();
            Container.setInstance(container);

            const repository = new ArrayBatchRepository(new FakeQueueFactory());
            const stored = repository.store(new PendingBatch(container, []));
            job.withBatchId(stored.id);

            container.instance('bus.batches', repository);

            expect(job.batch()?.id).to.equal(stored.id);

            Container.setInstance(undefined);
        });

        it('batching() reflects whether the batch has been cancelled', () => {
            // PHP: BusBatchableTest::test_batching_reflects_cancelled_state (adapted -- see class comment)
            const container = new Container();
            Container.setInstance(container);

            const repository = new ArrayBatchRepository(new FakeQueueFactory());
            container.instance('bus.batches', repository);

            const stored = repository.store(new PendingBatch(container, []));

            const job = new TestJob();
            job.withBatchId(stored.id);

            expect(job.batching()).to.equal(true);

            job.batch()?.cancel();

            expect(job.batching()).to.equal(false);

            Container.setInstance(undefined);
        });

        it('batching() is false once the batch has finished', () => {
            // PHP: BusBatchableTest::test_batching_returns_false_when_batch_is_finished (adapted -- see class comment)
            const container = new Container();
            Container.setInstance(container);

            const repository = new ArrayBatchRepository(new FakeQueueFactory());
            container.instance('bus.batches', repository);

            const stored = repository.store(new PendingBatch(container, []));
            repository.markAsFinished(stored.id);

            const job = new TestJob();
            job.withBatchId(stored.id);

            expect(job.batching()).to.equal(false);

            Container.setInstance(undefined);
        });
    });
};
