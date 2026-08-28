/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Container } from 'Illuminate/Container/Container';
import { Controller } from 'Illuminate/Routing/Controller';
import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import { HttpResponseException } from 'Illuminate/Http/Exceptions/HttpResponseException';
import { Request } from 'Illuminate/Http/Request';
import { Response } from 'Illuminate/Http/Response';
import { Router } from 'Illuminate/Routing/Router';
import type { Responsable } from 'Illuminate/Contracts/Support/Responsable';

/**
 * PHP: `Illuminate\Tests\Routing\RoutingRouteTest`, the middleware-related
 * cases. Middleware-gathering and pipeline plumbing shared with
 * `Route/Matching.spec.ts` -- see that file's header for the `getRouter()`
 * stand-in and why closures here take no `Request` parameter.
 *
 * Not ported, and why:
 *
 * - `testMiddlewareCanBeSkippedFromResources` -- `Route::resource()`; not
 *   ported.
 * - `testMiddlewareGroupsCannotReferenceItself` -- PHP's
 *   `MiddlewareNameResolver` raises `LogicException` on a group that lists
 *   itself; the port's `parseMiddlewareGroup()`
 *   (`MiddlewareNameResolver.ts`) has no such guard and would recurse
 *   forever instead, so there is no way to observe the exception this test
 *   checks for.
 * - `testControllerRouting`, `testCallableControllerRouting`,
 *   `testControllerMiddlewareGroups` -- the `'Controller@method'` string
 *   action form; not ported. `testControllerRoutingArrayCallable` below
 *   covers the `[Controller, method]` form that is, adapted from `$_SERVER`
 *   flags to local counters (see that test's own comment), and dropping the
 *   `except` middleware option, which `Controller::getMiddleware()` does not
 *   carry here (`Controller.ts`'s class comment).
 */

function router(): Router {
    return new Router(new Dispatcher(), new Container());
}

