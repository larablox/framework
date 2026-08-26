/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../TestHelpers";
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { Request } from "Illuminate/Http/Request";
import { Route } from "Illuminate/Routing/Route";
import { Router } from "Illuminate/Routing/Router";

/**
 * PHP: `Illuminate\Tests\Routing\RouteRegistrarTest`.
 *
 * `RouteRegistrarControllerStub` below stands in for PHP's fixture class of
 * the same name.
 *
 * Not ported, and why:
 *
 * - `testNullNamespaceIsRespected`, `testCanRegisterNamespacedGroupRouteWithControllerActionArray`,
 *   `testCanRegisterGroupWithNamespace` -- `namespace()`; no PSR-4 autoloader,
 *   so a namespace prefix has nothing to resolve against.
 * - `testMiddlewareAsStringableObject` and its `OnRouteInstance`/`AsArrayWithStringables`
 *   variants -- `Stringable` objects as middleware; the port always takes a
 *   middleware entry as a class, `[class, ...args]`, or a plain string
 *   already, so there is no separate "coerce to string" step to test.
 * - `testMiddlewareAsNull` -- `middleware(null)`; the port's `middleware()`
 *   takes `Pipe | Array<Pipe>`, never `undefined`, so passing "nothing" is
 *   simply not calling it.
 * - `testGetRouteWithTrashed`, `testResourceWithTrashed` -- `withTrashed()`
 *   and `resource()`; soft-delete scoping and resource registration are not
 *   ported (`Route.ts`, `Router.ts` class comments).
 * - `testCanRegisterRouteWithControllerAction` -- the `'Controller@method'`
 *   string action form; not ported, there is no class string to resolve
 *   (`RouteAction.ts`'s class comment). `...ActionArray` below covers the
 *   `[Controller, 'method']` form that is.
 * - `testCanRegisterGroupWithStringableMiddleware` -- `Stringable` middleware
 *   again, on a group.
 * - `testCanRegisterGroupWithDomain`, `testCanRegisterGroupWithDomainAndNamePrefix`,
 *   `testCanSetRouteDomainUsingStringBackedEnum`, `testCannotSetRouteDomainUsingIntegerBackedEnum`
 *   -- `domain()`; hosts are not ported.
 * - `testCanRegisterGroupWithController`, `testCanOverrideGroupControllerWithStringSyntax`,
 *   `..WithClosureSyntax`, `..WithInvokableControllerSyntax`, `testWillUseTheLatestGroupController`,
 *   `testCanOverrideGroupControllerWithArraySyntax` -- the `Route::controller(...)`
 *   group, which resolves a bare method name against a group-wide controller
 *   class; not ported (task brief: "`Route::resource`/`ResourceRegistrar`/
 *   `Route::controller(...)` group are not ported").
 * - `testRegisteringNonApprovedAttributesThrows` -- PHP's `RouteRegistrar`
 *   dispatches unknown attribute names through `__call` and throws
 *   `BadMethodCallException` for ones it does not recognize; the port writes
 *   each attribute setter out instead of intercepting arbitrary calls (see
 *   `RouteRegistrar.ts`'s class comment), so there is no dynamic dispatch to
 *   reject -- an unknown attribute is simply a compile error.
 * - `testCanSetWithoutScopedBindings*`, `testCanSetScopeBindings*` --
 *   `scopeBindings()`; not ported (`RouteRegistrar.ts`'s class comment).
 * - Every `testCanSetRouteMetadata*`/`testRouteMetadata*`/`testSetMetadataReplacesExistingMetadata`
 *   case -- `metadata()`/`getMetadata()`; `ActionAttributes` carries no
 *   `metadata` key (see `RouteAction.ts`), so there is nothing to set.
 * - Every resource/singleton case (`testCanRegisterResource*`, `testCan*OnRegisteredResource`,
 *   `testCanRegisterApiResource*`, `testUserCanRegisterApiResource*`,
 *   `testResourceWheres`, `testResourceWithMiddlewareAsStringable`,
 *   `testCanRegisterSingleton` and every other `*Singleton*` case) --
 *   `resource()`/`apiResource()`/`singleton()`/`apiSingleton()` and
 *   `ResourceRegistrar`; not ported.
 * - `testWhereInRegistration`, `testWhereInEnumRegistration` -- `whereIn()` is
 *   not ported on `Route` (`Route.ts` only has
 *   `whereNumber`/`whereAlpha`/`whereAlphaNumeric`/`whereUuid`/`whereUlid`,
 *   exercised below by `testWhereNumberRegistration` and its neighbours).
 * - The `testGroupWhere{Number,Alpha,AlphaNumeric,In}Registration{OnRouteRegistrar,OnRouter}`
 *   family -- neither `RouteRegistrar` nor `Router` exposes `whereNumber()`
 *   etc. as its own fluent method the way PHP's `__call` does; only `where()`
 *   itself is exposed on those two (`whereIn` besides, per the point above),
 *   and that is exercised by `testCanRegisterGroupWithPrefixAndWhere` below.
 * - `testCanSetRouteNameUsingStringBackedEnum`, `testCannotSetRouteNameUsingIntegerBackedEnum`
 *   -- enums are not accepted by `name()`/`as()`, which take a plain string
 *   (see `agent_docs/laravel-parity.md` on enums, and `Request.spec.ts`'s
 *   notes on `testWhenEnumMethod`).
 */

