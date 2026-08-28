/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';
import { MemoryJob } from 'Illuminate/Queue/Jobs/MemoryJob';
import { MemoryQueue } from 'Illuminate/Queue/MemoryQueue';

/**
 * PHP: `Illuminate\Tests\Queue\QueueDatabaseQueueUnitTest`, ported against
 * `MemoryQueue` (`DatabaseQueue`'s table held in memory instead of behind a
 * mocked `Connection`/query builder -- see `agent_docs/laravel-parity.md`).
 *
 * Upstream mocks `Connection::table()` and asserts the exact array
 * `insertGetId`/`insert` were called with, built from a JSON-encoded payload
 * string; there is neither a query builder nor a JSON step here (the payload
 * is a live table, see `Queue.ts`'s class comment), so every case below
 * pushes onto a real `MemoryQueue` and reads the row back out of
 * `pendingJobs()`/`allPendingJobs()`/etc. instead of inspecting a mocked call.
 * `Str::createUuidsUsing()`/`Carbon::setTestNow()` (time/uuid freezing) have
 * no seam here either -- see `ArrayStore.spec.ts`'s class comment on the same
 * gap -- so uuid and timestamp assertions below check shape (a non-empty
 * string, a number) rather than an exact frozen value.
 *
 * `InspectedJob` (`$jobs->first()->name`, `->uuid`, `->createdAt` as a
 * `Carbon` instance, ...) does not exist in this port: `pendingJobs()` and its
 * siblings return `Collection<number, MemoryJobRecord>` directly, so the
 * assertions below read `record.payload.uuid`/`.displayName` and
 * `record.attempts`/`.queue`/`.createdAt` off the raw record instead of a
 * wrapper.
 *
 * Not ported: `testFailureToCreatePayloadFromObject`/
 * `testFailureToCreatePayloadFromArray` -- both exercise `createPayload()`
 * throwing `InvalidArgumentException` on a `json_encode()` failure (invalid
 * UTF-8); there is no JSON encoding step to fail. `testGetLockForPoppingIsCached`
 * exercises `DatabaseQueue::getLockForPopping()` against a mocked PDO driver
 * name/version -- `MemoryQueue` has no SQL lock clause to compute. Attribute
 * override behaviour (`testPushUsesPropertiesDeclaredOnChildClassOverInheritedAttributes`/
 * `testPushStillUsesAttributesDeclaredOnSameClassOverDefaultProperties`) is
 * ported in `Attributes.spec.ts` instead, directly against
 * `ReadsClassAttributes.getAttributeValue()` -- the mechanism `push()`
 * actually reads these through.
 */

class MyTestJob {
    public handle(): void {
        //
    }
}

function freshQueue(): MemoryQueue {
    const queue = new MemoryQueue();
    queue.setContainer(new Container());

    return queue;
}

