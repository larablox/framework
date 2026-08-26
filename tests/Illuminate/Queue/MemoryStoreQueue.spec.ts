/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { InvalidPayloadException } from "Illuminate/Queue/InvalidPayloadException";
import { MemoryStoreJob } from "Illuminate/Queue/Jobs/MemoryStoreJob";
import { MemoryStoreQueue } from "Illuminate/Queue/MemoryStoreQueue";

/**
 * PHP: `Illuminate\Tests\Queue\QueueRedisQueueTest`.
 *
 * Upstream mocks `Illuminate\Contracts\Redis\Factory` and asserts the exact
 * `eval()` call each method issues against `LuaScripts::push()`/`later()`/
 * `size()`/`clear()` -- there is no Lua-script layer or mockable Redis
 * connection here; `MemoryStoreQueue.ts` talks to the real `MemoryStoreService`
 * (see its class comment), reachable only from a running Studio session with
 * API access enabled, so every case below exercises the real thing and
 * asserts round-tripped behaviour instead of a mocked call. Each test uses
 * its own queue name (from `HttpService.GenerateGUID`) so tests never see
 * each other's items.
 *
 * Not ported, no equivalent in this port -- `MemoryStoreQueue` talks to one
 * `MemoryStoreService`, never a cluster: every cluster/hash-tag case (`testGetQueueRemainsUnchangedForCluster`,
 * `testGetRedisKeyWrapsWithHashTagsForPhpRedisCluster`,
 * `testGetRedisKeyWrapsWithHashTagsForPredisCluster`,
 * `testGetRedisKeyDoesNotDoubleWrapExistingHashTags`,
 * `testGetRedisKeySkipsWrappingWhenQueueNameContainsBraces`,
 * `testGetRedisKeyWrapsEmptyHashTagOnCluster`,
 * `testGetRedisKeyWrapsUnmatchedOpeningBrace`,
 * `testGetRedisKeyWrapsUnmatchedClosingBrace`,
 * `testGetRedisKeyWrapsEmptyFirstHashTagFollowedByValidPair`,
 * `testPushUsesGetRedisKeyForLuaScript`, `testSizeUsesGetRedisKeyOnCluster`,
 * `testClearUsesGetRedisKeyOnCluster`, `testIsClusterConnectionCachesResult`,
 * `testAllQueueNamesStripsClusterBraces`) -- `MemoryStoreQueue` has one
 * `MemoryStoreService`, never a cluster, so `getQueueRedisKey()`/
 * `isClusterConnection()`/`allQueueNames()` do not exist to exercise.
 * `testPushPassesUnchangedQueueToCreatePayload` is the one cluster-adjacent
 * case with a driver-agnostic point (the payload hook receives the
 * *unchanged* queue name); it is ported below without the cluster angle.
 * `testGetQueueRemainsUnchangedForNonCluster`/`testGetRedisKeyReturnsPlainKeyForNonCluster`
 * collapse into the `getQueue()` case below (there being no Redis key to
 * separately expose). `clear()` is not implemented on `MemoryStoreQueue`, so
 * `testClearUsesGetRedisKeyOnCluster` has nothing to port beyond the cluster
 * point above. `testBulkRespectsDelayAttributeWhenPushingOntoRedis` is
 * covered by `Delay.spec.ts` instead, which exercises the `Delay` attribute
 * itself; `bulk()`'s mechanics (looping `push()`) are exercised generically
 * for every queue driver via `Queue.bulk()`.
 */

const HttpService = game.GetService("HttpService");

class MyTestJob {
    public handle(): void {
        //
    }
}

/**
 * How long a pushed item lives.
 *
 * Not the framework's week-long default: MemoryStore's quota is per-universe
 * and every run here pushes under a name of its own, so a week-long
 * expiration means each run's leavings sit in the quota until the next
 * Tuesday -- and after enough of them `Queue.Add` starts answering
 * `TotalMemoryOverLimit` and the tests below fail for reasons that have
 * nothing to do with the code. Long enough for a test, short enough to be
 * gone before the next run needs the room.
 */
const EXPIRATION = 30;

function freshQueue(): MemoryStoreQueue {
    const queue = new MemoryStoreQueue(
        HttpService.GenerateGUID(false),
        60,
        0,
        EXPIRATION,
        "queue-test:",
    );
    queue.setContainer(new Container());

    return queue;
}

