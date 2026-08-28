/// <reference types="@rbxts/testez/globals" />
import { expectThrows } from '../TestHelpers';
import { Container } from 'Illuminate/Container/Container';
import { ContainerContract } from 'Illuminate/Contracts/Container/Container';
import { Pipeline } from 'Illuminate/Pipeline/Pipeline';
import { RuntimeException } from 'Illuminate/Exception';
import type { Next } from 'Illuminate/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Tests\Pipeline\PipelineTestPipeOne` (module-level, not a
 * mock). Upstream stashes what it received in `$_SERVER['__test.pipe.one']`,
 * a superglobal with no Luau equivalent; here it is an instance property
 * instead, read back by the test after `then()`/`thenReturn()` runs. Every
 * pipe class in this file follows the same pattern -- see the class comment
 * below for why a handle to the instance is still available even for the
 * tests that hand `Pipeline` the class itself, not `new PipelineTestPipeOne`.
 */
class PipelineTestPipeOne
{
    public received?: unknown;

    public handle(piped: unknown, _next: Next): unknown
    {
        this.received = piped;

        return _next(piped);
    }

    public differentMethod(piped: unknown, _next: Next): unknown
    {
        return _next(piped);
    }
}

/** PHP: `Illuminate\Tests\Pipeline\PipelineTestParameterPipe`. */
class PipelineTestParameterPipe
{
    public parameters?: [string | undefined, string | undefined];

    public handle(piped: unknown, _next: Next, parameter1?: string, parameter2?: string): unknown
    {
        this.parameters = [
            parameter1,
            parameter2,
        ];

        return _next(piped);
    }
}

/**
 * PHP: `Illuminate\Tests\Pipeline\PipelineTest`.
 *
 * Not ported:
 *
 * - `testPipelineThrowsExceptionWhenUsingTransactionsWithoutContainer` --
 *   `withinTransaction()` is not ported (`Pipeline.ts`'s class comment: it
 *   wraps the run in a database transaction, and there is no database).
 * - `testPipelineConditionable` -- upstream's `Pipeline` mixes in
 *   `Conditionable` for `when()`/`unless()`; this port's `Pipeline` does not
 *   (`Pipeline.ts` has no `Conditionable` mixin), so there is no `when()` to
 *   call.
 * - `testPipelineUsageWithInvokableObjects`, `testPipelineUsageWithInvokableClass`
 *   -- upstream's `Pipeline::carry()` checks `is_callable($pipe)` *before*
 *   falling back to `method_exists($pipe, $this->method)`, so an object whose
 *   only entry point is `__invoke()` (`PipelineTestPipeTwo`) still runs. This
 *   port's `Pipeline.callPipe()` has no such fallback -- a resolved or
 *   already-an-instance pipe always calls `this.method` (default `"handle"")
 *   and throws `RuntimeException` if it is missing, with no invokable-object
 *   path (there is no `__invoke`/`__call` equivalent to dispatch through).
 *   `PipelineTestPipeTwo` (which declares only `__invoke`, no `handle`) has
 *   no faithful equivalent here, so neither test is ported.
 *
 * `testPipelineUsageWithParameters` is adapted, not skipped: upstream spells
 * the pipe as `PipelineTestParameterPipe::class . ':one,two'` -- legal only
 * because a PHP class name already is a string, so a colon-suffix can be
 * appended to it directly. A roblox-ts class is not a string (see
 * `CLAUDE.md`'s Pipeline note and `Pipeline.parsePipeString()`'s own
 * comment), so there is nothing to append the suffix to. The mechanism under
 * test -- a string pipe of the form `"name:param1,param2"`, resolved from the
 * container and called with the parsed parameters appended -- is otherwise
 * unchanged and still exercised end to end below, just against a container
 * key chosen for the test instead of a stringified class name.
 *
 * Several tests below hand `Pipeline` a pipe *class* (e.g. `PipelineTestPipeOne`,
 * not `new PipelineTestPipeOne`), the same as upstream's `PipelineTestPipeOne::class`
 * -- `Pipeline` resolves it from the container itself. Upstream can still read
 * back what that resolved instance received because `$_SERVER` is global; this
 * port pre-registers the instance the container will hand back via
 * `container.instance(PipelineTestPipeOne, pipeOne)` (see `ContainerExtend.spec.ts`
 * for the same technique), which keeps `Pipeline` on the exact "resolve a class
 * from the container" code path while still giving the test a handle to inspect.
 */
