/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { RouteGroup } from "Illuminate/Routing/RouteGroup";
import { Router } from "Illuminate/Routing/Router";
import type { ActionAttributes } from "Illuminate/Routing/RouteAction";

/**
 * PHP: `Illuminate\Tests\Routing\RoutingRouteTest`, the group-merging and
 * -prefixing cases (`testGroupMerging`, `testRouteGrouping` and neighbours).
 * See `Route/Matching.spec.ts`'s header for the `getRouter()` stand-in.
 *
 * Not ported, and why:
 *
 * - `testRouteGroupingOutsideOfInheritedNamespace`, `testMergingControllerUses`
 *   -- `namespace` merging on `RouteGroup`; not merged here at all (see
 *   `RouteGroup.ts`'s class comment: "`namespace` and `domain` are not
 *   merged: neither exists here"), and both also use the `'Controller@action'`
 *   string action form, which is not ported either.
 * - `testRouteGroupingFromFile` -- `Router::group()`'s second argument as a
 *   file path to `include`; there is no filesystem `include` here, only the
 *   closure form (`Router.ts`'s `group()` takes a callback).
 */

function router(): Router {
    return new Router(new Dispatcher(), new Container());
}

export = (): void => {
    describe("Routing.Route.Grouping", () => {
        // PHP: RoutingRouteTest::testGroupMerging
        it("RouteGroup::merge() joins prefixes, names, and where clauses", () => {
            let old: ActionAttributes = { prefix: "foo/bar/" };
            expectDeepEqual(RouteGroup.merge({ prefix: "baz" }, old), {
                prefix: "foo/bar/baz",
            });

            old = { as: "foo." };
            expectDeepEqual(RouteGroup.merge({ as: "bar" }, old), {
                as: "foo.bar",
            });

            old = { where: { var1: "foo", var2: "bar" } };
            expectDeepEqual(RouteGroup.merge({ where: { var2: "baz", var3: "qux" } }, old), {
                where: { var1: "foo", var2: "baz", var3: "qux" },
            });

            old = {};
            expectDeepEqual(RouteGroup.merge({ where: { var1: "foo", var2: "bar" } }, old), {
                where: { var1: "foo", var2: "bar" },
            });
        });

        // PHP: RoutingRouteTest::testRouteGrouping, the getPrefix() case
        it("Router::group()'s prefix lands on the route via Route::getPrefix()", () => {
            const r = router();
            r.group({ prefix: "foo" }, () => {
                r.get("bar", () => "hello");
            });

            const routes = r.getRoutes().getRoutes();
            expect(routes[0].getPrefix()).to.equal("foo");
        });

        // PHP: RoutingRouteTest::testRouteGroupingWithAs
        it("a group's 'as' prefixes the named route inside it", () => {
            const r = router();
            r.group({ prefix: "foo", as: "Foo::" }, () => {
                r.get("bar", { as: "bar", uses: () => "hello" });
            });

            const route = r.getRoutes().getByName("Foo::bar");
            expect(route?.uri()).to.equal("foo/bar");
        });

        // PHP: RoutingRouteTest::testNestedRouteGroupingWithAs
        it("nested groups compose their 'as' and prefix in nesting order", () => {
            let r = router();
            r.group({ prefix: "foo", as: "Foo::" }, () => {
                r.group({ prefix: "bar", as: "Bar::" }, () => {
                    r.get("baz", { as: "baz", uses: () => "hello" });
                });
            });

            let route = r.getRoutes().getByName("Foo::Bar::baz");
            expect(route?.uri()).to.equal("foo/bar/baz");

            // A further prefix() call inside a group that skipped its own layer
            // still prepends onto the outer group's prefix.
            r = router();
            r.group({ prefix: "foo", as: "Foo::" }, () => {
                r.group({ prefix: "bar" }, () => {
                    r.prefix("foz")
                        .as("baz")
                        .get("baz", () => "hello");
                });
            });

            route = r.getRoutes().getByName("Foo::baz");
            expect(route?.uri()).to.equal("foz/foo/bar/baz");
        });

        // PHP: RoutingRouteTest::testNestedRouteGroupingPrefixing
        it("Route::getPrefix() reports the raw prefix, unaffected by a nested prefix() call", () => {
            const r = router();
            r.group({ prefix: "foo", as: "Foo::" }, () => {
                r.prefix("bar")
                    .as("baz")
                    .get("baz", () => "hello");
            });

            const route = r.getRoutes().getByName("Foo::baz");
            expect(route?.getPrefix()).to.equal("bar/foo");
        });

        // PHP: RoutingRouteTest::testRouteMiddlewareMergeWithMiddlewareAttributesAsStrings
        it("a group's string middleware and the route's own middleware both survive", () => {
            const r = router();
            r.group({ prefix: "foo", middleware: ["boo:foo"] }, () => {
                r.get("bar", () => "hello").middleware("baz:gaz");
            });

            const route = r.getRoutes().getRoutes()[0];
            expectDeepEqual(route.middleware(), ["boo:foo", "baz:gaz"]);
        });

        // PHP: RoutingRouteTest::testRoutePrefixing
        it("Route::prefix() joins onto the URI, including the '/' and homepage edge cases", () => {
            // Prefix route.
            let r = router();
            r.get("foo/bar", () => "hello");
            let routes = r.getRoutes().getRoutes();
            routes[0].prefix("prefix");
            expect(routes[0].uri()).to.equal("prefix/foo/bar");

            // An empty prefix changes nothing.
            r = router();
            r.get("foo/bar", () => "hello");
            routes = r.getRoutes().getRoutes();
            routes[0].prefix("/");
            expect(routes[0].uri()).to.equal("foo/bar");

            // Prefixing the homepage.
            r = router();
            r.get("/", () => "hello");
            routes = r.getRoutes().getRoutes();
            routes[0].prefix("prefix");
            expect(routes[0].uri()).to.equal("prefix");

            // Prefixing the homepage with an empty prefix.
            r = router();
            r.get("/", () => "hello");
            routes = r.getRoutes().getRoutes();
            routes[0].prefix("/");
            expect(routes[0].uri()).to.equal("/");
        });

        // PHP: RoutingRouteTest::testRoutePrefixParameterParsing
        it("Route::uri() strips a {param:field} binding field down to {param} inside a prefix", () => {
            const route = router().get("foo", () => "hello");
            route.prefix("profiles/{user:username}/portfolios");

            expect(route.uri()).to.equal("profiles/{user}/portfolios/foo");
        });
    });
};
