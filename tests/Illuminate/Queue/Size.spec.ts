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
 * the driver where `size()` actually counts (see `MemoryQueue.ts`).
 * `MemoryStoreQueue` -- the "Redis" driver -- has no length to report at all
 * (`MemoryStoreQueue.ts`'s class comment: "What Redis gives and this does
 * not: no length"), so the second case below documents that divergence
 * directly against it instead of silently skipping the driver.
 */

const HttpService = game.GetService("HttpService");

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
    return new MemoryStoreQueue(
        HttpService.GenerateGUID(false),
        60,
        0,
        30,
        "queue-test:",
    );
}

export = (): void => {
    describe("Size", () => {
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

        // PHP: no direct equivalent -- documents the platform gap
        // `MemoryStoreQueue.ts`'s class comment calls out: MemoryStore
        // exposes no count, so `size()` answers zero regardless of what has
        // been pushed.
        it("size() always answers zero on MemoryStoreQueue (divergence from upstream)", () => {
            const queue = memoryStoreQueue();
            queue.setContainer(new Container());

            queue.push("TestJob1", []);

            expect(queue.size()).to.equal(0);
        });
    });
};
