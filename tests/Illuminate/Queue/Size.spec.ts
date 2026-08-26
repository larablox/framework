/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { MemoryQueue } from "Illuminate/Queue/MemoryQueue";
import { MemoryStoreQueue } from "Illuminate/Queue/MemoryStoreQueue";

/**
 * PHP: `Illuminate\Tests\Queue\QueueSizeTest`.
 *
 * Upstream boots a Testbench application and reads `size()` off the `Queue`
 * facade backed by `Queue::fake()`. There is no facade or fake queue here, so
 * this pushes onto a real `MemoryQueue` directly and reads `size()` back --
 * the driver upstream's fake stands in for. `MemoryStoreQueue` -- the "Redis"
 * driver -- counts too, over `GetSizeAsync`, so the cases below run the same
 * assertions against it and pin down the one split PHP gets from three
 * separate keys and this gets from `excludeInvisible`: a job `pop()` handed
 * out is reserved, not pending, and still counts towards `size()`.
 */

const HttpService = game.GetService("HttpService");
/** Every queue this run made -- see `MemoryStoreQueue.spec.ts`'s `drain()`. */
const made: Array<MemoryStoreQueue> = [];

/** Give back what this run pushed rather than waiting the expiration out. */
function drain(): void {
    for (const queue of made) {
        queue.clear();
    }
}

/**
 * A queue of this run's own, gone half a minute later.
 *
 * `new MemoryStoreQueue()` would take every default -- including the queue
 * name `default`, the prefix `queue:` and a week-long expiration -- and push
 * a job into the *game's* own queue that sits in the universe's MemoryStore
 * quota until the next Tuesday. See `MemoryStoreQueue.spec.ts` for the same
 * reasoning at length.
 */
function memoryStoreQueue(): MemoryStoreQueue {
    const queue = new MemoryStoreQueue(
        HttpService.GenerateGUID(false),
        60,
        0,
        30,
        "queue-test:",
    );
    made.push(queue);

    return queue;
}

export = (): void => {
    describe("Size", () => {
        afterAll(drain);

        // PHP: QueueSizeTest::test_queue_size
        it("size() counts jobs per queue on MemoryQueue", () => {
            const queue = new MemoryQueue();
            queue.setContainer(new Container());

            expect(queue.size()).to.equal(0);
            expect(queue.size("Q2")).to.equal(0);

            queue.push("TestJob1", []);
            queue.push("TestJob2", []);
            queue.push("TestJob1", [], "Q2");

            expect(queue.size()).to.equal(2);
            expect(queue.size("Q2")).to.equal(1);
        });

        // PHP: QueueSizeTest::test_queue_size, against the driver upstream's
        // `Queue::fake()` stands in for
        it("size() counts pushed jobs on MemoryStoreQueue", () => {
            const queue = memoryStoreQueue();
            queue.setContainer(new Container());

            expect(queue.size()).to.equal(0);

            queue.push("TestJob1", []);
            queue.push("TestJob2", []);

            expect(queue.size()).to.equal(2);
            expect(queue.pendingSize()).to.equal(2);
            expect(queue.reservedSize()).to.equal(0);
        });

        // PHP: no direct equivalent -- `RedisQueue` moves a popped job to the
        // `:reserved` sorted set, where `zcard` counts it; MemoryStore keeps
        // it in the same queue and only turns it invisible, so this pins down
        // that the two still report the same three numbers.
        it("a popped job counts as reserved, not pending, and still counts towards size()", () => {
            const queue = memoryStoreQueue();
            queue.setContainer(new Container());

            queue.push("TestJob1", []);
            queue.pop();

            expect(queue.size()).to.equal(1);
            expect(queue.pendingSize()).to.equal(0);
            expect(queue.reservedSize()).to.equal(1);
        });

        // PHP: no direct equivalent -- `later()` writes to the `:delayed`
        // sorted set, counted separately from the list
        it("a delayed job counts as delayed, not pending", () => {
            const queue = memoryStoreQueue();
            queue.setContainer(new Container());

            queue.later(60, "TestJob1", []);

            expect(queue.delayedSize()).to.equal(1);
            expect(queue.pendingSize()).to.equal(0);
            expect(queue.size()).to.equal(1);
        });
    });
};
