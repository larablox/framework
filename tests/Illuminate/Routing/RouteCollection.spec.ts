/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../TestHelpers';
import { MethodNotAllowedHttpException } from 'Illuminate/Http/Exceptions/HttpException';
import { Request } from 'Illuminate/Http/Request';
import { Route } from 'Illuminate/Routing/Route';
import { RouteCollection } from 'Illuminate/Routing/RouteCollection';

/**
 * PHP: `Illuminate\Tests\Routing\RouteCollectionTest`.
 *
 * Not ported, and why:
 *
 * - `testCannotCacheDuplicateRouteNames`, `testCompiledRouteCollectionPreservesRouteMetadata`,
 *   `testCompiledRouteCollectionGetReturnsAllRoutesWhenMethodIsNull`,
 *   `testCompiledRouteCollectionCanRetrieveByMethod`,
 *   `testCompiledRouteCollectionCanRetrieveByAction`,
 *   `testCompiledRouteCollectionActionLookupPrefersFirstRegisteredRoute`,
 *   `testCompiledRouteCollectionCanGetRoutesByMethod`,
 *   `testCompiledRouteCollectionDynamicallyAddedRouteOverridesCachedRouteForSameUri`,
 *   `testCompiledRouteCollectionRequestMethodNotAllowed`,
 *   `testCompiledRouteCollectionThrowsNotFoundForUnmatchedPath` -- all exercise
 *   `CompiledRouteCollection`/`toCompiledRouteCollection()`, which needs
 *   Symfony's route compiler and route caching (`AbstractRouteCollection.ts`'s
 *   class comment: "the other one ... is Symfony's compiler and route
 *   caching, neither of which exists here").
 * - `testToSymfonyRouteCollection` -- `toSymfonyRouteCollection()`, same reason.
 * - `testPrependsRoutesWithDomain`, `testDomainRoutesAreMatchedBeforeNonDomainRoutes`
 *   -- `domain()`; hosts are not ported (`Route.ts`'s class comment).
 * - `testRouteCollectionDontMatchNonMatchingDoubleSlashes` -- exercises PHP's
 *   `Request::create()` forcing `REQUEST_URI` to bypass `parse_url()`
 *   trimming; there is no URL or `parse_url()` here (see
 *   `agent_docs/laravel-parity.md`, "Запрос — это вызов ремоута") --
 *   `Request`'s path is given directly and is not re-parsed.
 */
