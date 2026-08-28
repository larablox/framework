/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';
import { Delay } from 'Illuminate/Queue/Attributes/Delay';
import { Dispatcher } from 'Illuminate/Bus/Dispatcher';
import { Queue as QueueAttribute } from 'Illuminate/Queue/Attributes/Queue';
import { Queueable } from 'Illuminate/Bus/Queueable';
import { RuntimeException } from 'Illuminate/Exception';
import { ShouldQueue } from 'Illuminate/Contracts/Queue/ShouldQueue';
import type { Delay as DelayValue } from 'Illuminate/Support/InteractsWithTime';
import type { Job } from 'Illuminate/Contracts/Queue/Job';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/**
 * PHP: `Illuminate\Tests\Bus\BusDispatcherTest`.
 *
 * No Mockery here -- `Queue` mocks are hand-written fakes that record the call
 * they care about and throw on anything else, the way `m::mock(Queue::class)`
 * with no expectation set would fail the test on an unexpected call.
 *
 * `testCommandsAreDispatchedWithQueueRoute` and `testDispatchBulk` are not
 * ported: the first exercises a `'queue.routes'` container binding
 * (`Illuminate\Queue\QueueRoutes`) this port never introduced --
 * `Dispatcher.dispatchToQueue()` here resolves the queue/connection purely
 * from `Queue`/`Connection` attributes (or the job's own `queue`/`connection`
 * property, see `ReadsClassAttributes`), never through a router object. The
 * second calls `Dispatcher::bulk()`, a method `Bus/Dispatcher.ts` does not
 * declare at all -- there is no bulk-dispatch entry point to exercise.
 */
class FakeQueue implements Queue {
    public pushCalls = new Array<[unknown, unknown, string | undefined]>();
    public laterCalls = new Array<[DelayValue, unknown, unknown, string | undefined]>();

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
        this.pushCalls.push([job, data, queue]);

        return undefined;
    }

    public pushOn(queue: string, job: unknown, data?: unknown): unknown {
        return this.push(job, data, queue);
    }

    public pushRaw(): unknown {
        throw 'not expected';
    }

    public later(delay: DelayValue, job: unknown, data?: unknown, queue?: string): unknown {
        this.laterCalls.push([delay, job, data, queue]);

        return undefined;
    }

    public laterOn(queue: string, delay: DelayValue, job: unknown, data?: unknown): unknown {
        return this.later(delay, job, data, queue);
    }

    public bulk(): void {
        throw 'not expected';
    }

    public pop(): Job | undefined {
        return undefined;
    }

    public getConnectionName(): string {
        return 'fake';
    }

    public setConnectionName(): this {
        return this;
    }
}

@ShouldQueue()
class BusDispatcherBasicCommand {
    public handle(): void {
        //
    }
}

@ShouldQueue()
class BusDispatcherTestCustomQueueCommand {
    public queue(queue: Queue, command: object): unknown {
        return queue.push(command);
    }
}

@ShouldQueue()
@QueueAttribute('foo')
@Delay(10)
class BusDispatcherTestSpecificQueueAndDelayCommand {}

class StandAloneCommand {}

class StandAloneHandler {
    public handle(command: StandAloneCommand): StandAloneCommand {
        return command;
    }
}

@ShouldQueue()
class ShouldNotBeDispatched extends Queueable {
    public handle(): void {
        throw new RuntimeException('This should not be run');
    }
}

export = (): void => {
    describe('Dispatcher', () => {
        it('queues a command marked ShouldQueue', () => {
            // PHP: BusDispatcherTest::testCommandsThatShouldQueueIsQueued
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(container, () => queue);

            dispatcher.dispatch(new BusDispatcherBasicCommand());

            expect(queue.pushCalls.size()).to.equal(1);
        });

        it('queues a command through its own custom queue() method', () => {
            // PHP: BusDispatcherTest::testCommandsThatShouldQueueIsQueuedUsingCustomHandler
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(container, () => queue);

            dispatcher.dispatch(new BusDispatcherTestCustomQueueCommand());

            expect(queue.pushCalls.size()).to.equal(1);
        });

        it('queues a command on its declared queue with its declared delay', () => {
            // PHP: BusDispatcherTest::testCommandsThatShouldQueueIsQueuedUsingCustomQueueAndDelay
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(container, () => queue);
            const command = new BusDispatcherTestSpecificQueueAndDelayCommand();

            dispatcher.dispatch(command);

            expect(queue.laterCalls.size()).to.equal(1);
            const [delay, job, data, queueName] = queue.laterCalls[0];
            expect(delay).to.equal(10);
            expect(job).to.equal(command);
            expect(data).to.equal('');
            expect(queueName).to.equal('foo');
        });

        it('dispatchNow() never queues, even for a queueable command', () => {
            // PHP: BusDispatcherTest::testDispatchNowShouldNeverQueue
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(container, () => queue);

            dispatcher.dispatchNow(new BusDispatcherBasicCommand());

            expect(queue.pushCalls.size()).to.equal(0);
        });

        it('dispatches to a stand-alone handler registered with map()', () => {
            // PHP: BusDispatcherTest::testDispatcherCanDispatchStandAloneHandler
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(container, () => queue);

            dispatcher.map([[StandAloneCommand, StandAloneHandler]]);

            const command = new StandAloneCommand();
            const response = dispatcher.dispatch(command);

            expect(response).to.equal(command);
        });

        it('respects onConnection() set on the job before dispatching', () => {
            // PHP: BusDispatcherTest::testOnConnectionOnJobWhenDispatching
            const container = new Container();
            const queue = new FakeQueue();
            const dispatcher = new Dispatcher(container, () => queue);

            const job = new ShouldNotBeDispatched().onConnection('null');

            dispatcher.dispatch(job);

            expect(queue.pushCalls.size()).to.equal(1);
        });
    });
};