export = (): void => {
    describe('Pipeline', () => {
        it('runs a class pipe resolved from the container, then a closure pipe', () => {
            // PHP: PipelineTest::testPipelineBasicUsage
            const container = new Container();
            const pipeOne = new PipelineTestPipeOne();
            container.instance(PipelineTestPipeOne, pipeOne);

            let pipeTwoReceived: unknown;
            const pipeTwo = (piped: unknown, _next: Next) => {
                pipeTwoReceived = piped;

                return _next(piped);
            };

            const result = new Pipeline(container)
                .send('foo')
                .through([
                    PipelineTestPipeOne,
                    pipeTwo,
                ])
                .then((piped) => piped);

            expect(result).to.equal('foo');
            expect(pipeOne.received).to.equal('foo');
            expect(pipeTwoReceived).to.equal('foo');
        });

        it('runs an already-constructed pipe object', () => {
            // PHP: PipelineTest::testPipelineUsageWithObjects
            const pipeOne = new PipelineTestPipeOne();

            const result = new Pipeline(new Container())
                .send('foo')
                .through([pipeOne])
                .then((piped) => piped);

            expect(result).to.equal('foo');
            expect(pipeOne.received).to.equal('foo');
        });

        it('accepts a bare callable, wrapped in an array or passed directly', () => {
            // PHP: PipelineTest::testPipelineUsageWithCallable
            let pipeOneCalled: string | undefined;
            const fn = (piped: unknown, _next: Next) => {
                pipeOneCalled = 'foo';

                return _next(piped);
            };

            const result = new Pipeline(new Container())
                .send('foo')
                .through([fn])
                .then((piped) => piped);

            expect(result).to.equal('foo');
            expect(pipeOneCalled).to.equal('foo');

            pipeOneCalled = undefined;

            const result2 = new Pipeline(new Container()).send('bar').through(fn).thenReturn();

            expect(result2).to.equal('bar');
            expect(pipeOneCalled).to.equal('foo');
        });

        it('pipe() appends pipes onto the ones set by through()', () => {
            // PHP: PipelineTest::testPipelineUsageWithPipe
            const object = { value: 0 };
            const fn = (obj: typeof object, _next: Next) => {
                obj.value++;

                return _next(obj);
            };

            const result = new Pipeline(new Container())
                .send(object)
                .through([fn])
                .pipe([fn])
                .then((piped) => piped);

            expect(result).to.equal(object);
            expect(object.value).to.equal(2);
        });

        it('through() and pipe() accept pipes as separate arguments', () => {
            // No upstream twin: upstream's tests always pass an array or a
            // single pipe, but `through($a, $b)` is legal there through
            // `func_get_args()` -- this pins the rest-parameter equivalent.
            const object = { value: 0 };
            const fn = (obj: typeof object, _next: Next) => {
                obj.value++;

                return _next(obj);
            };

            const result = new Pipeline(new Container())
                .send(object)
                .through(fn, fn)
                .pipe(fn, fn)
                .then((piped) => piped);

            expect(result).to.equal(object);
            expect(object.value).to.equal(4);
        });

        it('through() overwrites previously set and appended pipes', () => {
            // PHP: PipelineTest::testPipelineThroughMethodOverwritesPreviouslySetAndAppendedPipes
            const object = { value: 0 };
            const fn = (obj: typeof object, _next: Next) => {
                obj.value++;

                return _next(obj);
            };

            const result = new Pipeline(new Container())
                .send(object)
                .through([fn])
                .pipe([fn])
                .through([fn])
                .then((piped) => piped);

            expect(result).to.equal(object);
            expect(object.value).to.equal(1);
        });

        it('then() and the remaining pipes are not called once a pipe returns without calling next()', () => {
            // PHP: PipelineTest::testThenMethodIsNotCalledIfThePipeReturns
            let thenCalled = '(*_*)';
            let secondCalled = '(*_*)';

            const result = new Pipeline(new Container())
                .send('foo')
                .through([
                    (): string => 'm(-_-)m',
                    (): string => (secondCalled = 'm(-_-)m'),
                ])
                .then((piped) => {
                    thenCalled = '(0_0)';

                    return piped;
                });

            expect(result).to.equal('m(-_-)m');
            expect(thenCalled).to.equal('(*_*)');
            expect(secondCalled).to.equal('(*_*)');
        });

        it('then() receives whatever a pipe passed to next(), not the original passable', () => {
            // PHP: PipelineTest::testThenMethodInputValue
            let thenArg: unknown;

            const result = new Pipeline(new Container())
                .send('foo')
                .through([
                    (value: unknown, _next: Next) => {
                        const returned = _next('::not_foo::');

                        return `pipe::${returned}`;
                    },
                ])
                .then((piped) => {
                    thenArg = piped;

                    return `then${piped}`;
                });

            expect(result).to.equal('pipe::then::not_foo::');
            expect(thenArg).to.equal('::not_foo::');
        });

        it('resolves a string pipe with colon-separated parameters', () => {
            // PHP: PipelineTest::testPipelineUsageWithParameters (adapted -- see class comment)
            const container = new Container();
            const parameterPipe = new PipelineTestParameterPipe();
            container.instance('parameter-pipe', parameterPipe);

            const result = new Pipeline(container)
                .send('foo')
                .through('parameter-pipe:one,two')
                .then((piped) => piped);

            expect(result).to.equal('foo');
            expect(parameterPipe.parameters?.[0]).to.equal('one');
            expect(parameterPipe.parameters?.[1]).to.equal('two');
        });

        it('resolves a class pipe carrying its parameters as a list', () => {
            // The list form of PipelineTest::testPipelineUsageWithParameters:
            // [Class, 'one', 'two'] is what 'Class:one,two' says in PHP,
            // where a class is a string to begin with -- see
            // parsePipeString() and Pipeline/helpers.ts.
            const container = new Container();
            const parameterPipe = new PipelineTestParameterPipe();
            container.instance(PipelineTestParameterPipe, parameterPipe);

            const result = new Pipeline(container)
                .send('foo')
                .through([
                    PipelineTestParameterPipe,
                    'one',
                    'two',
                ])
                .then((piped) => piped);

            expect(result).to.equal('foo');
            expect(parameterPipe.parameters?.[0]).to.equal('one');
            expect(parameterPipe.parameters?.[1]).to.equal('two');
        });

        it('via() changes the method called on the pipes', () => {
            // PHP: PipelineTest::testPipelineViaChangesTheMethodBeingCalledOnThePipes
            const pipelineInstance = new Pipeline(new Container());
            const result = pipelineInstance
                .send('data')
                .through(PipelineTestPipeOne)
                .via('differentMethod')
                .then((piped) => piped);

            expect(result).to.equal('data');
        });

        it('throws when resolving a pipe without a container', () => {
            // PHP: PipelineTest::testPipelineThrowsExceptionOnResolveWithoutContainer
            const [ok, err] = pcall(() =>
                new Pipeline()
                    .send('data')
                    .through(PipelineTestPipeOne)
                    .then((piped) => piped)
            );

            expect(ok).to.equal(false);
            expect(err instanceof RuntimeException).to.equal(true);
            expect((err as RuntimeException).getMessage()).to.equal(
                'A container instance has not been passed to the Pipeline.',
            );
        });

        it('receives the container when resolved from one', () => {
            // No upstream twin: pins @Inject(ContainerContract) as the port's
            // spelling of the reflected `?Container` hint. In Laravel,
            // $app->make(Pipeline::class) hands the pipeline the resolving
            // container through reflection, so a class pipe still resolves --
            // without the hint this port built a container-less pipeline that
            // failed on the first class pipe.
            const container = new Container();
            container.instance(ContainerContract, container);

            const pipeOne = new PipelineTestPipeOne();
            container.instance(PipelineTestPipeOne, pipeOne);

            const result = container.make(Pipeline)
                .send('foo')
                .through(PipelineTestPipeOne)
                .then((piped) => piped);

            expect(result).to.equal('foo');
            expect(pipeOne.received).to.equal('foo');
        });

        it('thenReturn() runs the pipeline and returns the passable', () => {
            // PHP: PipelineTest::testPipelineThenReturnMethodRunsPipelineThenReturnsPassable
            const container = new Container();
            const pipeOne = new PipelineTestPipeOne();
            container.instance(PipelineTestPipeOne, pipeOne);

            const result = new Pipeline(container).send('foo').through([PipelineTestPipeOne]).thenReturn();

            expect(result).to.equal('foo');
            expect(pipeOne.received).to.equal('foo');
        });

        it('finally() runs after then(), seeing the original passable', () => {
            // PHP: PipelineTest::testPipelineFinally
            const container = new Container();
            const pipeOne = new PipelineTestPipeOne();
            container.instance(PipelineTestPipeOne, pipeOne);

            let pipeTwoReceived: unknown;
            // Matches upstream's closure exactly: it calls `next()` but does
            // not `return` its result, so the pipeline's overall result ends
            // up `undefined` (PHP: `null`) -- see the assertion below.
            const pipeTwo = (piped: unknown, _next: Next) => {
                pipeTwoReceived = piped;
                _next(piped);
            };

            let finallyReceived: unknown;
            const result = new Pipeline(container)
                .send('foo')
                .through([
                    PipelineTestPipeOne,
                    pipeTwo,
                ])
                .finally((piped) => {
                    finallyReceived = piped;
                })
                .then((piped) => piped);

            expect(result).to.equal(undefined);
            expect(pipeOne.received).to.equal('foo');
            expect(pipeTwoReceived).to.equal('foo');
            expect(finallyReceived).to.equal('foo');
        });

        it('finally() still runs when a pipe stops the chain without calling _next()', () => {
            // PHP: PipelineTest::testPipelineFinallyMethodWhenChainIsStopped
            const container = new Container();
            const pipeOne = new PipelineTestPipeOne();
            container.instance(PipelineTestPipeOne, pipeOne);

            let pipeTwoReceived: unknown;
            const pipeTwo = (piped: unknown) => {
                pipeTwoReceived = piped;
            };

            let finallyReceived: unknown;
            const result = new Pipeline(container)
                .send('foo')
                .through([
                    PipelineTestPipeOne,
                    pipeTwo,
                ])
                .finally((piped) => {
                    finallyReceived = piped;
                })
                .then((piped) => piped);

            expect(result).to.equal(undefined);
            expect(pipeOne.received).to.equal('foo');
            expect(pipeTwoReceived).to.equal('foo');
            expect(finallyReceived).to.equal('foo');
        });

        it('finally() runs after every pipe and then(), in order', () => {
            // PHP: PipelineTest::testPipelineFinallyOrder
            const std = { value: 0 };

            const result = new Pipeline(new Container())
                .send(std)
                .through([
                    (record: typeof std, _next: Next) => {
                        record.value = 1;

                        return _next(record);
                    },
                    (record: typeof std, _next: Next) => {
                        record.value++;

                        return _next(record);
                    },
                ])
                .finally((record: unknown) => {
                    const typed = record as typeof std;

                    expect(typed.value).to.equal(3);
                    typed.value++;
                })
                .then((record: unknown) => {
                    const typed = record as typeof std;
                    typed.value++;

                    return typed;
                });

            expect(std.value).to.equal(4);
            expect((result as typeof std).value).to.equal(4);
        });

        it('finally() runs when a pipe throws, before the exception propagates', () => {
            // PHP: PipelineTest::testPipelineFinallyWhenExceptionOccurs
            const std = { value: 0 };

            expectThrows(
                () =>
                    new Pipeline(new Container())
                        .send(std)
                        .through([
                            (record: typeof std, _next: Next) => {
                                record.value = 1;

                                return _next(record);
                            },
                            (record: typeof std) => {
                                error(`My Exception: ${record.value}`);
                            },
                        ])
                        .finally((record: unknown) => {
                            const typed = record as typeof std;

                            expect(typed.value).to.equal(1);
                            typed.value++;
                        })
                        .then((record: unknown) => {
                            const typed = record as typeof std;
                            typed.value = 0;

                            return typed;
                        }),
                'My Exception: 1',
            );

            expect(std.value).to.equal(2);
        });

        it('routes what handleCarry() throws through handleException()', () => {
            // No upstream twin: pins the port to PHP's `try` shape, where
            // `handleCarry()` runs inside it -- Routing overrides it with
            // `toResponse()`, and what that throws must become a rendered
            // response, not an exception through the stack.
            class CarryHandlingPipeline extends Pipeline
            {
                protected handleCarry(carry: unknown): unknown
                {
                    if (carry === 'boom') {
                        throw new RuntimeException('carry exploded');
                    }

                    return carry;
                }

                protected handleException(_passable: unknown, e: unknown): unknown
                {
                    expect(e instanceof RuntimeException).to.equal(true);

                    return 'handled';
                }
            }

            const result = new CarryHandlingPipeline()
                .send('payload')
                .through([() => 'boom'])
                .then((passable: unknown) => passable);

            expect(result).to.equal('handled');
        });
    });
};
