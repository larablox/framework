/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../TestHelpers';
import { Container } from 'Illuminate/Container/Container';
import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import type { Abstract, ParameterList } from 'Illuminate/Container/Types';

/**
 * PHP: `Illuminate\Tests\Events\EventsDispatcherTest`.
 *
 * Upstream stashes everything a listener observes into `$_SERVER['__event.test']`,
 * a superglobal that survives across closures without being captured. There is no
 * such global here (`CLAUDE.md`: no Node/DOM APIs, and PHP superglobals have no
 * analogue at all), so every test below uses a local mutable variable captured by
 * the listener closures instead -- same shape, same assertions, no shared state
 * between tests.
 *
 * Not ported, no equivalent in this port:
 * - `testEventDispatchesUsingNamedArguments`: exercises
 *   `Illuminate\Foundation\Events\Dispatchable` (a *different* trait from the
 *   `Illuminate\Foundation\Bus\Dispatchable` this port ships, see
 *   `Foundation/Bus/Dispatchable.ts`) together with PHP named constructor
 *   arguments and a `Mockery`-mocked `Dispatcher` bound into
 *   `Container::getInstance()`. None of the three exist here: no
 *   `Foundation\Events\Dispatchable`, no named arguments, no mocking library to
 *   stand a fake in for the dispatcher itself (unlike a fake queue or handler,
 *   mocking the class under test is not something a hand-written fake can
 *   reasonably stand in for without duplicating `Dispatcher` itself).
 *
 * `testContainerResolutionOfEventHandlers` (asserts `Container::make()` is
 * called exactly once, via a `Mockery`-mocked `Container`) and
 * `testContainerResolutionOfEventHandlersWithDefaultMethods` (the same
 * dispatch, but through a real `Container`) are merged into the single test
 * below using a real `Container` subclass that counts `make()` calls --
 * `Container::make` is a plain overridable method here, so that call count is
 * observable without a mocking library, and the two upstream tests were
 * already dispatching the exact same event through the exact same listener.
 */