class RouteRegistrarControllerStub {
    public index(): string {
        return "controller";
    }
}

function router(): Router {
    return new Router(new Dispatcher(), new Container());
}

/** PHP: `RouteRegistrarTest::getRoute()`. */
function lastRoute(router: Router): Route {
    const routes = router.getRoutes().getRoutes();
    return routes[routes.size() - 1];
}

export = (): void => {
    // Both helpers below live *inside* this function on purpose: TestEZ
    // installs `expect` with `setfenv` on the callback it is handed
    // (`TestPlan.lua:200`), so a helper declared at module scope would see a
    // nil `expect` and every test using it would fail with "attempt to call a
    // nil value".

    /** PHP: `RouteRegistrarTest::seeResponse()`. */
    function seeResponse(
        route: Route,
        content: unknown,
        request: Request,
    ): void {
        expect(route.matches(request)).to.equal(true);
        expect(route.bind(request).run()).to.equal(content);
    }

    /** PHP: `RouteRegistrarTest::seeMiddleware()`. */
    function seeMiddleware(route: Route, middleware: string): void {
        expect(route.middleware()[0]).to.equal(middleware);
    }

    describe("Routing.RouteRegistrar", () => {
        // PHP: RouteRegistrarTest::testMiddlewareFluentRegistration
        it("Router::middleware() opens a fluent registrar carrying that middleware", () => {
            const r = router();

            r.middleware(["one", "two"]).get("users", () => "all-users");
            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expectDeepEqual(lastRoute(r).middleware(), ["one", "two"]);

            r.middleware(["three", "four"]).get("users", () => "all-users");
            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expectDeepEqual(lastRoute(r).middleware(), ["three", "four"]);

            r.get("users", () => "all-users").middleware(["five", "six"]);
            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expectDeepEqual(lastRoute(r).middleware(), ["five", "six"]);

            r.middleware("seven").get("users", () => "all-users");
            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expectDeepEqual(lastRoute(r).middleware(), ["seven"]);
        });

        // PHP: RouteRegistrarTest::testWithoutMiddlewareRegistration
        it("Route::withoutMiddleware() records excluded middleware", () => {
            const r = router();

            r.middleware(["one", "two"])
                .get("users", () => "all-users")
                .withoutMiddleware("one");

            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expectDeepEqual(lastRoute(r).excludedMiddleware(), ["one"]);
        });

        // PHP: RouteRegistrarTest::testFallbackRoute
        it("Router::fallback() marks the route as a fallback", () => {
            const r = router();
            const route = r.fallback(() => "milwad");
            expect(route.isFallback).to.equal(true);
        });

        // PHP: RouteRegistrarTest::testSetFallbackRoute
        it("Route::setFallback() toggles the fallback flag directly", () => {
            const r = router();
            const route = r.fallback(() => "milwad");

            route.setFallback(false);
            expect(route.isFallback).to.equal(false);

            route.setFallback(true);
            expect(route.isFallback).to.equal(true);
        });

        // PHP: RouteRegistrarTest::testCanRegisterGetRouteWithClosureAction
        it("registers a GET route with a closure action", () => {
            const r = router();
            r.middleware("get-middleware").get("users", () => "all-users");

            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            seeMiddleware(lastRoute(r), "get-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterPostRouteWithClosureAction
        it("registers a POST route with a closure action", () => {
            const r = router();
            r.middleware("post-middleware").post("users", () => "saved");

            seeResponse(
                lastRoute(r),
                "saved",
                new Request({} as Player, "POST", "users"),
            );
            seeMiddleware(lastRoute(r), "post-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterAnyRouteWithClosureAction
        it("registers an ANY route with a closure action", () => {
            const r = router();
            r.middleware("test-middleware").any("users", () => "anything");

            seeResponse(
                lastRoute(r),
                "anything",
                new Request({} as Player, "PUT", "users"),
            );
            seeMiddleware(lastRoute(r), "test-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterMatchRouteWithClosureAction
        it("registers a route matching an explicit verb list", () => {
            const r = router();
            r.middleware("match-middleware").match(
                ["DELETE"],
                "users",
                () => "deleted",
            );

            seeResponse(
                lastRoute(r),
                "deleted",
                new Request({} as Player, "DELETE", "users"),
            );
            seeMiddleware(lastRoute(r), "match-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterRouteWithArrayAndClosureUsesAction
        it("registers a route from an action array carrying a 'uses' closure", () => {
            const r = router();
            r.middleware("put-middleware").put("users", () => "replaced");

            seeResponse(
                lastRoute(r),
                "replaced",
                new Request({} as Player, "PUT", "users"),
            );
            seeMiddleware(lastRoute(r), "put-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterRouteWithControllerActionArray
        it("registers a route from a [Controller, method] pair", () => {
            const r = router();
            r.middleware("controller-middleware").get("users", [
                RouteRegistrarControllerStub,
                "index",
            ]);

            seeResponse(
                lastRoute(r),
                "controller",
                new Request({} as Player, "GET", "users"),
            );
            seeMiddleware(lastRoute(r), "controller-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterRouteWithArrayAndControllerAction
        it("registers a route from an action array carrying a 'uses' controller pair", () => {
            const r = router();
            r.middleware("controller-middleware").put("users", [
                RouteRegistrarControllerStub,
                "index",
            ]);

            seeResponse(
                lastRoute(r),
                "controller",
                new Request({} as Player, "PUT", "users"),
            );
            seeMiddleware(lastRoute(r), "controller-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterGroupWithMiddleware
        it("Router::middleware()->group() applies the middleware to every route in it", () => {
            const r = router();
            r.middleware("group-middleware").group(() => {
                r.get("users", () => "all-users");
            });

            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            seeMiddleware(lastRoute(r), "group-middleware");
        });

        // PHP: RouteRegistrarTest::testCanRegisterGroupWithoutMiddleware
        it("Router::withoutMiddleware()->group() applies the exclusion to every route in it", () => {
            const r = router();
            r.withoutMiddleware("one").group(() => {
                r.get("users", () => "all-users").middleware(["one", "two"]);
            });

            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expectDeepEqual(lastRoute(r).excludedMiddleware(), ["one"]);
        });

        // PHP: RouteRegistrarTest::testCanRegisterGroupWithPrefix
        it("Router::prefix()->group() prefixes every URI in it", () => {
            const r = router();
            r.prefix("api").group(() => {
                r.get("users", [RouteRegistrarControllerStub, "index"]);
            });

            expect(lastRoute(r).uri()).to.equal("api/users");
        });

        // PHP: RouteRegistrarTest::testCanRegisterGroupWithPrefixAndWhere
        it("Router::prefix()->where()->group() applies both to every route in it", () => {
            const r = router();
            r.prefix("foo/{bar}")
                .where({ bar: "%d+" })
                .group(() => {
                    r.get("here", () => "good");
                });

            seeResponse(
                lastRoute(r),
                "good",
                new Request({} as Player, "GET", "foo/12345/here"),
            );
        });

        // PHP: RouteRegistrarTest::testCanRegisterGroupWithNamePrefix
        it("Router::name()->group() prefixes every route name in it", () => {
            const r = router();
            r.name("api.").group(() => {
                r.get("users", [RouteRegistrarControllerStub, "index"]).name(
                    "users",
                );
            });

            expect(lastRoute(r).getName()).to.equal("api.users");
        });

        // PHP: RouteRegistrarTest::testRouteGroupingWithoutPrefix
        it("an empty group still nests a further prefix() call correctly", () => {
            const r = router();
            r.group({}, () => {
                r.prefix("bar")
                    .as("baz")
                    .get("baz", () => "hello");
            });

            seeResponse(
                lastRoute(r),
                "hello",
                new Request({} as Player, "GET", "bar/baz"),
            );
        });

        // PHP: RouteRegistrarTest::testRouteGroupChaining
        it("Router::group() returns the router, so calls chain", () => {
            const r = router();
            r.group({}, () => {
                r.get("foo", () => "hello");
            }).group({}, () => {
                r.get("bar", () => "goodbye");
            });

            const routes = r.getRoutes();
            expect(
                routes.match(new Request({} as Player, "GET", "foo")),
            ).to.be.ok();
            expect(
                routes.match(new Request({} as Player, "GET", "bar")),
            ).to.be.ok();
        });

        // PHP: RouteRegistrarTest::testCanSetRouteName
        it("Router::as() opens a fluent registrar carrying that name", () => {
            const r = router();
            r.as("users.index").get("users", () => "all-users");

            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expect(lastRoute(r).getName()).to.equal("users.index");
        });

        // PHP: RouteRegistrarTest::testCanSetRouteNameUsingNameAlias
        it("Router::name() is an alias for as()", () => {
            const r = router();
            r.name("users.index").get("users", () => "all-users");

            seeResponse(
                lastRoute(r),
                "all-users",
                new Request({} as Player, "GET", "users"),
            );
            expect(lastRoute(r).getName()).to.equal("users.index");
        });

        // PHP: RouteRegistrarTest::testPushMiddlewareToGroup
        it("Router::pushMiddlewareToGroup() appends to an existing group", () => {
            const r = router();
            r.middlewareGroup("web", []);
            r.pushMiddlewareToGroup("web", "test-middleware");

            expectDeepEqual(r.getMiddlewareGroups().get("web"), [
                "test-middleware",
            ]);
        });

        // PHP: RouteRegistrarTest::testPushMiddlewareToGroupUnregisteredGroup
        it("Router::pushMiddlewareToGroup() creates the group if it did not exist", () => {
            const r = router();
            r.pushMiddlewareToGroup("web", "test-middleware");

            expectDeepEqual(r.getMiddlewareGroups().get("web"), [
                "test-middleware",
            ]);
        });

        // PHP: RouteRegistrarTest::testPushMiddlewareToGroupDuplicatedMiddleware
        it("Router::pushMiddlewareToGroup() does not duplicate an existing entry", () => {
            const r = router();
            r.pushMiddlewareToGroup("web", "test-middleware");
            r.pushMiddlewareToGroup("web", "test-middleware");

            expectDeepEqual(r.getMiddlewareGroups().get("web"), [
                "test-middleware",
            ]);
        });

        // PHP: RouteRegistrarTest::testCanRemoveMiddlewareFromGroup
        it("Router::removeMiddlewareFromGroup() removes a registered entry", () => {
            const r = router();
            r.pushMiddlewareToGroup("web", "test-middleware");
            r.removeMiddlewareFromGroup("web", "test-middleware");

            expectDeepEqual(r.getMiddlewareGroups().get("web"), []);
        });

        // PHP: RouteRegistrarTest::testCanRemoveMiddlewareFromGroupNotUnregisteredMiddleware
        it("Router::removeMiddlewareFromGroup() is a no-op for an entry that was never there", () => {
            const r = router();
            r.middlewareGroup("web", []);
            r.removeMiddlewareFromGroup("web", "different-test-middleware");

            expectDeepEqual(r.getMiddlewareGroups().get("web"), []);
        });

        // PHP: RouteRegistrarTest::testCanRemoveMiddlewareFromGroupUnregisteredGroup
        it("Router::removeMiddlewareFromGroup() does not create the group if it did not exist", () => {
            const r = router();
            r.removeMiddlewareFromGroup("web", "test-middleware");

            expect(r.getMiddlewareGroups().size()).to.equal(0);
        });

        // PHP: RouteRegistrarTest::testWhereNumberRegistration
        //
        // The expression itself is a Luau pattern rather than PCRE (`Route.ts`'s
        // `where()` class comment), so it does not read `[0-9]+` the way PHP's
        // does -- `whereNumber()`'s own expression (`%d+`, from `Route.ts`) is
        // asserted here instead.
        it("Route::whereNumber() assigns the numeric pattern to every parameter named", () => {
            const r = router();
            const wheres = { foo: "%d+", bar: "%d+" };

            r.get("/{foo}/{bar}").whereNumber(["foo", "bar"]);
            r.get("/api/{bar}/{foo}").whereNumber(["bar", "foo"]);

            for (const route of r.getRoutes().getRoutes()) {
                expectDeepEqual(route.wheres, wheres);
            }
        });

        // PHP: RouteRegistrarTest::testWhereAlphaRegistration
        it("Route::whereAlpha() assigns the alphabetic pattern to every parameter named", () => {
            const r = router();
            const wheres = { foo: "%a+", bar: "%a+" };

            r.get("/{foo}/{bar}").whereAlpha(["foo", "bar"]);
            r.get("/api/{bar}/{foo}").whereAlpha(["bar", "foo"]);

            for (const route of r.getRoutes().getRoutes()) {
                expectDeepEqual(route.wheres, wheres);
            }
        });

        // PHP: RouteRegistrarTest::testWhereAlphaNumericRegistration
        it("Route::whereAlphaNumeric() assigns the alphanumeric pattern to the parameter named", () => {
            const r = router();
            const wheres = { "1a2b3c": "%w+" };

            r.get("/{foo}").whereAlphaNumeric(["1a2b3c"]);

            for (const route of r.getRoutes().getRoutes()) {
                expectDeepEqual(route.wheres, wheres);
            }
        });

        // PHP: RouteRegistrarTest::testWhereUlidRegistration
        it("Route::whereUlid() only matches a syntactically valid ULID segment", () => {
            const r = router();
            r.get("/{foo}").whereUlid("foo");
            const route = r.getRoutes().getRoutes()[0];

            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/01ARZ3NDEKTSV4RRFFQ69G5FAV",
                    ),
                ),
            ).to.equal(true);
            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/01ARZ3NDEKTSV4RRFFQ69G5FA",
                    ),
                ),
            ).to.equal(false);
            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/01ARZ3NDEKTSV4RRFFQ69G5FAI",
                    ),
                ),
            ).to.equal(false);
            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/81ARZ3NDEKTSV4RRFFQ69G5FAV",
                    ),
                ),
            ).to.equal(false);
        });

        // PHP: RouteRegistrarTest::testWhereUuidRegistration
        it("Route::whereUuid() only matches a syntactically valid UUID segment", () => {
            const r = router();
            r.get("/{foo}").whereUuid("foo");
            const route = r.getRoutes().getRoutes()[0];

            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/2cd90b6d-3c34-4a0a-9d0d-9d0b7b1a2e6f",
                    ),
                ),
            ).to.equal(true);
            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/2CD90B6D-3C34-4A0A-9D0D-9D0B7B1A2E6F",
                    ),
                ),
            ).to.equal(true);
            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/2cd90b6d3c344a0a9d0d9d0b7b1a2e6f",
                    ),
                ),
            ).to.equal(false);
            expect(
                route.matches(
                    new Request(
                        {} as Player,
                        "GET",
                        "/2cd90b6d-3c34-4a0a-9d0d-9d0b7b1a2e6",
                    ),
                ),
            ).to.equal(false);
        });
    });
};
