/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../TestHelpers";
import { CallQueuedListener } from "Illuminate/Events/CallQueuedListener";
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { MaxExceptions } from "Illuminate/Queue/Attributes/MaxExceptions";
import { ShouldQueue } from "Illuminate/Contracts/Queue/ShouldQueue";
import type { Delay as DelayValue } from "Illuminate/Support/InteractsWithTime";
import type { Factory as QueueFactory } from "Illuminate/Contracts/Queue/Factory";
import type { Job } from "Illuminate/Contracts/Queue/Job";
import type { Queue } from "Illuminate/Contracts/Queue/Queue";

/**
 * PHP: `Illuminate\Tests\Events\QueuedEventsTest`.
 *
 * This port's `CallQueuedListener` is explicitly "without uniqueness"
 * (`agent_docs/laravel-parity.md`: "`Illuminate\Events\CallQueuedListener` |
 * `Events/CallQueuedListener.ts` | без уникальности") and its `Dispatcher`
 * never sets `messageGroup`/`deduplicator`/`deduplicationId` (SQS-specific
 * FIFO fields) or reads a `queue.routes` binding -- none of those fields or
 * mechanisms exist on `CallQueuedListener.ts`/`Dispatcher.ts`. So, not
 * ported here, no equivalent in this port:
 * - `testQueueIsSetUsingQueueRoutes` (`QueueRoutes`/`queue.routes` binding)
 * - `testQueuePropagateMessageGroupProperty` /
 *   `...MessageGroupMethodOverProperty` (`messageGroup`)
 * - `testQueuePropagateDeduplicationIdMethod` /
 *   `...DeduplicatorMethodOverDeduplicationIdMethod` (`deduplicationId`/
 *   `deduplicator`, and `Laravel\SerializableClosure` besides)
 * - `testQueuePropagatesShouldBeUnique`,
 *   `testUniqueListenerNotQueuedWhenLockNotAcquired`,
 *   `testQueuePropagatesShouldBeUniqueUntilProcessing`,
 *   `testQueuePropagatesUniqueIdFromMethod`,
 *   `testUniqueLockKeyUsesListenerClassName`,
 *   `testUniqueLockIsAcquiredWithListenerClassName`,
 *   `testUniqueViaUsesListenerCacheRepository`,
 *   `testUniqueLockIsReleasedOnProcessingWithListenerClassName`,
 *   `testUniqueUntilProcessingLockIsReleasedBeforeHandling` (all
 *   `ShouldBeUnique`/`Bus\UniqueLock` -- the class-decorator half exists,
 *   `Contracts/Queue/ShouldBeUnique.ts`, but `CallQueuedListener` never reads
 *   it, so there is no dispatch-time behaviour left to assert)
 * - `testDispatchesOnQueueDefinedWithEnum` (`viaQueue()` returning a PHP
 *   backed enum case; there is no enum type on this platform, see
 *   `roblox-ts-constraints.md`)
 *
 * None of `QueueFake`/`Illuminate\Support\Testing\Fakes\QueueFake` is ported
 * either (not listed in `agent_docs/laravel-parity.md`'s Queue row); every
 * test below drives a hand-written `RecordingQueue` fake instead, in the same
 * spirit as `RecordingHandler` in `Logger.spec.ts` -- it records every
 * `push`/`pushOn`/`later`/`laterOn` call so the assertions can inspect the
 * `CallQueuedListener` job that went through, exactly as upstream inspects
 * the same job via `QueueFake`/`Mockery`.
 */

/** Minimal `Queue` fake that just records what was pushed onto it. */
class RecordingQueue implements Queue {
    public pushCalls = new Array<{
        job: unknown;
        data: unknown;
        queue: string | undefined;
    }>();

    public pushOnCalls = new Array<{
        queue: string;
        job: unknown;
        data: unknown;
    }>();

    public laterCalls = new Array<{
        delay: DelayValue;
        job: unknown;
        data: unknown;
        queue: string | undefined;
    }>();

    public laterOnCalls = new Array<{
        queue: string;
        delay: DelayValue;
        job: unknown;
        data: unknown;
    }>();

    private connectionName = "";

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

    public push(job: unknown, data?: unknown, queue?: string): unknown {
        this.pushCalls.push({ job, data, queue });

        return undefined;
    }

    public pushOn(queue: string, job: unknown, data?: unknown): unknown {
        this.pushOnCalls.push({ queue, job, data });

        return undefined;
    }

    public pushRaw(): unknown {
        return undefined;
    }

    public later(
        delay: DelayValue,
        job: unknown,
        data?: unknown,
        queue?: string,
    ): unknown {
        this.laterCalls.push({ delay, job, data, queue });

        return undefined;
    }

    public laterOn(
        queue: string,
        delay: DelayValue,
        job: unknown,
        data?: unknown,
    ): unknown {
        this.laterOnCalls.push({ queue, delay, job, data });

        return undefined;
    }