export = (): void => {
    describe('Routing.Route.Middleware', () => {
        // PHP: RoutingRouteTest::testClosureMiddleware
        it("a closure given as 'middleware' can short-circuit the route", () => {
            const r = router();
            const middleware = () => 'caught';

            r.get('foo/bar', { middleware: [middleware], uses: () => 'hello' });

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('caught');
        });

        // PHP: RoutingRouteTest::testMiddlewareCanBeSkipped
        it('Route::withoutMiddleware() drops an aliased middleware from the route', () => {
            class RoutingTestMiddlewareGroupTwo {
                public handle(): unknown {
                    return new Response('caught');
                }
            }

            const r = router();
            r.aliasMiddleware('web', RoutingTestMiddlewareGroupTwo);

            r.get('foo/bar', {
                middleware: ['web'],
                uses: () => 'hello',
            }).withoutMiddleware(RoutingTestMiddlewareGroupTwo);

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('hello');
        });

        // PHP: RoutingRouteTest::testMiddlewareWorksIfControllerThrowsHttpResponseException
        it('a middleware still runs when the action throws HttpResponseException', () => {
            let r = router();
            const beforeMiddleware = () => 'caught';

            r.get('foo/bar', {
                middleware: [beforeMiddleware],
                uses: () => {
                    throw new HttpResponseException(new Response('hello'));
                },
            });

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('caught');

            // After calling the action: the middleware's `next()` sees the
            // response the exception carried, and can still transform it.
            r = router();
            const response = new Response('hello');

            const afterMiddleware = (request: Request, _next: (request: Request) => Response) => {
                const seen = _next(request);
                expect(seen).to.equal(response);

                return new Response(`${seen.content()} caught`);
            };

            r.get('foo/bar', {
                middleware: [afterMiddleware],
                uses: () => {
                    throw new HttpResponseException(response);
                },
            });

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('hello caught');
        });

        // PHP: RoutingRouteTest::testReturnsResponseWhenMiddlewareReturnsResponsable
        it('a Responsable returned by a middleware is converted to a response', () => {
            class ResponsableResponse implements Responsable {
                public toResponse(): Response {
                    return new Response('bar');
                }
            }

            const container = new Container();
            const r = new Router(new Dispatcher(), container);
            const request = new Request({} as Player, 'GET', 'foo/bar');

            // `Pipeline.handleCarry()` resolves `Request` off the container when
            // the carry is Responsable (`Pipeline.ts`); nothing in this port
            // binds "request" onto the router's container automatically outside
            // the HTTP kernel (`Foundation/Http/Kernel.ts`), so the test binds
            // it directly, the way the kernel would.
            container.instance('request', request);

            r.get('foo/bar', {
                uses: () => 'hello',
                middleware: ['foo', 'bar', 'baz'],
            });
            r.aliasMiddleware('foo', (req: Request, _next: (request: Request) => unknown) => _next(req));
            r.aliasMiddleware('bar', () => new ResponsableResponse());
            r.aliasMiddleware('baz', (req: Request, _next: (request: Request) => unknown) => _next(req));

            expect(r.dispatch(request).content()).to.equal('bar');
        });

        // PHP: RoutingRouteTest::testDefinedClosureMiddleware
        it('an aliased closure middleware can short-circuit the route', () => {
            const r = router();
            r.get('foo/bar', { middleware: ['foo'], uses: () => 'hello' });
            r.aliasMiddleware('foo', () => 'caught');

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('caught');
        });

        // PHP: RoutingRouteTest::testControllerClosureMiddleware
        it("a controller's own middleware runs around its action", () => {
            class RouteTestClosureMiddlewareController extends Controller {
                public constructor() {
                    super();
                    this.middleware((request: Request, _next: (request: Request) => Response) => {
                        const response = _next(request);

                        return response.setContent(
                            `${response.content()}-${request.offsetGet('foo-middleware') ?? ''}-controller-closure`,
                        );
                    });
                }

                public index(): string {
                    return 'index';
                }
            }

            const r = router();
            r.get('foo/bar', {
                uses: [RouteTestClosureMiddlewareController, 'index'],
                middleware: ['foo'],
            });
            r.aliasMiddleware('foo', (request: Request, _next: (request: Request) => unknown) => {
                request.offsetSet('foo-middleware', 'foo-middleware');

                return _next(request);
            });

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal(
                'index-foo-middleware-controller-closure',
            );
        });

        // PHP: RoutingRouteTest::testMiddlewareGroups
        it('a middleware group expands into every middleware it lists', () => {
            let sawGroupOne = false;

            class RoutingTestMiddlewareGroupOne {
                public handle(request: Request, _next: (request: Request) => unknown): unknown {
                    sawGroupOne = true;

                    return _next(request);
                }
            }

            class RoutingTestMiddlewareGroupTwo {
                public handle(_request: Request, _next: Callback, parameter?: string): unknown {
                    return new Response(`caught ${parameter}`);
                }
            }

            const r = router();
            r.get('foo/bar', { middleware: ['web'], uses: () => 'hello' });

            r.aliasMiddleware('two', RoutingTestMiddlewareGroupTwo);
            r.middlewareGroup('web', [RoutingTestMiddlewareGroupOne, 'two:taylor']);

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('caught taylor');
            expect(sawGroupOne).to.equal(true);
        });

        // PHP: RoutingRouteTest::testMiddlewareGroupsCanReferenceOtherGroups
        it('a middleware group can nest another group by name', () => {
            let sawGroupOne = false;

            class RoutingTestMiddlewareGroupOne {
                public handle(request: Request, _next: (request: Request) => unknown): unknown {
                    sawGroupOne = true;

                    return _next(request);
                }
            }

            class RoutingTestMiddlewareGroupTwo {
                public handle(_request: Request, _next: Callback, parameter?: string): unknown {
                    return new Response(`caught ${parameter}`);
                }
            }

            const r = router();
            r.get('foo/bar', { middleware: ['web'], uses: () => 'hello' });

            r.aliasMiddleware('two', RoutingTestMiddlewareGroupTwo);
            r.middlewareGroup('first', ['two:abigail']);
            r.middlewareGroup('web', [RoutingTestMiddlewareGroupOne, 'first']);

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('caught abigail');
            expect(sawGroupOne).to.equal(true);
        });

        // PHP: RoutingRouteTest::testControllerRoutingArrayCallable
        //
        // Adapted from `$_SERVER['route.test.controller.middleware...']` flags
        // (there is no `$_SERVER` here) to closured local variables, and dropping
        // the `except` middleware option -- see this file's header.
        it("a [Controller, method] pair carries the controller's own constructor-registered middleware", () => {
            let sawMiddleware = false;
            let parameterOne: string | undefined;
            let parameterTwo: Array<string> | undefined;

            class RouteTestControllerMiddleware {
                public handle(request: Request, _next: (request: Request) => unknown): unknown {
                    sawMiddleware = true;

                    return _next(request);
                }
            }

            class RouteTestControllerParameterizedMiddlewareOne {
                public handle(request: Request, _next: (request: Request) => unknown, parameter?: string): unknown {
                    parameterOne = parameter;

                    return _next(request);
                }
            }

            class RouteTestControllerParameterizedMiddlewareTwo {
                public handle(
                    request: Request,
                    _next: (request: Request) => unknown,
                    ...parameters: Array<string>
                ): unknown {
                    parameterTwo = parameters;

                    return _next(request);
                }
            }

            class RouteTestControllerStub extends Controller {
                public constructor() {
                    super();
                    this.middleware(RouteTestControllerMiddleware);
                    this.middleware([RouteTestControllerParameterizedMiddlewareOne, '0']);
                    this.middleware([RouteTestControllerParameterizedMiddlewareTwo, 'foo', 'bar']);
                }

                public index(): string {
                    return 'Hello World';
                }
            }

            const r = router();
            r.get('foo/bar', [RouteTestControllerStub, 'index']);

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('Hello World');
            expect(sawMiddleware).to.equal(true);
            expect(parameterOne).to.equal('0');
            expectDeepEqual(parameterTwo, ['foo', 'bar']);

            const action = r.getRoutes().getRoutes()[0].getAction().controller;
            expectDeepEqual(action, [RouteTestControllerStub, 'index']);
        });
    });
};
