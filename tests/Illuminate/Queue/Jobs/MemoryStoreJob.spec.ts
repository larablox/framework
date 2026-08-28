/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';
import { MemoryStoreJob } from 'Illuminate/Queue/Jobs/MemoryStoreJob';
import { Serializer } from 'Illuminate/Support/Serializer';
import type { JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { MemoryStoreQueue } from 'Illuminate/Queue/MemoryStoreQueue';

/**
 * PHP: `Illuminate\Tests\Queue\QueueRedisJobTest`.
 *
 * Upstream mocks `Container` and `RedisQueue` with Mockery and asserts the
 * exact `make`/`deleteReserved`/`deleteAndRelease` calls `fire()`/`delete()`/
 * `release()` issue. This port's `MemoryStoreJob.ts` needs a real
 * `MemoryStoreQueue` to call back into (its constructor decodes the payload
 * and increments `attempts` immediately -- see the class comment), so a
 * hand-written fake stands in for `RedisQueue`, recording what it was called
 * with the way `job->getRedisQueue()->shouldReceive(...)` asserts upstream.
 * `Container` is the real one; `fire()`'s resolution is exercised the same
 * way `SyncQueue.spec.ts` exercises `SyncJob.fire()`.
 */

class FakeMemoryStoreQueue
{
    public deleteReservedCalls = new Array<[string, MemoryStoreJob]>();
    public deleteAndReleaseCalls = new Array<[string, MemoryStoreJob, number]>();

    public deleteReserved(queue: string, job: MemoryStoreJob): void
    {
        this.deleteReservedCalls.push([queue, job]);
    }

    public deleteAndRelease(queue: string, job: MemoryStoreJob, delay: number): void
    {
        this.deleteAndReleaseCalls.push([queue, job, delay]);
    }
}

class FooHandler
{
    public called?: [unknown, unknown];

    public fire(job: unknown, data: unknown): void
    {
        this.called = [job, data];
    }
}

function getJob(memoryStore: FakeMemoryStoreQueue): [MemoryStoreJob, FooHandler]
{
    const container = new Container();
    const handler = new FooHandler();
    container.instance('foo', handler);

    const payload: Partial<JobPayload> = {
        job: 'foo',
        data: ['data'],
        attempts: 1,
    };

    const job = new MemoryStoreJob(
        container,
        memoryStore as unknown as MemoryStoreQueue,
        Serializer.serialize(payload),
        'reserved-id',
        'connection-name',
        'default',
    );

    return [job, handler];
}

export = (): void => {
    describe('MemoryStoreJob', () => {
        // PHP: QueueRedisJobTest::testFireProperlyCallsTheJobHandler
        it('fire() resolves the handler and calls it with the job and data', () => {
            const memoryStore = new FakeMemoryStoreQueue();
            const [job, handler] = getJob(memoryStore);

            job.fire();

            expect(handler.called).to.be.ok();
            expect(handler.called![0]).to.equal(job);
            expect((handler.called![1] as Array<unknown>)[0]).to.equal('data');
        });

        // PHP: QueueRedisJobTest::testDeleteRemovesTheJobFromRedis
        it('delete() tells the queue to delete the reserved job', () => {
            const memoryStore = new FakeMemoryStoreQueue();
            const [job] = getJob(memoryStore);

            job.delete();

            expect(memoryStore.deleteReservedCalls.size()).to.equal(1);
            expect(memoryStore.deleteReservedCalls[0][0]).to.equal('default');
            expect(memoryStore.deleteReservedCalls[0][1]).to.equal(job);
        });

        // PHP: QueueRedisJobTest::testReleaseProperlyReleasesJobOntoRedis
        it('release() tells the queue to delete and release the job', () => {
            const memoryStore = new FakeMemoryStoreQueue();
            const [job] = getJob(memoryStore);

            job.release(1);

            expect(memoryStore.deleteAndReleaseCalls.size()).to.equal(1);
            expect(memoryStore.deleteAndReleaseCalls[0][0]).to.equal('default');
            expect(memoryStore.deleteAndReleaseCalls[0][1]).to.equal(job);
            expect(memoryStore.deleteAndReleaseCalls[0][2]).to.equal(1);
        });

        // Not directly in the PHP suite -- exercises the constructor
        // incrementing `attempts` on read, the mechanic
        // `MemoryStoreJob.ts`'s class comment documents as standing in for
        // Redis's pop script incrementing the reserved copy.
        it("attempts() is one higher than the stored payload's attempts", () => {
            const memoryStore = new FakeMemoryStoreQueue();
            const [job] = getJob(memoryStore);

            expect(job.attempts()).to.equal(2);
        });
    });
};