    public bulk(): void {
        //
    }

    public pop(): Job | undefined {
        return undefined;
    }

    public getConnectionName(): string {
        return this.connectionName;
    }

    public setConnectionName(name: string): this {
        this.connectionName = name;

        return this;
    }
}

/** `Factory` fake that hands out one `RecordingQueue` per connection name, and records which name was asked for. */
class RecordingQueueFactory implements QueueFactory {
    public readonly queue = new RecordingQueue();
    public connectionCalls = new Array<string | undefined>();

    public connection(name?: string): Queue {
        this.connectionCalls[this.connectionCalls.size()] = name;

        return this.queue;
    }
}

export = (): void => {
    describe("Queued event listeners", () => {
        it("a @ShouldQueue() listener is pushed onto the resolved connection as a CallQueuedListener", () => {
            // PHP: QueuedEventsTest::testQueuedEventHandlersAreQueued
            @ShouldQueue()
            class TestDispatcherQueuedHandler {
                public handle(): void {
                    //
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherQueuedHandler",
                TestDispatcherQueuedHandler,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();

            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherQueuedHandler@handle");
            d.dispatch("some.event", ["foo", "bar"]);

            expectDeepEqual(factory.connectionCalls, [undefined]);
            expect(factory.queue.pushOnCalls.size()).to.equal(1);
            const pushed = factory.queue.pushOnCalls[0];
            expect(pushed.queue).to.equal(undefined);
            expect(pushed.job instanceof CallQueuedListener).to.equal(true);
        });

        it("connection/queue/delay listener properties are propagated onto the queued job", () => {
            // PHP: QueuedEventsTest::testCustomizedQueuedEventHandlersAreQueued
            //
            // Upstream sets `$connection`/`$delay`/`$queue` public properties
            // on the listener; `ReadsClassAttributes.getAttributeValue()`
            // reads an instance property before falling back to the matching
            // decorator (see its class comment), so a plain property works
            // here exactly as it does in PHP.
            @ShouldQueue()
            class TestDispatcherConnectionQueuedHandler {
                public connection = "redis";
                public delaySeconds: DelayValue = 10;
                public queue = "my_queue";

                public handle(): void {
                    //
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherConnectionQueuedHandler",
                TestDispatcherConnectionQueuedHandler,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen(
                "some.event",
                "TestDispatcherConnectionQueuedHandler@handle",
            );
            d.dispatch("some.event", ["foo", "bar"]);

            expectDeepEqual(factory.connectionCalls, ["redis"]);
            expect(factory.queue.laterOnCalls.size()).to.equal(1);
            const pushed = factory.queue.laterOnCalls[0];
            expect(pushed.queue).to.equal("my_queue");
            expect(pushed.delay).to.equal(10);
            expect(pushed.job instanceof CallQueuedListener).to.equal(true);
        });

        it("viaQueue() overrides the queue property", () => {
            // PHP: QueuedEventsTest::testQueueIsSetByGetQueue
            @ShouldQueue()
            class TestDispatcherGetQueue {
                public queue = "my_queue";

                public handle(): void {
                    //
                }

                public viaQueue(): string {
                    return "some_other_queue";
                }
            }

            const container = new Container();
            container.bind("TestDispatcherGetQueue", TestDispatcherGetQueue);
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherGetQueue@handle");
            d.dispatch("some.event", ["foo", "bar"]);

            expect(factory.queue.pushOnCalls.size()).to.equal(1);
            expect(factory.queue.pushOnCalls[0].queue).to.equal(
                "some_other_queue",
            );
        });

        it("viaConnection() overrides the connection property", () => {
            // PHP: QueuedEventsTest::testQueueIsSetByGetConnection
            @ShouldQueue()
            class TestDispatcherGetConnection {
                public connection = "my_connection";

                public handle(): void {
                    //
                }

                public viaConnection(): string {
                    return "some_other_connection";
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherGetConnection",
                TestDispatcherGetConnection,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherGetConnection@handle");
            d.dispatch("some.event", ["foo", "bar"]);

            expectDeepEqual(factory.connectionCalls, ["some_other_connection"]);
        });

        it("withDelay() overrides the delay property", () => {
            // PHP: QueuedEventsTest::testDelayIsSetByWithDelay
            @ShouldQueue()
            class TestDispatcherGetDelay {
                public delaySeconds: DelayValue = 10;

                public handle(): void {
                    //
                }

                public withDelay(): number {
                    return 20;
                }
            }

            const container = new Container();
            container.bind("TestDispatcherGetDelay", TestDispatcherGetDelay);
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherGetDelay@handle");
            d.dispatch("some.event", ["foo", "bar"]);

            expect(factory.queue.laterOnCalls.size()).to.equal(1);
            expect(factory.queue.laterOnCalls[0].delay).to.equal(20);
        });

        it("viaQueue(event) can branch on the event payload", () => {
            // PHP: QueuedEventsTest::testQueueIsSetByGetQueueDynamically
            @ShouldQueue()
            class TestDispatcherGetQueueDynamically {
                public queue = "my_queue";

                public handle(): void {
                    //
                }

                public viaQueue(event: {
                    useHighPriorityQueue?: boolean;
                }): string {
                    if (event.useHighPriorityQueue) {
                        return "p0";
                    }

                    return "p99";
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherGetQueueDynamically",
                TestDispatcherGetQueueDynamically,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherGetQueueDynamically@handle");
            d.dispatch("some.event", [{ useHighPriorityQueue: true }, "bar"]);

            expect(factory.queue.pushOnCalls.size()).to.equal(1);
            expect(factory.queue.pushOnCalls[0].queue).to.equal("p0");
        });

        it("viaConnection(event) can branch on the event payload", () => {
            // PHP: QueuedEventsTest::testQueueIsSetByGetConnectionDynamically
            @ShouldQueue()
            class TestDispatcherGetConnectionDynamically {
                public handle(): void {
                    //
                }

                public viaConnection(event: {
                    shouldUseRedisConnection?: boolean;
                }): string {
                    if (event.shouldUseRedisConnection) {
                        return "redis";
                    }

                    return "sqs";
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherGetConnectionDynamically",
                TestDispatcherGetConnectionDynamically,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen(
                "some.event",
                "TestDispatcherGetConnectionDynamically@handle",
            );
            d.dispatch("some.event", [
                { shouldUseRedisConnection: true },
                "bar",
            ]);

            expectDeepEqual(factory.connectionCalls, ["redis"]);
        });

        it("withDelay(event) can branch on the event payload", () => {
            // PHP: QueuedEventsTest::testDelayIsSetByWithDelayDynamically
            @ShouldQueue()
            class TestDispatcherGetDelayDynamically {
                public delaySeconds: DelayValue = 10;

                public handle(): void {
                    //
                }

                public withDelay(event: { useHighDelay?: boolean }): number {
                    if (event.useHighDelay) {
                        return 60;
                    }

                    return 20;
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherGetDelayDynamically",
                TestDispatcherGetDelayDynamically,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherGetDelayDynamically@handle");
            d.dispatch("some.event", [{ useHighDelay: true }, "bar"]);

            expect(factory.queue.laterOnCalls.size()).to.equal(1);
            expect(factory.queue.laterOnCalls[0].delay).to.equal(60);
        });

        it("tries()/retryUntil() and the maxExceptions attribute are propagated onto the queued job", () => {
            // PHP: QueuedEventsTest::testQueuePropagateRetryUntilAndMaxExceptions +
            // QueuedEventsTest::testQueuePropagateTries (merged: both dispatch
            // the exact same listener and inspect the same pushed job)
            @ShouldQueue()
            @MaxExceptions(1)
            class TestDispatcherOptions {
                public retryUntil(): number {
                    return os.time() + 3600;
                }

                public tries(): number {
                    return 5;
                }

                public handle(): void {
                    //
                }
            }

            const container = new Container();
            container.bind("TestDispatcherOptions", TestDispatcherOptions);
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherOptions@handle");
            d.dispatch("some.event", ["foo", "bar"]);

            expect(factory.queue.pushOnCalls.size()).to.equal(1);
            const job = factory.queue.pushOnCalls[0].job as CallQueuedListener;
            expect(job.maxExceptions).to.equal(1);
            expect(job.retryUntil).never.to.equal(undefined);
            expect(job.tries).to.equal(5);
        });

        it("middleware() is propagated onto the queued job", () => {
            // PHP: QueuedEventsTest::testQueuePropagateMiddleware
            class TestMiddleware {
                public constructor(
                    public readonly a: unknown,
                    public readonly b: unknown,
                ) {}

                public handle(
                    job: unknown,
                    _next: (job: unknown) => void,
                ): void {
                    _next(job);
                }
            }

            @ShouldQueue()
            class TestDispatcherMiddleware {
                public middleware(a: unknown, b: unknown): Array<unknown> {
                    return [new TestMiddleware(a, b)];
                }

                public handle(): void {
                    //
                }
            }

            const container = new Container();
            container.bind(
                "TestDispatcherMiddleware",
                TestDispatcherMiddleware,
            );
            const d = new Dispatcher(container);
            const factory = new RecordingQueueFactory();
            d.setQueueResolver(() => factory);

            d.listen("some.event", "TestDispatcherMiddleware@handle");
            d.dispatch("some.event", ["foo", "bar"]);

            expect(factory.queue.pushOnCalls.size()).to.equal(1);
            const job = factory.queue.pushOnCalls[0].job as CallQueuedListener;
            const middleware = job.middleware as Array<TestMiddleware>;

            expect(middleware.size()).to.equal(1);
            expect(middleware[0] instanceof TestMiddleware).to.equal(true);
            expect(middleware[0].a).to.equal("foo");
            expect(middleware[0].b).to.equal("bar");
        });
    });
};
