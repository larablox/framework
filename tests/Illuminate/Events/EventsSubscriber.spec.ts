/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";

/**
 * PHP: `Illuminate\Tests\Events\EventsSubscriberTest`.
 *
 * `testEventSubscribers` and `testEventSubscribeCanAcceptObject` both mock
 * `subscribe()` to assert it was called exactly once with the dispatcher, then
 * declare no other assertion (`expectNotToPerformAssertions()`). There is no
 * mocking library here, so both are adapted to a hand-written subscriber that
 * records its own call count and argument instead of a `Mockery` expectation --
 * same two entry points (`subscribe(string)` resolved through the container,
 * and `subscribe(object)` passed directly), same "called once, with the
 * dispatcher" assertion, just observed through a plain counter rather than a
 * mock framework.
 */
export = (): void => {
    describe("Dispatcher::subscribe()", () => {
        it("subscribe(Abstract) resolves the subscriber through the container and calls subscribe() once (adapted -- see class comment)", () => {
            // PHP: EventsSubscriberTest::testEventSubscribers
            let subscribeCallCount = 0;
            let subscribeArg: unknown;

            class ExampleSubscriber {
                public subscribe(e: unknown): string {
                    subscribeCallCount++;
                    subscribeArg = e;

                    // There would be no error if a non-array is returned.
                    return "(O_o)";
                }
            }

            const container = new Container();
            container.bind("ExampleSubscriber", ExampleSubscriber);
            const d = new Dispatcher(container);

            d.subscribe("ExampleSubscriber");

            expect(subscribeCallCount).to.equal(1);
            expect(subscribeArg).to.equal(d);
        });

        it("subscribe(object) calls subscribe() once on the given instance (adapted -- see class comment)", () => {
            // PHP: EventsSubscriberTest::testEventSubscribeCanAcceptObject
            let subscribeCallCount = 0;
            let subscribeArg: unknown;

            class ExampleSubscriber {
                public subscribe(e: unknown): string {
                    subscribeCallCount++;
                    subscribeArg = e;

                    return "(O_o)";
                }
            }

            const d = new Dispatcher();
            const subs = new ExampleSubscriber();

            d.subscribe(subs);

            expect(subscribeCallCount).to.equal(1);
            expect(subscribeArg).to.equal(d);
        });

        it("subscribe() registers every [event, Class@method] pair returned by subscribe()", () => {
            // PHP: EventsSubscriberTest::testEventSubscribeCanReturnMappings
            let str = "";

            class DeclarativeSubscriber {
                public subscribe(): Array<[string, Array<string>]> {
                    return [
                        ["myEvent1", ["DeclarativeSubscriber@listener1", "DeclarativeSubscriber@listener2"]],
                        ["myEvent2", ["DeclarativeSubscriber@listener3"]],
                    ];
                }

                public listener1(): void {
                    str += "L1_";
                }

                public listener2(): void {
                    str += "L2_";
                }

                public listener3(): void {
                    str += "L3";
                }
            }

            const container = new Container();
            container.bind("DeclarativeSubscriber", DeclarativeSubscriber);
            const d = new Dispatcher(container);
            d.subscribe("DeclarativeSubscriber");

            d.dispatch("myEvent1");
            expect(str).to.equal("L1_L2_");

            d.dispatch("myEvent2");
            expect(str).to.equal("L1_L2_L3");
        });
    });
};