export = (): void => {
    describe("MemoryStoreQueue", () => {
        // PHP: QueueRedisQueueTest::testGetQueueRemainsUnchangedForNonCluster /
        // testGetRedisKeyReturnsPlainKeyForNonCluster (collapsed, no cluster key
        // to separately expose -- see class comment)
        it("getQueue() falls back to the default queue name", () => {
            const queue = new MemoryStoreQueue("default");

            expect(queue.getQueue()).to.equal("default");
            expect(queue.getQueue("emails")).to.equal("emails");
        });

        // PHP: QueueRedisQueueTest::testPushProperlyPushesJobOntoRedis
        it("push() stores the job, and pop() reads it back", () => {
            const queue = freshQueue();

            const id = queue.push("foo", ["data"]) as string;

            expect(typeOf(id)).to.equal("string");

            const job = queue.pop() as MemoryStoreJob;

            expect(job).to.be.ok();
            expect(job.getRawBody().displayName).to.equal("foo");
            expect((job.getRawBody().data as Array<unknown>)[0]).to.equal(
                "data",
            );
        });

        // PHP: QueueRedisQueueTest::testPushProperlyPushesJobOntoRedisWithCustomPayloadHook /
        // testPushProperlyPushesJobOntoRedisWithTwoCustomPayloadHook
        it("push() runs every registered createPayloadUsing() hook, in order", () => {
            const queue = freshQueue();

            MemoryStoreQueue.createPayloadUsing(
                () => ({ maxTries: 3 }) as never,
            );
            MemoryStoreQueue.createPayloadUsing(
                () => ({ maxExceptions: 2 }) as never,
            );

            queue.push("foo", ["data"]);

            const job = queue.pop() as MemoryStoreJob;

            expect(job.getRawBody().maxTries).to.equal(3);
            expect(job.getRawBody().maxExceptions).to.equal(2);

            MemoryStoreQueue.createPayloadUsing(undefined);
        });

        // PHP: QueueRedisQueueTest::testPushPassesUnchangedQueueToCreatePayload
        it("push() hands the payload hook the queue name unchanged", () => {
            const queue = freshQueue();

            let receivedQueue: string | undefined;

            MemoryStoreQueue.createPayloadUsing((_connection, queueName) => {
                receivedQueue = queueName;

                return {};
            });

            queue.push("foo", ["data"]);

            expect(receivedQueue).to.equal(queue.getQueue());

            MemoryStoreQueue.createPayloadUsing(undefined);
        });

        // PHP: QueueRedisQueueTest::testDelayedPushProperlyPushesJobOntoRedis
        it("later() holds the job until its delay has passed", () => {
            const queue = freshQueue();

            // Held with a delay long enough to be certain: `currentTime()`
            // counts whole seconds, so a one-second delay can come due purely
            // because a second boundary fell between `later()` and `pop()`.
            queue.later(60, "held", ["data"]);

            expect(queue.pop()).to.equal(undefined);

            queue.later(1, "foo", ["data"]);

            task.wait(1.2);

            const job = queue.pop() as MemoryStoreJob;

            expect(job).to.be.ok();
            expect(job.getRawBody().displayName).to.equal("foo");
        });

        // Not directly in the PHP suite -- exercises `pop()`/`release()`/
        // `delete()` end to end against the real MemoryStoreQueue, since
        // upstream never round-trips through a real Redis the way this does.
        it("release() returns a popped job to the queue", () => {
            const queue = freshQueue();
            queue.push("foo", ["data"]);

            const job = queue.pop() as MemoryStoreJob;
            job.release(0);

            const again = queue.pop() as MemoryStoreJob;

            expect(again).to.be.ok();
            expect(again.attempts()).to.equal(2);
        });

        it("delete() removes a popped job so it is not read again", () => {
            const queue = freshQueue();
            queue.push("foo", ["data"]);

            const job = queue.pop() as MemoryStoreJob;
            job.delete();

            expect(queue.pop()).to.equal(undefined);
        });

        // PHP: no direct equivalent -- exercises the platform limit
        // `MemoryStoreQueue.ts`'s class comment documents: an item may not
        // exceed 32 KB, refused rather than silently truncated.
        it("a payload larger than the 32 KB item limit is refused", () => {
            const queue = freshQueue();

            const [ok, err] = pcall(() =>
                queue.push("foo", string.rep("x", 33 * 1024)),
            );

            expect(ok).to.equal(false);
            expect(err instanceof InvalidPayloadException).to.equal(true);
        });

        // PHP: no direct equivalent -- `RedisQueue` can look at its list
        // without consuming it (`lrange`); MemoryStore cannot, because
        // `ReadAsync` is the only way to see a job and it reserves what it
        // reads (see class comment). The sizes are real -- `Size.spec.ts`
        // covers them -- and the listings are what the platform withholds.
        it("the job listings answer empty even though the sizes count", () => {
            const queue = freshQueue();
            queue.push(new MyTestJob(), []);

            expect(queue.size()).to.equal(1);

            expect(queue.pendingJobs().isEmpty()).to.equal(true);
            expect(queue.delayedJobs().isEmpty()).to.equal(true);
            expect(queue.reservedJobs().isEmpty()).to.equal(true);
            expect(queue.creationTimeOfOldestPendingJob()).to.equal(undefined);
        });
    });
};