export = (): void => {
    describe('Dispatcher', () => {
        it('fires listeners in registration order, including ones added after the first dispatch', () => {
            // PHP: EventsDispatcherTest::testBasicEventExecution
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo', (foo: string) => {
                eventTest = foo;
            });
            const response = d.dispatch('foo', ['bar']);

            expectDeepEqual(response as Array<defined>, []);
            expect(eventTest).to.equal('bar');

            // we can still add listeners after the event has fired
            d.listen('foo', (foo: string) => {
                eventTest = (eventTest as string) + foo;
            });

            d.dispatch('foo', ['bar']);
            expect(eventTest).to.equal('barbar');
        });

        it('defer() holds dispatched events back until the callback returns', () => {
            // PHP: EventsDispatcherTest::testDeferEventExecution
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo', (foo: string) => {
                eventTest = foo;
            });

            const result = d.defer(() => {
                d.dispatch('foo', ['bar']);
                expect(eventTest).to.equal(undefined);

                return 'callback_result';
            });

            expect(result).to.equal('callback_result');
            expect(eventTest).to.equal('bar');
        });

        it('defer() holds back every deferred event name', () => {
            // PHP: EventsDispatcherTest::testDeferMultipleEvents
            const eventTest = new Array<string>();
            const d = new Dispatcher();
            d.listen('foo', (value: string) => {
                eventTest.push(value);
            });
            d.listen('bar', (value: string) => {
                eventTest.push(value);
            });
            d.defer(() => {
                d.dispatch('foo', ['foo']);
                d.dispatch('bar', ['bar']);
                expectDeepEqual(eventTest as Array<defined>, []);
            });

            expectDeepEqual(eventTest as Array<defined>, ['foo', 'bar']);
        });

        it('nested defer() calls flush inner-first', () => {
            // PHP: EventsDispatcherTest::testDeferNestedEvents
            const eventTest = new Array<string>();
            const d = new Dispatcher();
            d.listen('foo', (foo: string) => {
                eventTest.push(foo);
            });

            d.defer(() => {
                d.dispatch('foo', ['outer1']);

                d.defer(() => {
                    d.dispatch('foo', ['inner']);
                    expectDeepEqual(eventTest as Array<defined>, []);
                });

                expectDeepEqual(eventTest as Array<defined>, ['inner']);
                d.dispatch('foo', ['outer2']);
            });

            expectDeepEqual(eventTest as Array<defined>, ['inner', 'outer1', 'outer2']);
        });

        it('defer() with an event-name list only holds back those events', () => {
            // PHP: EventsDispatcherTest::testDeferSpecificEvents
            const eventTest = new Array<string>();
            const d = new Dispatcher();

            d.listen('foo', (foo: string) => {
                eventTest.push(foo);
            });

            d.listen('bar', (bar: string) => {
                eventTest.push(bar);
            });

            d.defer(() => {
                d.dispatch('foo', ['deferred']);
                d.dispatch('bar', ['immediate']);

                expectDeepEqual(eventTest as Array<defined>, ['immediate']);
            }, ['foo']);

            expectDeepEqual(eventTest as Array<defined>, ['immediate', 'deferred']);
        });

        it('nested defer() with event-name lists compose correctly', () => {
            // PHP: EventsDispatcherTest::testDeferSpecificNestedEvents
            const eventTest = new Array<string>();
            const d = new Dispatcher();

            d.listen('foo', (foo: string) => {
                eventTest.push(foo);
            });

            d.listen('bar', (bar: string) => {
                eventTest.push(bar);
            });

            d.defer(() => {
                d.dispatch('foo', ['outer-deferred']);
                d.dispatch('bar', ['outer-immediate']);

                expectDeepEqual(eventTest as Array<defined>, ['outer-immediate']);

                d.defer(() => {
                    d.dispatch('foo', ['inner-deferred']);
                    d.dispatch('bar', ['inner-immediate']);

                    expectDeepEqual(eventTest as Array<defined>, ['outer-immediate', 'inner-immediate']);
                }, ['foo']);

                expectDeepEqual(eventTest as Array<defined>, ['outer-immediate', 'inner-immediate', 'inner-deferred']);
            }, ['foo']);

            expectDeepEqual(eventTest as Array<defined>, [
                'outer-immediate',
                'inner-immediate',
                'inner-deferred',
                'outer-deferred',
            ]);
        });

        it('defer() with an event-name list holds back object events too', () => {
            // PHP: EventsDispatcherTest::testDeferSpecificObjectEvents
            class DeferTestEvent
            {}
            class ImmediateTestEvent
            {}

            const eventTest = new Array<string>();
            const d = new Dispatcher();

            d.listen(DeferTestEvent, () => {
                eventTest.push('DeferTestEvent');
            });

            d.listen(ImmediateTestEvent, () => {
                eventTest.push('ImmediateTestEvent');
            });

            d.defer(() => {
                d.dispatch(new DeferTestEvent());
                d.dispatch(new ImmediateTestEvent());

                expectDeepEqual(eventTest as Array<defined>, ['ImmediateTestEvent']);
            }, [DeferTestEvent]);

            expectDeepEqual(eventTest as Array<defined>, ['ImmediateTestEvent', 'DeferTestEvent']);
        });

        it('dispatch(halt=true)/until() stop at the first non-undefined response', () => {
            // PHP: EventsDispatcherTest::testHaltingEventExecution
            const d = new Dispatcher();
            d.listen('foo', () => 'here');
            d.listen('foo', () => {
                throw 'should not be called';
            });

            let response = d.dispatch('foo', ['bar'], true);
            expect(response).to.equal('here');

            response = d.until('foo', ['bar']);
            expect(response).to.equal('here');
        });

        it('dispatch() with no listeners returns an empty response list, or undefined when halting', () => {
            // PHP: EventsDispatcherTest::testResponseWhenNoListenersAreSet
            const d = new Dispatcher();
            let response = d.dispatch('foo');

            expectDeepEqual(response as Array<defined>, []);

            response = d.dispatch('foo', [], true);
            expect(response).to.equal(undefined);
        });

        it('a listener returning false stops propagation to later listeners', () => {
            // PHP: EventsDispatcherTest::testReturningFalseStopsPropagation
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo', (foo: string) => foo);

            d.listen('foo', (foo: string) => {
                eventTest = foo;

                return false;
            });

            d.listen('foo', () => {
                throw 'should not be called';
            });

            const response = d.dispatch('foo', ['bar']);

            expect(eventTest).to.equal('bar');
            expectDeepEqual(response as Array<defined>, ['bar']);
        });

        it('falsy-but-not-false responses do not stop propagation (adapted -- see below)', () => {
            // PHP: EventsDispatcherTest::testReturningFalsyValuesContinuesPropagation
            //
            // PHP's response list ends up `[0, [], '', null]` -- a Luau array
            // cannot hold `nil`, so the trailing `null`/no-return entry
            // contributes nothing to the response array here (see
            // `Dispatcher.invokeListeners()`'s class comment). The three
            // falsy-but-defined values (`0`, an empty array, an empty string)
            // still propagate and collect exactly as upstream.
            const d = new Dispatcher();
            d.listen('foo', () => 0);
            d.listen('foo', () => new Array<unknown>());
            d.listen('foo', () => '');
            d.listen('foo', () => {
                //
            });

            const response = d.dispatch('foo', ['bar']);

            expectDeepEqual(response as Array<defined>, [0, [], '']);
        });

        it('a Class@method listener string resolves the class through the container (adapted -- see class comment)', () => {
            // PHP: EventsDispatcherTest::testContainerResolutionOfEventHandlers +
            // EventsDispatcherTest::testContainerResolutionOfEventHandlersWithDefaultMethods
            class TestEventListener
            {
                public handle(): string
                {
                    return 'baz';
                }

                public onFooEvent(): string
                {
                    return 'baz';
                }
            }

            let makeCallCount = 0;
            class CountingContainer extends Container
            {
                public make(abstract: Abstract, parameters?: ParameterList): unknown
                {
                    makeCallCount++;

                    return super.make(abstract, parameters);
                }
            }

            const container = new CountingContainer();
            container.bind('TestEventListener', TestEventListener);
            const d = new Dispatcher(container);
            d.listen('foo', 'TestEventListener@onFooEvent');
            const response = d.dispatch('foo', ['foo', 'bar']);

            expectDeepEqual(response as Array<defined>, ['baz']);
            expect(makeCallCount).to.equal(1);

            // Default `handle` method, no explicit `@method` suffix.
            const d2 = new Dispatcher(new Container());
            d2.listen('foo', TestEventListener);
            const response2 = d2.dispatch('foo', ['foo', 'bar']);
            expectDeepEqual(response2 as Array<defined>, ['baz']);
        });

        it('push()/flush() replay a pushed event through every listener registered by flush time', () => {
            // PHP: EventsDispatcherTest::testQueuedEventsAreFired
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('update', (name: string) => {
                eventTest = name;
            });
            d.push('update', ['taylor']);
            d.listen('update', (name: string) => {
                eventTest = (eventTest as string) + '_' + name;
            });

            expect(eventTest).to.equal(undefined);
            d.flush('update');
            d.listen('update', (name: string) => {
                eventTest = (eventTest as string) + name;
            });
            expect(eventTest).to.equal('taylor_taylor');
        });

        it('forgetPushed() drops pushed events before they are flushed', () => {
            // PHP: EventsDispatcherTest::testQueuedEventsCanBeForgotten
            let eventTest = 'unset';
            const d = new Dispatcher();
            d.push('update', ['taylor']);
            d.listen('update', (name: string) => {
                eventTest = name;
            });

            d.forgetPushed();
            d.flush('update');
            expect(eventTest).to.equal('unset');
        });

        it('multiple pushes for the same event all replay on flush()', () => {
            // PHP: EventsDispatcherTest::testMultiplePushedEventsWillGetFlushed
            let eventTest = '';
            const d = new Dispatcher();
            d.push('update', ['taylor ']);
            d.push('update', ['otwell']);
            d.listen('update', (name: string) => {
                eventTest += name;
            });

            d.flush('update');
            expect(eventTest).to.equal('taylor otwell');
        });

        it('push() can carry an object payload through to flush()', () => {
            // PHP: EventsDispatcherTest::testPushMethodCanAcceptObjectAsPayload
            //
            // `push()`/`flush()` key their `_pushed` event on a plain string
            // (`push(event: string, ...)`), unlike `listen()`/`dispatch()`
            // which also accept a class reference -- upstream uses
            // `ExampleEvent::class`, itself just a string, for both roles at
            // once. The port keeps that same string as the shared key here.
            class ExampleEvent
            {}

            let eventTest: ExampleEvent | undefined;
            const d = new Dispatcher();
            const e = new ExampleEvent();
            d.push('ExampleEvent', [e]);
            d.listen('ExampleEvent', (payload: ExampleEvent) => {
                eventTest = payload;
            });

            d.flush('ExampleEvent');

            expect(eventTest).to.equal(e);
        });

        it('wildcard listeners fire alongside exact-name listeners', () => {
            // PHP: EventsDispatcherTest::testWildcardListeners
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo.bar', () => {
                eventTest = 'regular';
            });
            d.listen('foo.*', () => {
                eventTest = 'wildcard';
            });
            d.listen('bar.*', () => {
                eventTest = 'nope';
            });

            const response = d.dispatch('foo.bar');

            expectDeepEqual(response as Array<defined>, []);
            expect(eventTest).to.equal('wildcard');
        });

        it("wildcard listener responses collect after the exact-name listener's", () => {
            // PHP: EventsDispatcherTest::testWildcardListenersWithResponses
            const d = new Dispatcher();
            d.listen('foo.bar', () => 'regular');
            d.listen('foo.*', () => 'wildcard');
            d.listen('bar.*', () => 'nope');

            const response = d.dispatch('foo.bar');

            expectDeepEqual(response as Array<defined>, ['regular', 'wildcard']);
        });

        it('wildcard cache picks up newly registered listeners', () => {
            // PHP: EventsDispatcherTest::testWildcardListenersCacheFlushing
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo.*', () => {
                eventTest = 'cached_wildcard';
            });
            d.dispatch('foo.bar');
            expect(eventTest).to.equal('cached_wildcard');

            d.listen('foo.*', () => {
                eventTest = 'new_wildcard';
            });
            d.dispatch('foo.bar');
            expect(eventTest).to.equal('new_wildcard');
        });

        it("forget() removes a plain event's listeners", () => {
            // PHP: EventsDispatcherTest::testListenersCanBeRemoved
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo', () => {
                eventTest = 'foo';
            });
            d.forget('foo');
            d.dispatch('foo');

            expect(eventTest).to.equal(undefined);
        });

        it("forget() removes a wildcard's listeners", () => {
            // PHP: EventsDispatcherTest::testWildcardListenersCanBeRemoved
            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen('foo.*', () => {
                eventTest = 'foo';
            });
            d.forget('foo.*');
            d.dispatch('foo.bar');

            expect(eventTest).to.equal(undefined);
        });

        it('forget() clears the wildcard cache too', () => {
            // PHP: EventsDispatcherTest::testWildcardCacheIsClearedWhenListenersAreRemoved
            let eventTest: string | undefined;

            const d = new Dispatcher();
            d.listen('foo*', () => {
                eventTest = 'foo';
            });
            d.dispatch('foo');

            expect(eventTest).to.equal('foo');

            eventTest = undefined;

            d.forget('foo*');
            d.dispatch('foo');

            expect(eventTest).to.equal(undefined);
        });

        it('hasWildcardListeners() only reports on wildcard registrations', () => {
            // PHP: EventsDispatcherTest::testHasWildcardListeners
            const d = new Dispatcher();
            d.listen('foo', 'listener1');
            expect(d.hasWildcardListeners('foo')).to.equal(false);

            d.listen('foo*', 'listener1');
            expect(d.hasWildcardListeners('foo')).to.equal(true);
        });

        it('hasListeners() reports on a plain event name', () => {
            // PHP: EventsDispatcherTest::testListenersCanBeFound
            const d = new Dispatcher();
            expect(d.hasListeners('foo')).to.equal(false);

            d.listen('foo', () => {
                //
            });
            expect(d.hasListeners('foo')).to.equal(true);
        });

        it('hasListeners() reports on a wildcard, and matches a concrete name against it', () => {
            // PHP: EventsDispatcherTest::testWildcardListenersCanBeFound
            const d = new Dispatcher();
            expect(d.hasListeners('foo.*')).to.equal(false);

            d.listen('foo.*', () => {
                //
            });
            expect(d.hasListeners('foo.*')).to.equal(true);
            expect(d.hasListeners('foo.bar')).to.equal(true);
        });

        it('a wildcard listener receives the event name and the payload array; an exact listener gets the payload spread', () => {
            // PHP: EventsDispatcherTest::testEventPassedFirstToWildcards
            let d = new Dispatcher();
            d.listen('foo.*', (event: string, data: Array<string>) => {
                expect(event).to.equal('foo.bar');
                expectDeepEqual(data as Array<defined>, ['first', 'second']);
            });
            d.dispatch('foo.bar', ['first', 'second']);

            d = new Dispatcher();
            d.listen('foo.bar', (first: string, second: string) => {
                expect(first).to.equal('first');
                expect(second).to.equal('second');
            });
            d.dispatch('foo.bar', ['first', 'second']);
        });

        it('a class event dispatches by its own class name', () => {
            // PHP: EventsDispatcherTest::testClassesWork
            class ExampleEvent
            {}

            let eventTest: string | undefined;
            const d = new Dispatcher();
            d.listen(ExampleEvent, () => {
                eventTest = 'baz';
            });
            d.dispatch(new ExampleEvent());

            expect(eventTest).to.equal('baz');
        });

        it('dispatching a class event with no explicit payload hands the event itself as the payload', () => {
            // PHP: EventsDispatcherTest::testEventClassesArePayload
            class ExampleEvent
            {}

            let eventTest: ExampleEvent | undefined;
            const d = new Dispatcher();
            d.listen(ExampleEvent, (payload: ExampleEvent) => {
                eventTest = payload;
            });
            const e = new ExampleEvent();
            d.dispatch(e, ['foo']);

            expect(eventTest).to.equal(e);
        });

        // `testClassesWorkWithAnonymousListeners` is not ported: upstream derives
        // the event name from the closure's typed first parameter
        // (`function (ExampleEvent $event) {...}`) via `listen()`'s single-argument
        // form. Parameter types do not survive compilation and this port's
        // `listen()` always requires the event to be named explicitly (see
        // `Dispatcher.listen()`'s doc comment) -- there is no closure-only form
        // left to exercise.

        // `testInterfacesWork` / `testBothClassesAndInterfacesWork` are adapted
        // into the class-hierarchy test below: PHP walks `class_implements()` to
        // reach a listener registered on an event's *interface*
        // (`SomeEventInterface`). Interfaces are erased in this port, and
        // `Dispatcher.addInterfaceListeners()` walks the event's *class* chain
        // instead (see its doc comment and `agent_docs/laravel-parity.md`'s
        // "Events: слушатели вверх по иерархии") -- a listener on a base class
        // fires for a subclass, the closest surviving analogue.
        it('a listener registered on a base event class also fires for a subclass (adapted -- see class comment)', () => {
            const eventTest = new Array<defined>();
            let eventTest1: string | undefined;
            let eventTest2: string | undefined;

            class SomeBaseEvent
            {}
            class AnotherEvent extends SomeBaseEvent
            {}

            const d = new Dispatcher();
            d.listen(AnotherEvent, (p: unknown) => {
                eventTest.push(p as defined);
                eventTest1 = 'fooo';
            });
            d.listen(SomeBaseEvent, (p: unknown) => {
                eventTest.push(p as defined);
                eventTest2 = 'baar';
            });
            const e = new AnotherEvent();
            d.dispatch(e, ['foo']);

            expect(eventTest[0]).to.equal(e);
            expect(eventTest[1]).to.equal(e);
            expect(eventTest1).to.equal('fooo');
            expect(eventTest2).to.equal('baar');
        });

        it('a listener registered inside a listener does not fire until the next dispatch', () => {
            // PHP: EventsDispatcherTest::testNestedEvent
            const eventTest = new Array<string>();
            const d = new Dispatcher();

            d.listen('event', () => {
                d.listen('event', () => {
                    eventTest.push('fired 1');
                });
                d.listen('event', () => {
                    eventTest.push('fired 2');
                });
            });

            d.dispatch('event');
            expectDeepEqual(eventTest as Array<defined>, []);
            d.dispatch('event');
            expectDeepEqual(eventTest as Array<defined>, ['fired 1', 'fired 2']);
        });

        it('the same class listener registered twice fires twice', () => {
            // PHP: EventsDispatcherTest::testDuplicateListenersWillFire
            class TestListener
            {
                public static counter = 0;

                public handle(): void
                {
                    TestListener.counter++;
                }
            }

            const container = new Container();
            container.bind('TestListener', TestListener);
            const d = new Dispatcher(container);
            d.listen('event', TestListener);
            d.listen('event', TestListener);
            d.listen('event', 'TestListener@handle');
            d.listen('event', 'TestListener@handle');
            d.dispatch('event');

            expect(TestListener.counter).to.equal(4);
        });

        it('getListeners() counts every registered listener for an event', () => {
            // PHP: EventsDispatcherTest::testGetListeners
            class ExampleEvent
            {}

            const d = new Dispatcher();
            d.listen(ExampleEvent, 'Listener1');
            d.listen(ExampleEvent, 'Listener2');
            let listeners = d.getListeners(ExampleEvent);
            expect(listeners.size()).to.equal(2);

            d.listen(ExampleEvent, 'Listener3');
            listeners = d.getListeners(ExampleEvent);
            expect(listeners.size()).to.equal(3);
        });

        it('class listeners are built lazily, one per dispatch, in registration order', () => {
            // PHP: EventsDispatcherTest::testListenersObjectsCreationOrder
            const eventTest = new Array<string>();

            class TestListener1
            {
                public constructor()
                {
                    eventTest.push('cons-1');
                }

                public handle(): string
                {
                    eventTest.push('handle-1');

                    return 'resp-1';
                }
            }

            class TestListener2
            {
                public constructor()
                {
                    eventTest.push('cons-2');
                }

                public handle(): string
                {
                    eventTest.push('handle-2');

                    return 'resp-2';
                }
            }

            class TestListener3
            {
                public constructor()
                {
                    eventTest.push('cons-3');
                }

                public handle(): void
                {
                    eventTest.push('handle-3');
                }
            }

            const d = new Dispatcher();
            d.listen('TestEvent', TestListener1);
            d.listen('TestEvent', TestListener2);
            d.listen('TestEvent', TestListener3);

            // Attaching events does not make any objects.
            expectDeepEqual(eventTest as Array<defined>, []);

            d.dispatch('TestEvent');

            // Dispatching event does not make an object of the event class.
            expectDeepEqual(eventTest as Array<defined>, [
                'cons-1',
                'handle-1',
                'cons-2',
                'handle-2',
                'cons-3',
                'handle-3',
            ]);

            d.dispatch('TestEvent');

            // Event Objects are re-resolved on each dispatch. (No memoization)
            expectDeepEqual(eventTest as Array<defined>, [
                'cons-1',
                'handle-1',
                'cons-2',
                'handle-2',
                'cons-3',
                'handle-3',
                'cons-1',
                'handle-1',
                'cons-2',
                'handle-2',
                'cons-3',
                'handle-3',
            ]);
        });

        it('listener object creation is lazy: only listeners for the dispatched event are ever built', () => {
            // PHP: EventsDispatcherTest::test_Listener_object_creation_is_lazy
            let eventTest = new Array<string>();

            class TestListener1
            {
                public constructor()
                {
                    eventTest.push('cons-1');
                }

                public handle(): string
                {
                    eventTest.push('handle-1');

                    return 'resp-1';
                }
            }

            class TestListener2Falser
            {
                public constructor()
                {
                    eventTest.push('cons-2-falser');
                }

                public handle(): boolean
                {
                    eventTest.push('handle-2-falser');

                    return false;
                }
            }

            class TestListener3
            {
                public constructor()
                {
                    eventTest.push('cons-3');
                }

                public handle(): string
                {
                    eventTest.push('handle-3');

                    return 'resp-3';
                }
            }

            class TestListener2
            {
                public constructor()
                {
                    eventTest.push('cons-2');
                }

                public handle(): string
                {
                    eventTest.push('handle-2');

                    return 'resp-2';
                }
            }

            let d = new Dispatcher();
            d.listen('TestEvent', TestListener1);
            d.listen('TestEvent', TestListener2Falser);
            d.listen('TestEvent', TestListener3);
            d.listen('ExampleEvent', TestListener2);

            eventTest = new Array<string>();
            d.dispatch('ExampleEvent');

            // It only resolves relevant listeners not all.
            expectDeepEqual(eventTest as Array<defined>, ['cons-2', 'handle-2']);

            eventTest = new Array<string>();
            d.dispatch('TestEvent');

            expectDeepEqual(eventTest as Array<defined>, ['cons-1', 'handle-1', 'cons-2-falser', 'handle-2-falser']);

            d = new Dispatcher();
            d.listen('TestEvent', TestListener1);
            d.listen('TestEvent', TestListener2Falser);
            d.listen('TestEvent', TestListener3);

            eventTest = new Array<string>();
            d.dispatch('TestEvent', undefined, true);

            expectDeepEqual(eventTest as Array<defined>, ['cons-1', 'handle-1']);
        });

        it('only handle() is called when a listener declares both handle() and __invoke() (adapted -- see below)', () => {
            // PHP: EventsDispatcherTest::testInvokeIsCalled (first two cases)
            //
            // Luau has no `__invoke` magic method, so the "falls back to
            // __invoke" and "throws when neither exists" halves of upstream
            // (its third and fourth cases) have no analogue -- a listener class
            // here is always called through a named method, `handle` by
            // default (`Dispatcher.parseClassCallable()`), and a missing
            // method is simply never reached the way `__invoke` would be.
            let eventTest = new Array<string>();

            class TestListenerHandler
            {
                public constructor()
                {
                    eventTest.push('__construct');
                }

                public handle(): void
                {
                    eventTest.push('handle');
                }
            }

            const d = new Dispatcher();
            d.listen('myEvent', TestListenerHandler);
            d.dispatch('myEvent');
            expectDeepEqual(eventTest as Array<defined>, ['__construct', 'handle']);

            eventTest = new Array<string>();
        });
    });
};
