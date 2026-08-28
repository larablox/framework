/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Container } from 'Illuminate/Container/Container';
import { Controller } from 'Illuminate/Routing/Controller';
import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import { HttpResponseException } from 'Illuminate/Http/Exceptions/HttpResponseException';
import { LogicException } from 'Illuminate/Exception';
import { NotFoundHttpException } from 'Illuminate/Http/Exceptions/HttpException';
import { Request } from 'Illuminate/Http/Request';
import { Response } from 'Illuminate/Http/Response';
import { Route } from 'Illuminate/Routing/Route';
import { Router } from 'Illuminate/Routing/Router';
import { Str } from 'Illuminate/Support/Str';
import { SubstituteBindings } from 'Illuminate/Routing/Middleware/SubstituteBindings';

/**
 * PHP: `Illuminate\Tests\Routing\RoutingRouteTest`, the dispatch- and
 * matching-related cases (`testBasicDispatchingOfRoutes` and its neighbours).
 *
 * `router()` below stands in for PHP's `getRouter()`. It skips two things
 * PHP's version does: binding `Registrar::class` (no facade to resolve it
 * for) and binding the callable/controller dispatcher contracts (the
 * container already resolves the concrete `CallableDispatcher`/
 * `ControllerDispatcher` classes fine without an explicit `bind()`, since
 * neither is requested by its contract here). Because nothing binds
 * `"request"` onto the container the way `Foundation\Http\Kernel` does,
 * closures below never take a `Request` parameter -- `CallableDispatcher`
 * only puts one first when `container.bound("request")`
 * (`CallableDispatcher.ts`) -- which matches every closure fixture in the
 * PHP file, none of which type-hints `Request` either.
 *
 * Not ported, and why:
 *
 * - Every domain-carrying case inside `testBasicDispatchingOfRoutes`
 *   (`'domain' => 'api.{name}.bar'`, etc.), `testRoutesDontMatchNonMatchingDomain`,
 *   `testRouteDomainRegistration` -- hosts are not ported (`Route.ts`'s
 *   class comment).
 * - The `'boom' => 'auth'` case inside `testBasicDispatchingOfRoutes` --
 *   an arbitrary unrecognized action key that PHP's action array silently
 *   ignores; `ActionAttributes` is a fixed shape here (`RouteAction.ts`), so
 *   there is no "extra key" to be permissive about.
 * - `testNotModifiedResponseIsProperlyReturned` -- Symfony's `Response`,
 *   `setLastModified()`, conditional-GET headers; none of that exists here
 *   (`Response.ts` is not Symfony-shaped).
 * - `testNonGreedyMatches` -- `images/{id}.{ext}` puts two parameters in one
 *   URI segment, which posegmented matching refuses outright (a parameter
 *   takes a whole segment -- `agent_docs/laravel-parity.md`, "Сопоставление:
 *   сегменты вместо регулярки"); the parameter-bag assertions the same test
 *   also makes are covered below with a segment-friendly URI instead.
 * - `testControllerCallActionMethodParameters` -- exercises
 *   `Controller::callAction()`'s reflection-based parameter matching by
 *   name/order/count against `$_SERVER`; the port's `callAction()`
 *   (`Controller.ts`) just forwards the resolved parameters positionally, and
 *   there is no `$_SERVER` to assert against.
 * - `testLeadingParamDoesntReceiveForwardSlashOnEmptyPath` -- exercises a
 *   `where` pattern matching a literal `/` inside a single segment
 *   (`'(.+)' `); a `where` pattern is checked against one segment's text
 *   after splitting, so it can never see a `/` character in the first place.
 * - `testRoutesDontMatchNonMatchingPathsWithLeadingOptionals` -- covered by
 *   `RouteCollection.spec.ts`'s "throws NotFoundHttpException" case in
 *   spirit; the exact PHP scenario (`{baz?}` refusing `foo/bar`) is kept
 *   below instead, since it is short and belongs with the rest of the
 *   optional-parameter matching cases.
 */