export = (): void => {
    describe('MemoryQueue', () => {
        // PHP: QueueDatabaseQueueUnitTest::testPushProperlyPushesJobOntoDatabase
        it('push() stores an object job with a uuid, display name, queue, and zero attempts', () => {
            const queue = freshQueue();

            queue.push(new MyTestJob(), ['data']);

            const record = queue.pendingJobs().first()!;

            expect(record.queue).to.equal('default');
            expect(record.attempts).to.equal(0);
            expect(record.reservedAt).to.equal(undefined);
            expect(typeOf(record.availableAt)).to.equal('number');
            expect(record.payload.uuid.size() > 0).to.equal(true);
            expect(record.payload.displayName).to.equal('MyTestJob');
        });

        // PHP: QueueDatabaseQueueUnitTest::testPushProperlyPushesJobOntoDatabase (string job data point)
        it('push() accepts a plain string as the job target', () => {
            const queue = freshQueue();

            queue.push('foo', ['data']);

            const record = queue.pendingJobs().first()!;

            expect(record.payload.displayName).to.equal('foo');
        });

        // PHP: QueueDatabaseQueueUnitTest::testDelayedPushProperlyPushesJobOntoDatabase
        it('later() stores the job as not yet available', () => {
            const queue = freshQueue();

            queue.later(10, 'foo', ['data']);

            expect(queue.pendingJobs().count()).to.equal(0);
            expect(queue.delayedJobs().count()).to.equal(1);

            const record = queue.delayedJobs().first()!;

            expect(record.queue).to.equal('default');
            expect(record.attempts).to.equal(0);
        });

        // PHP: QueueDatabaseQueueUnitTest::testBulkBatchPushesOntoDatabase
        it('bulk() pushes every job onto the given queue', () => {
            const queue = freshQueue();

            queue.bulk(['foo', 'bar'], ['data'], 'queue');

            const records = queue.pendingJobs('queue');

            expect(records.count()).to.equal(2);
            expect(records.first()!.payload.displayName).to.equal('foo');
            expect(records.last()!.payload.displayName).to.equal('bar');
        });

        // PHP: QueueDatabaseQueueUnitTest::testPendingJobs
        it('pendingJobs() returns jobs that are available and unreserved', () => {
            const queue = freshQueue();
            queue.push(new MyTestJob(), []);

            const jobs = queue.pendingJobs();

            expect(jobs.count()).to.equal(1);
            expect(jobs.first()!.payload.displayName).to.equal('MyTestJob');
            expect(jobs.first()!.attempts).to.equal(0);
        });

        // PHP: QueueDatabaseQueueUnitTest::testDelayedJobs
        it('delayedJobs() returns jobs that are not available yet', () => {
            const queue = freshQueue();
            queue.later(60, new MyTestJob(), []);

            const jobs = queue.delayedJobs();

            expect(jobs.count()).to.equal(1);
            expect(jobs.first()!.payload.displayName).to.equal('MyTestJob');
        });

        // PHP: QueueDatabaseQueueUnitTest::testReservedJobs
        it('reservedJobs() returns jobs a worker is holding', () => {
            const queue = freshQueue();
            queue.push(new MyTestJob(), []);

            queue.pop();

            const jobs = queue.reservedJobs();

            expect(jobs.count()).to.equal(1);
            expect(jobs.first()!.attempts).to.equal(1);
        });

        // PHP: QueueDatabaseQueueUnitTest::testAllPendingJobs
        it('allPendingJobs() returns pending jobs across every queue', () => {
            const queue = freshQueue();
            queue.push('JobA', [], 'default');
            queue.push('JobB', [], 'emails');

            const jobs = queue.allPendingJobs();

            expect(jobs.count()).to.equal(2);
            expect(jobs.first()!.payload.displayName).to.equal('JobA');
            expect(jobs.last()!.payload.displayName).to.equal('JobB');
            expect(jobs.last()!.queue).to.equal('emails');
        });

        // PHP: QueueDatabaseQueueUnitTest::testAllDelayedJobs
        it('allDelayedJobs() returns delayed jobs across every queue', () => {
            const queue = freshQueue();
            queue.later(60, 'JobA', [], 'default');
            queue.later(60, 'JobB', [], 'emails');

            const jobs = queue.allDelayedJobs();

            expect(jobs.count()).to.equal(2);
            expect(jobs.first()!.payload.displayName).to.equal('JobA');
            expect(jobs.last()!.payload.displayName).to.equal('JobB');
        });

        // PHP: QueueDatabaseQueueUnitTest::testAllReservedJobs
        it('allReservedJobs() returns reserved jobs across every queue', () => {
            const queue = freshQueue();
            queue.push('JobA', [], 'default');
            queue.push('JobB', [], 'emails');

            queue.pop('default');
            queue.pop('emails');

            const jobs = queue.allReservedJobs();

            expect(jobs.count()).to.equal(2);
            expect(jobs.first()!.attempts).to.equal(1);
            expect(jobs.last()!.attempts).to.equal(1);
        });

        // Not directly in the PHP suite -- exercises `pop()`/`release()`/
        // `delete()` end to end, since the mocked query builder upstream never
        // round-trips through a real store the way this in-memory table does.
        it('pop() reserves a job, and release() returns it to pending', () => {
            const queue = freshQueue();
            queue.push(MyTestJob, []);

            const job = queue.pop() as MemoryJob;

            expect(job).to.be.ok();
            expect(job.attempts()).to.equal(1);
            expect(queue.pendingJobs().count()).to.equal(0);
            expect(queue.reservedJobs().count()).to.equal(1);

            job.release(0);

            expect(queue.pendingJobs().count()).to.equal(1);
            expect(queue.reservedJobs().count()).to.equal(0);
        });

        it('pop() returns undefined once every job has been reserved', () => {
            const queue = freshQueue();
            queue.push(MyTestJob, []);
            queue.pop();

            expect(queue.pop()).to.equal(undefined);
        });

        it('delete() removes the job from the table entirely', () => {
            const queue = freshQueue();
            queue.push(MyTestJob, []);

            const job = queue.pop() as MemoryJob;
            job.delete();

            expect(queue.size()).to.equal(0);
        });

        it('clear() removes every job from the given queue and reports how many', () => {
            const queue = freshQueue();
            queue.push(MyTestJob, [], 'default');
            queue.push(MyTestJob, [], 'emails');

            expect(queue.clear('default')).to.equal(1);
            expect(queue.size('default')).to.equal(0);
            expect(queue.size('emails')).to.equal(1);
        });
    });
};