export = (): void => {
    describe('Routing.RouteCollection', () => {
        // PHP: RouteCollectionTest::testRouteCollectionCanAddRoute
        it('counts one after adding one route', () => {
            const routeCollection = new RouteCollection();
            routeCollection.add(
                new Route('GET', 'foo', {
                    uses: 'FooController@index',
                    as: 'foo_index',
                } as never),
            );
            expect(routeCollection.count()).to.equal(1);
        });

        // PHP: RouteCollectionTest::testRouteCollectionAddReturnsTheRoute
        it('add() returns the route it was given', () => {
            const routeCollection = new RouteCollection();
            const inputRoute = new Route('GET', 'foo', {
                uses: 'FooController@index',
                as: 'foo_index',
            } as never);
            const outputRoute = routeCollection.add(inputRoute);
            expect(outputRoute).to.equal(inputRoute);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanRetrieveByName
        it('can retrieve a route by name', () => {
            const routeCollection = new RouteCollection();
            const routeIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
                as: 'route_name',
            } as never);
            routeCollection.add(routeIndex);

            expect(routeIndex.getName()).to.equal('route_name');
            expect(routeCollection.getByName('route_name')?.getName()).to.equal('route_name');
            expect(routeCollection.getByName('route_name')).to.equal(routeIndex);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanRetrieveByAction
        it('can retrieve the action array by name', () => {
            const routeCollection = new RouteCollection();
            const action = {
                uses: 'FooController@index',
                as: 'route_name',
            } as never;
            const routeIndex = new Route('GET', 'foo/index', action);
            routeCollection.add(routeIndex);

            expect(routeIndex.getAction()).to.equal(action);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanRetrieveByMethod
        it('can retrieve routes by method', () => {
            const routeCollection = new RouteCollection();
            const routeIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
                as: 'route_name',
            } as never);
            routeCollection.add(routeIndex);

            expect(routeCollection.get('GET').size()).to.equal(1);
            expect(routeCollection.get('GET.foo/index').size()).to.equal(0);
            expect(routeCollection.get('GET')[0]).to.equal(routeIndex);

            const routeShow = new Route('GET', 'bar/show', {
                uses: 'BarController@show',
                as: 'bar_show',
            } as never);
            routeCollection.add(routeShow);
            expect(routeCollection.get('GET').size()).to.equal(2);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanGetIterator,
        // testRouteCollectionCanGetIteratorWhenEmpty,
        // testRouteCollectionCanGetIteratorWhenRouteAreAdded -- `ArrayIterator` has
        // no counterpart; `getRoutes()` returning the full array (asserted below
        // and by the "can get all routes" case) is what an iterator would walk.
        it('counts zero on an empty collection', () => {
            const routeCollection = new RouteCollection();
            expect(routeCollection.count()).to.equal(0);
            expect(routeCollection.getRoutes().size()).to.equal(0);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanHandleSameRoute
        it('adding the same route instance twice does not double the count', () => {
            const routeCollection = new RouteCollection();
            const routeIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
                as: 'foo_index',
            } as never);

            routeCollection.add(routeIndex);
            expect(routeCollection.count()).to.equal(1);

            routeCollection.add(routeIndex);
            expect(routeCollection.count()).to.equal(1);

            routeCollection.add(
                new Route('GET', 'bar/show', {
                    uses: 'BarController@show',
                    as: 'bar_show',
                } as never),
            );
            expect(routeCollection.count()).to.equal(2);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanRefreshNameLookups
        it('refreshes the name look-up table on demand', () => {
            const routeCollection = new RouteCollection();
            const routeIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
            } as never);

            expect(routeIndex.getName()).to.equal(undefined);

            routeCollection.add(routeIndex).name('route_name');

            expect(routeCollection.getByName('route_name')).to.equal(undefined);

            routeCollection.refreshNameLookups();
            expect(routeCollection.getByName('route_name')).to.equal(routeIndex);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanGetAllRoutes
        it('can get all routes in registration order', () => {
            const routeCollection = new RouteCollection();
            const routeIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
                as: 'foo_index',
            } as never);
            const routeShow = new Route('GET', 'foo/show', {
                uses: 'FooController@show',
                as: 'foo_show',
            } as never);
            const routeNew = new Route('POST', 'bar', {
                uses: 'BarController@create',
                as: 'bar_create',
            } as never);

            routeCollection.add(routeIndex);
            routeCollection.add(routeShow);
            routeCollection.add(routeNew);

            expectDeepEqual(routeCollection.getRoutes(), [
                routeIndex,
                routeShow,
                routeNew,
            ]);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanGetRoutesByName
        it('can get routes keyed by name', () => {
            const routeCollection = new RouteCollection();
            const fooIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
                as: 'foo_index',
            } as never);
            const fooShow = new Route('GET', 'foo/show', {
                uses: 'FooController@show',
                as: 'foo_show',
            } as never);
            const barCreate = new Route('POST', 'bar', {
                uses: 'BarController@create',
                as: 'bar_create',
            } as never);

            routeCollection.add(fooIndex);
            routeCollection.add(fooShow);
            routeCollection.add(barCreate);

            const byName = routeCollection.getRoutesByName();
            expect(byName.get('foo_index')).to.equal(fooIndex);
            expect(byName.get('foo_show')).to.equal(fooShow);
            expect(byName.get('bar_create')).to.equal(barCreate);
            expect(byName.size()).to.equal(3);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCanGetRoutesByMethod
        it('can get routes keyed by verb, then by URI', () => {
            const routeCollection = new RouteCollection();
            const fooIndex = new Route('GET', 'foo/index', {
                uses: 'FooController@index',
                as: 'foo_index',
            } as never);
            const fooShow = new Route('GET', 'foo/show', {
                uses: 'FooController@show',
                as: 'foo_show',
            } as never);
            const barCreate = new Route('POST', 'bar', {
                uses: 'BarController@create',
                as: 'bar_create',
            } as never);

            routeCollection.add(fooIndex);
            routeCollection.add(fooShow);
            routeCollection.add(barCreate);

            const byMethod = routeCollection.getRoutesByMethod();
            expect(byMethod.get('GET')?.get('foo/index')).to.equal(fooIndex);
            expect(byMethod.get('GET')?.get('foo/show')).to.equal(fooShow);
            expect(byMethod.get('HEAD')?.get('foo/index')).to.equal(fooIndex);
            expect(byMethod.get('HEAD')?.get('foo/show')).to.equal(fooShow);
            expect(byMethod.get('POST')?.get('bar')).to.equal(barCreate);
        });

        // PHP: RouteCollectionTest::testRouteCollectionCleansUpOverwrittenRoutes
        it('refreshing the lookups drops the lookups of routes since overwritten', () => {
            const routeCollection = new RouteCollection();
            const routeA = new Route('GET', 'product', {
                controller: [
                    'View',
                    'view',
                ],
                as: 'routeA',
            } as never);
            const routeB = new Route('GET', 'product', {
                controller: [
                    'OverwrittenView',
                    'view',
                ],
                as: 'overwrittenRouteA',
            } as never);

            routeCollection.add(routeA);
            routeCollection.add(routeB);

            expect(routeCollection.getByName('routeA')).to.equal(routeA);
            expect(routeCollection.getByAction(routeA.getActionName())).to.equal(routeA);
            expect(routeCollection.getByName('overwrittenRouteA')).to.equal(routeB);
            expect(routeCollection.getByAction(routeB.getActionName())).to.equal(routeB);

            routeCollection.refreshNameLookups();
            routeCollection.refreshActionLookups();

            expect(routeCollection.getByName('routeA')).to.equal(undefined);
            expect(routeCollection.getByAction(routeA.getActionName())).to.equal(undefined);
            expect(routeCollection.getByName('overwrittenRouteA')).to.equal(routeB);
            expect(routeCollection.getByAction(routeB.getActionName())).to.equal(routeB);
        });

        // PHP: RouteCollectionTest::testRouteCollectionRequestMethodNotAllowed
        it('throws MethodNotAllowedHttpException when only another verb matches', () => {
            const routeCollection = new RouteCollection();
            routeCollection.add(
                new Route('GET', 'users', {
                    uses: 'UsersController@index',
                    as: 'users',
                } as never),
            );

            const request = new Request({} as Player, 'POST', 'users');

            const [ok, err] = pcall(() => routeCollection.match(request));

            expect(ok).to.equal(false);
            expect(err instanceof MethodNotAllowedHttpException).to.equal(true);
        });

        // PHP: RouteCollectionTest::testHasNameRouteMethod
        it('hasNamedRoute() only answers for routes that were given a name', () => {
            const routeCollection = new RouteCollection();
            routeCollection.add(
                new Route('GET', 'users', {
                    uses: 'UsersController@index',
                    as: 'users',
                } as never),
            );
            routeCollection.add(
                new Route('GET', 'posts/{post}', {
                    uses: 'PostController@show',
                    as: 'posts',
                } as never),
            );
            routeCollection.add(
                new Route('GET', 'books/{book}', {
                    uses: 'BookController@show',
                } as never),
            );

            expect(routeCollection.hasNamedRoute('users')).to.equal(true);
            expect(routeCollection.hasNamedRoute('posts')).to.equal(true);
            expect(routeCollection.hasNamedRoute('article')).to.equal(false);
            expect(routeCollection.hasNamedRoute('books')).to.equal(false);
        });

        // PHP: RouteCollectionTest::testOverlappingRoutesMatchesFirstRoute
        it('of two overlapping routes, the first one registered wins', () => {
            const routeCollection = new RouteCollection();
            routeCollection.add(
                new Route('GET', 'users/{id}/{other}', {
                    uses: 'UsersController@other',
                    as: 'first',
                } as never),
            );
            routeCollection.add(
                new Route('GET', 'users/{id}/show', {
                    uses: 'UsersController@show',
                    as: 'second',
                } as never),
            );

            const request = new Request({} as Player, 'GET', 'users/1/show');

            expect(routeCollection.getRoutes().size()).to.equal(2);
            expect(routeCollection.match(request).getName()).to.equal('first');
        });
    });
};