function router(): Router {
    // `"router"` is bound so that middleware asking for it -- `SubstituteBindings`
    // does -- can be resolved, the same binding upstream's `getRouter()` makes.
    const container = new Container();
    const built = new Router(new Dispatcher(), container);

    container.instance('router', built);

    return built;
}

export = (): void => {
    describe('Routing.Route.Matching', () => {
        // PHP: RoutingRouteTest::testBasicDispatchingOfRoutes (data inlined, non-domain cases)
        it('dispatches a GET route to its closure', () => {
            const r = router();
            r.get('foo/bar', () => 'hello');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('hello');
        });

        it('HttpResponseException thrown from the action short-circuits to its response', () => {
            const r = router();
            r.get('foo/bar', () => {
                throw new HttpResponseException(new Response('hello'));
            });
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('hello');
        });

        it('GET and POST on the same URI dispatch to different routes', () => {
            const r = router();
            r.get('foo/bar', () => 'hello');
            r.post('foo/bar', () => 'post hello');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('hello');
            expect(r.dispatch(new Request({} as Player, 'POST', 'foo/bar')).content()).to.equal('post hello');
        });

        it("a required parameter fills the closure's first argument", () => {
            const r = router();
            r.get('foo/{bar}', (name: string) => name);
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/taylor')).content()).to.equal('taylor');
        });

        it("a trailing optional parameter falls back to the closure's default", () => {
            const r = router();
            r.get('foo/{bar}/{baz?}', (name: string, age = 25) => `${name}${age}`);
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/taylor')).content()).to.equal('taylor25');
        });

        it('several trailing optional parameters each fall back independently', () => {
            const r = router();
            r.get(
                'foo/{name}/boom/{age?}/{location?}',
                (name: string, age = 25, location = 'AR') => `${name}${age}${location}`,
            );
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/taylor/boom/30')).content()).to.equal('taylor30AR');
        });

        it('a leading required parameter with a trailing optional one', () => {
            const r = router();
            r.get('{bar}/{baz?}', (name: string, age = 25) => `${name}${age}`);
            expect(r.dispatch(new Request({} as Player, 'GET', 'taylor')).content()).to.equal('taylor25');
        });

        it('a single optional parameter matches the root and one segment', () => {
            const r = router();
            r.get('{baz?}', (age = 25) => tostring(age));
            expect(r.dispatch(new Request({} as Player, 'GET', '/')).content()).to.equal('25');
            expect(r.dispatch(new Request({} as Player, 'GET', '30')).content()).to.equal('30');
        });

        it('two leading optional parameters, and Router::currentRouteNamed()/is()', () => {
            const r = router();
            r.get('{foo?}/{baz?}', {
                as: 'foo',
                uses: (name = 'taylor', age = 25) => `${name}${age}`,
            });

            expect(r.dispatch(new Request({} as Player, 'GET', '/')).content()).to.equal('taylor25');
            expect(r.dispatch(new Request({} as Player, 'GET', 'fred')).content()).to.equal('fred25');
            expect(r.dispatch(new Request({} as Player, 'GET', 'fred/30')).content()).to.equal('fred30');
            expect(r.currentRouteNamed('foo')).to.equal(true);
            expect(r.currentRouteNamed('fo*')).to.equal(true);
            expect(r.is('foo')).to.equal(true);
            expect(r.is('foo', 'bar')).to.equal(true);
            expect(r.is('bar')).to.equal(false);
        });

        // PHP: RoutingRouteTest::testBasicDispatchingOfRoutes, the PATCH/currentRouteName case
        it("Router::currentRouteName() reports the dispatched route's name", () => {
            const r = router();
            r.patch('foo/bar', { as: 'foo', uses: () => 'bar' });
            expect(r.dispatch(new Request({} as Player, 'PATCH', 'foo/bar')).content()).to.equal('bar');
            expect(r.currentRouteName()).to.equal('foo');
        });

        it('HEAD carries no body, whether the route is GET or ANY', () => {
            let r = router();
            r.get('foo/bar', () => 'hello');
            expect(r.dispatch(new Request({} as Player, 'HEAD', 'foo/bar')).content()).to.equal(undefined);

            r = router();
            r.any('foo/bar', () => 'hello');
            expect(r.dispatch(new Request({} as Player, 'HEAD', 'foo/bar')).content()).to.equal(undefined);
        });

        it('of two routes for the same URI and verb, the one registered last wins', () => {
            const r = router();
            r.get('foo/bar', () => 'first');
            r.get('foo/bar', () => 'second');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('second');
        });

        // PHP: RoutingRouteTest::testOptionsResponsesAreGeneratedByDefault
        it('OPTIONS answers 200 and lists the Allow header from every matching route', () => {
            const r = router();
            r.get('foo/bar', () => 'hello');
            r.post('foo/bar', () => 'hello');
            const response = r.dispatch(new Request({} as Player, 'OPTIONS', 'foo/bar'));

            expect(response.status()).to.equal(200);
            expect(response.getHeaders().get('Allow')).to.equal('GET,HEAD,POST');
        });

        // PHP: RoutingRouteTest::testHeadDispatcher
        it('OPTIONS/HEAD are synthesized for whatever verbs a URI was registered under', () => {
            let r = router();
            r.match(['GET', 'POST'], 'foo', () => 'bar');

            let response = r.dispatch(new Request({} as Player, 'OPTIONS', 'foo'));
            expect(response.status()).to.equal(200);
            expect(response.getHeaders().get('Allow')).to.equal('GET,HEAD,POST');

            response = r.dispatch(new Request({} as Player, 'HEAD', 'foo'));
            expect(response.status()).to.equal(200);
            expect(response.content()).to.equal(undefined);

            r = router();
            r.match(['GET'], 'foo', () => 'bar');
            response = r.dispatch(new Request({} as Player, 'OPTIONS', 'foo'));
            expect(response.getHeaders().get('Allow')).to.equal('GET,HEAD');

            r = router();
            r.match(['POST'], 'foo', () => 'bar');
            response = r.dispatch(new Request({} as Player, 'OPTIONS', 'foo'));
            expect(response.getHeaders().get('Allow')).to.equal('POST');
        });

        // PHP: RoutingRouteTest::testNonGreedyMatches, the parameter-bag assertions
        // (adapted to a segment-friendly URI -- see this file's header)
        it('Route::parameter() reads matched segments, with matches() and bind()', () => {
            const route = new Route('GET', 'images/{id}/{ext}', {
                uses: () => {},
            });

            const request1 = new Request({} as Player, 'GET', 'images/1/png');
            expect(route.matches(request1)).to.equal(true);
            route.bind(request1);
            expect(route.hasParameter('id')).to.equal(true);
            expect(route.hasParameter('foo')).to.equal(false);
            expect(route.parameter('id')).to.equal('1');
            expect(route.parameter('ext')).to.equal('png');

            const request2 = new Request({} as Player, 'GET', 'images/12/png');
            expect(route.matches(request2)).to.equal(true);
            route.bind(request2);
            expect(route.parameter('id')).to.equal('12');
            expect(route.parameter('ext')).to.equal('png');

            const optional = new Route('GET', 'foo/{foo?}', { uses: () => {} });
            const request3 = new Request({} as Player, 'GET', 'foo');
            expect(optional.matches(request3)).to.equal(true);
            optional.bind(request3);
            expect(optional.parameter('foo', 'bar')).to.equal('bar');
        });

        // PHP: RoutingRouteTest::testHasParameters (adapted URI, see this file's header)
        it('Route::hasParameters() is false until the route is bound', () => {
            const route = new Route('GET', 'images/{id}/{ext}', {
                uses: () => {},
            });
            const request = new Request({} as Player, 'GET', 'images/1/png');
            expect(route.hasParameters()).to.equal(false);
            expect(route.matches(request)).to.equal(true);
            route.bind(request);
            expect(route.hasParameters()).to.equal(true);
        });

        // PHP: RoutingRouteTest::testForgetParameter (adapted URI, see this file's header)
        it('Route::forgetParameter() removes one bound parameter only', () => {
            const route = new Route('GET', 'images/{id}/{ext}', {
                uses: () => {},
            });
            const request = new Request({} as Player, 'GET', 'images/1/png');
            route.bind(request);
            expect(route.hasParameter('id')).to.equal(true);
            expect(route.hasParameter('ext')).to.equal(true);
            route.forgetParameter('id');
            expect(route.hasParameter('id')).to.equal(false);
            expect(route.hasParameter('ext')).to.equal(true);
        });

        // PHP: RoutingRouteTest::testParameterNames (adapted URI, see this file's header)
        it('Route::parameterNames() lists them in URI order', () => {
            let route = new Route('GET', 'images/{id}/{ext}', {
                uses: () => {},
            });
            expectDeepEqual(route.parameterNames(), ['id', 'ext']);

            route = new Route('GET', 'foo/{bar?}', { uses: () => {} });
            expectDeepEqual(route.parameterNames(), ['bar']);

            route = new Route('GET', '/', { uses: () => {} });
            expectDeepEqual(route.parameterNames(), []);
        });

        // PHP: RoutingRouteTest::testParametersWithoutNulls
        it('Route::parametersWithoutNulls() is parameters(), since a Luau table has no nulls', () => {
            let route = new Route('GET', 'users/{id?}/{name?}/', {
                uses: () => {},
            });
            let request = new Request({} as Player, 'GET', 'users/12/amir');
            route.bind(request);
            expect(route.parametersWithoutNulls().get('id')).to.equal('12');
            expect(route.parametersWithoutNulls().get('name')).to.equal('amir');

            route = new Route('GET', 'users/{id?}/{name?}/', {
                uses: () => {},
            });
            request = new Request({} as Player, 'GET', 'users/12');
            route.bind(request);
            expect(route.parametersWithoutNulls().get('id')).to.equal('12');
            expect(route.parametersWithoutNulls().has('name')).to.equal(false);

            route = new Route('GET', 'users/{id?}/{name?}/', {
                uses: () => {},
            });
            request = new Request({} as Player, 'GET', 'users/');
            route.bind(request);
            expect(route.parametersWithoutNulls().size()).to.equal(0);
        });

        // PHP: RoutingRouteTest::testRouteParametersDefaultValue
        it('Route::defaults() fills a parameter the URI left out', () => {
            const r = router();

            class RouteTestControllerWithParameterStub extends Controller {
                public returnParameter(bar = ''): string {
                    return bar;
                }
            }

            r.get('foo/{bar?}', {
                uses: [RouteTestControllerWithParameterStub, 'returnParameter'],
            }).defaults('bar', 'foo');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo')).content()).to.equal('foo');

            r.get('foo/{bar?}', {
                uses: [RouteTestControllerWithParameterStub, 'returnParameter'],
            }).defaults('bar', 'foo');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('bar');

            r.get('foo/{bar?}', (bar = '') => bar).defaults('bar', 'foo');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo')).content()).to.equal('foo');
        });

        // PHP: RoutingRouteTest::testRoutesDontMatchNonMatchingPathsWithLeadingOptionals
        it('an optional-only route still refuses a path with extra segments', () => {
            const r = router();
            r.get('{baz?}', (age = 25) => tostring(age));

            const [ok, err] = pcall(() => r.dispatch(new Request({} as Player, 'GET', 'foo/bar')));

            expect(ok).to.equal(false);
            expect(err instanceof NotFoundHttpException).to.equal(true);
        });

        // PHP: RoutingRouteTest::testFluentRouteNamingWithinAGroup
        it("a name set inside a group prefixes onto the route's own name()", () => {
            const r = router();
            r.group({ as: 'foo.' }, () => {
                r.get('bar', () => 'bar').name('bar');
            });

            expect(r.dispatch(new Request({} as Player, 'GET', 'bar')).content()).to.equal('bar');
            expect(r.currentRouteName()).to.equal('foo.bar');
        });

        // PHP: RoutingRouteTest::testRouteGetAction
        //
        // PHP also asserts `getAction('unknown_property')` is null, reading the
        // action array's `key` argument -- `getAction()` here takes none
        // (`Route.ts`): `ActionAttributes` is a fixed shape (`RouteAction.ts`),
        // so there is no arbitrary key to probe.
        it('Route::getAction() is the raw action array, carrying the name that was set', () => {
            const r = router();
            const route = r.get('foo', () => 'foo').name('foo');

            expect(route.getAction().as).to.equal('foo');
        });

        // PHP: RoutingRouteTest::testRouteGetControllerClass
        it('Route::getControllerClass() is undefined for a closure route', () => {
            const r = router();

            class RouteTestControllerStub extends Controller {
                public index(): string {
                    return 'Hello World';
                }
            }

            const controllerRoute = r.get('foo/bar', [RouteTestControllerStub, 'index']);
            const closureRoute = r.get('foo', () => 'foo');

            expect(controllerRoute.getControllerClass()).to.equal(RouteTestControllerStub);
            expect(closureRoute.isControllerAction()).to.equal(false);
        });

        // PHP: RoutingRouteTest::testResolvingBindingParameters
        it('Route::bindingFieldFor() reads the field a {param:field} URI declared', () => {
            const r = router();

            let route = r.get('foo/{bar:slug}', () => 'foo').name('foo');
            expect(route.bindingFieldFor('bar')).to.equal('slug');

            route = r.get('foo/{bar:slug}/{baz}', () => 'foo').name('foo');
            expect(route.bindingFieldFor('baz')).to.equal(undefined);
        });

        // PHP: RoutingRouteTest::testFluentRouting
        it('a route with no action throws LogicException when it is finally dispatched', () => {
            const r = router();
            r.get('foo/bar').uses(() => 'hello');
            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('hello');

            r.post('foo/bar').uses(() => 'hello');
            expect(r.dispatch(new Request({} as Player, 'POST', 'foo/bar')).content()).to.equal('hello');

            r.get('foo/bar');
            const [ok, err] = pcall(() => r.dispatch(new Request({} as Player, 'GET', 'foo/bar')));

            expect(ok).to.equal(false);
            expect(err instanceof LogicException).to.equal(true);
        });

        // PHP: RoutingRouteTest::testWherePatternsProperlyFilter
        //
        // The pattern is a Luau pattern, not PCRE (`Route.ts`'s `where()` class
        // comment) -- PHP's `'123|456'` alternation cases have no equivalent and
        // are dropped; the `[0-9]+` cases translate as-is. The trailing
        // "Conditional" case (`Route::when()`/`whereIn()` on a subdomain
        // parameter) is skipped twice over: neither method is ported, and hosts
        // are not ported either.
        it('Route::where() rejects a segment that fails the pattern, required or optional', () => {
            let route = new Route('GET', 'foo/{bar}', { uses: () => {} }).where('bar', '[0-9]+');
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123'))).to.equal(true);
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123abc'))).to.equal(false);

            route = new Route('GET', 'foo/{bar}', {
                where: { bar: '[0-9]+' },
            }).where('bar', '[0-9]+');
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123abc'))).to.equal(false);

            route = new Route('GET', 'foo/{bar?}', { uses: () => {} }).where('bar', '[0-9]+');
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123'))).to.equal(true);

            route = new Route('GET', 'foo/{bar?}', {
                where: { bar: '[0-9]+' },
            }).where('bar', '[0-9]+');
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123'))).to.equal(true);

            route = new Route('GET', 'foo/{bar?}/{baz?}', {
                uses: () => {},
            }).where('bar', '[0-9]+');
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123'))).to.equal(true);
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123/foo'))).to.equal(true);

            route = new Route('GET', 'foo/{bar?}', { uses: () => {} }).where('bar', '[0-9]+');
            expect(route.matches(new Request({} as Player, 'GET', 'foo/123abc'))).to.equal(false);
        });

        // PHP: RoutingRouteTest::testRouteBinding, the `Router::bind()` closure form
        // (`RouteClassBinding`/`RouteClassMethodBinding` take a class or a
        // `'Class@method'` string, neither of which `bind()` accepts here --
        // `Router.ts`'s `bind()` takes a `BinderCallback` only)
        it('Router::bind() runs the closure over the matched segment before dispatch', () => {
            const r = router();
            r.get('foo/{bar}', {
                middleware: ['substitute'],
                uses: (name: string) => name,
            });
            r.aliasMiddleware('substitute', (request: Request, _next: (request: Request) => unknown) => {
                r.substituteBindings(request.route() as Route);
                return _next(request);
            });
            r.bind('bar', (value: string) => Str.upper(value));

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/taylor')).content()).to.equal('TAYLOR');
        });

        // PHP: RoutingRouteTest::testMiddlewarePrioritySorting
        it('Router::gatherRouteMiddleware() sorts by middlewarePriority', () => {
            class Placeholder1 {
                public handle(request: Request, _next: Callback): unknown {
                    return _next(request);
                }
            }
            class Placeholder2 {
                public handle(request: Request, _next: Callback): unknown {
                    return _next(request);
                }
            }
            class Placeholder3 {
                public handle(request: Request, _next: Callback): unknown {
                    return _next(request);
                }
            }
            class SubstituteBindings {
                public handle(request: Request, _next: Callback): unknown {
                    return _next(request);
                }
            }
            class Authenticate {
                public handle(request: Request, _next: Callback): unknown {
                    return _next(request);
                }
            }
            class ExampleMiddleware {
                public handle(request: Request, _next: Callback): unknown {
                    return _next(request);
                }
            }

            const middleware = [
                Placeholder1,
                SubstituteBindings,
                Placeholder2,
                Authenticate,
                ExampleMiddleware,
                Placeholder3,
            ];

            const r = router();
            r.middlewarePriority = [ExampleMiddleware, Authenticate, SubstituteBindings];

            const route = r.get('foo', {
                middleware,
                uses: (name: string) => name,
            });

            expectDeepEqual(r.gatherRouteMiddleware(route), [
                Placeholder1,
                ExampleMiddleware,
                Authenticate,
                SubstituteBindings,
                Placeholder2,
                Placeholder3,
            ]);
        });

        // PHP: RoutingRouteTest::testCurrentRouteUses
        it("Router::uses() and currentRouteUses() match the current route's action name", () => {
            const r = router();

            class RouteTestControllerStub extends Controller {
                public index(): string {
                    return 'Hello World';
                }
            }

            r.get('foo/bar', {
                as: 'foo.bar',
                uses: [RouteTestControllerStub, 'index'],
            });

            expect(r.currentRouteAction()).to.equal(undefined);

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/bar')).content()).to.equal('Hello World');
            expect(r.uses('*RouteTestControllerStub*')).to.equal(true);
            expect(r.uses('*RouteTestControllerStub@index')).to.equal(true);
            expect(r.uses('*RouteTestControllerStub*', '*FooController*')).to.equal(true);
            expect(r.uses('*BarController*', '*FooController*', '*RouteTestControllerStub@index')).to.equal(true);
            expect(r.uses('*BarController*', '*FooController*')).to.equal(false);

            expect(r.currentRouteAction()).to.equal('RouteTestControllerStub@index');
            expect(r.uses('RouteTestControllerStub@index')).to.equal(true);
        });

        // PHP: RoutingRouteTest::testRouterPatternSetting
        it('Router::pattern()/patterns() record global patterns via getPatterns()', () => {
            let r = router();
            r.pattern('test', 'pattern');
            expectDeepEqual(r.getPatterns(), { test: 'pattern' });

            r = router();
            r.patterns({ test: 'pattern', test2: 'pattern2' });
            expectDeepEqual(r.getPatterns(), {
                test: 'pattern',
                test2: 'pattern2',
            });
        });

        // PHP: RoutingRouteTest::testResponseIsReturned, testJsonResponseIsReturned
        //
        // PHP tells these apart by class: a plain value becomes `Response`, an
        // array becomes `JsonResponse`. `Response.ts` carries content of any
        // shape without encoding it (a remote call hands back a Luau value
        // as-is), which is what makes `JsonResponse` redundant here (see its
        // class comment) -- there is only ever the one `Response` class, and an
        // array action result comes back as the array itself, unencoded.
        it('both a plain value and an array action result come back as an unencoded Response', () => {
            let r = router();
            r.get('foo/bar', () => 'hello');
            let response = r.dispatch(new Request({} as Player, 'GET', 'foo/bar'));
            expect(response).to.be.a('table');
            expect(response.content()).to.equal('hello');

            r = router();
            r.get('foo/bar', () => ['foo', 'bar']);
            response = r.dispatch(new Request({} as Player, 'GET', 'foo/bar'));
            expect(response).to.be.a('table');
            expectDeepEqual(response.content(), ['foo', 'bar']);
        });

        // PHP: RoutingRouteTest::testRouteFlushController
        //
        // PHP reads `$response->original['invokedCount']`/`['middlewareInvokedCount']`
        // off the response (`Response::$original`, not ported -- `Response.ts` is
        // not Laravel's `Illuminate\Http\Response`). The counters live on the
        // controller fixture itself instead, which is what those properties were
        // reading in the first place; the middleware-invocation counter is
        // dropped along with `$response->original`, since there is nowhere left
        // to read it from.
        //
        // The expectation is inverted from upstream, and deliberately. PHP
        // caches the controller on the route and `flushController()` drops it,
        // which is safe there because the route object dies with the request.
        // Here the collection's route lives as long as the place and requests
        // interleave, so one cached controller would be a single instance
        // shared between players -- and a controller holding any state of its
        // own would leak it mid-request. `Route::forRequest()` hands each
        // request a copy carrying no controller, so every dispatch builds its
        // own and `flushController()` has nothing left to drop. It stays on the
        // class for parity with PHP.
        it('gives every dispatch its own controller, leaving flushController() nothing to drop (diverges -- see comment)', () => {
            let constructCount = 0;

            class ActionCountStub extends Controller {
                public invokedCount = 0;

                public constructor() {
                    super();
                    constructCount += 1;
                }

                public index(): number {
                    this.invokedCount += 1;
                    return this.invokedCount;
                }
            }

            const r = router();
            r.get('count', [ActionCountStub, 'index']);
            const request = new Request({} as Player, 'GET', 'count');

            expect(r.dispatch(request).content()).to.equal(1);
            expect(constructCount).to.equal(1);

            // Upstream answers 2 here, off the instance the route kept.
            expect(r.dispatch(request).content()).to.equal(1);
            expect(constructCount).to.equal(2);

            // Drops a controller the per-request copy never held, so the
            // dispatch after it is no different from the one before.
            (request.route() as Route).flushController();

            expect(r.dispatch(request).content()).to.equal(1);
            expect(constructCount).to.equal(3);
        });

        // PHP: RoutingRouteTest::testRoutePreservingOriginalParametersState
        it('Route::originalParameter()/originalParameters() survive a binder rewriting the parameter', () => {
            const r = router();
            r.bind('bar', (value: string) => Str.length(value));
            r.get('foo/{bar}', {
                middleware: [SubstituteBindings],
                uses: (bar: number) => {
                    // The binder above has already rewritten `bar` by the time
                    // the action runs; the original is what the route kept.
                    const route = r.getCurrentRoute()!;

                    expect(route.originalParameter('bar')).to.equal('taylor');
                    expect(route.originalParameter('unexisting', 'default')).to.equal('default');
                    expect(route.originalParameters().get('bar')).to.equal('taylor');

                    return bar;
                },
            });

            expect(r.dispatch(new Request({} as Player, 'GET', 'foo/taylor')).content()).to.equal(6);
        });
    });
};
