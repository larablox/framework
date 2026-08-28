/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../TestHelpers";
import { SortedMiddleware } from "Illuminate/Routing/SortedMiddleware";

/**
 * PHP: `Illuminate\Tests\Routing\RoutingSortedMiddlewareTest`.
 *
 * A middleware is a class name (a string) in PHP; here it is the class
 * itself, or `[class, ...args]` -- see `SortedMiddleware.ts`'s class comment.
 * The string-keyed fixtures (`'First:api'`, `'Third:foo'`, ...) below stand
 * in for that array form as plain strings, since `SortedMiddleware` only
 * needs `Str::before(':')` on them; the parent/contract fixtures use real
 * classes to exercise `Reflector::parentClass()`.
 */
export = (): void => {
    describe("Routing.SortedMiddleware", () => {
        // PHP: RoutingSortedMiddlewareTest::testMiddlewareCanBeSortedByPriority
        it("sorts middleware by priority, moving lower-priority entries forward", () => {
            const priority = ["First", "Second", "Third"];

            const middleware = [
                "Something",
                "Something",
                "Something",
                "Something",
                "Second",
                "Otherthing",
                "First:api",
                "Third:foo",
                "First:foo,bar",
                "Third",
                "Second",
            ];

            const expected = ["Something", "First:api", "First:foo,bar", "Second", "Otherthing", "Third:foo", "Third"];

            expectDeepEqual(new SortedMiddleware(priority, middleware).all(), expected);

            expectDeepEqual(new SortedMiddleware(["First"], []).all(), []);
            expectDeepEqual(new SortedMiddleware(["First"], ["First"]).all(), ["First"]);
            expectDeepEqual(new SortedMiddleware(["First", "Second"], ["Second", "First"]).all(), ["First", "Second"]);
        });

        // PHP: RoutingSortedMiddlewareTest::testItDoesNotMoveNonStringValues
        it("does not move closures, since they carry no class name", () => {
            const closure = () => "foo";
            const closure2 = () => "bar";

            expectDeepEqual(new SortedMiddleware([1, 2] as never, [2, 1] as never).all(), [2, 1]);
            expectDeepEqual(new SortedMiddleware(["First", "Second"], ["Second", closure]).all(), ["Second", closure]);
            expectDeepEqual(new SortedMiddleware(["a", "b"], ["b", closure, "a"]).all(), ["a", "b", closure]);
            expectDeepEqual(new SortedMiddleware(["a", "b"], [closure2, "b", closure, "a", "foo"]).all(), [
                closure2,
                "a",
                "b",
                closure,
                "foo",
            ]);
            expectDeepEqual(new SortedMiddleware(["a", "b"], [closure, "b", closure2, "foo", "a"]).all(), [
                closure,
                "a",
                "b",
                closure2,
                "foo",
            ]);
            expectDeepEqual(new SortedMiddleware(["a", "b"], ["a", closure, "b", closure2, "foo"]).all(), [
                "a",
                closure,
                "b",
                closure2,
                "foo",
            ]);
            expectDeepEqual(new SortedMiddleware(["a", "b"], [closure, closure2, "foo", "a"]).all(), [
                closure,
                closure2,
                "foo",
                "a",
            ]);
        });

        // PHP: RoutingSortedMiddlewareTest::testItSortsUsingParentsAndContracts
        it("sorts using classes and their parent chain", () => {
            class SecondStub {}
            class SecondChildStub extends SecondStub {}

            // PHP's `FirstContractStub`/`FirstStub` pair exercises interface
            // walking, which leaves no runtime trace here (see
            // `SortedMiddleware.ts`'s class comment) -- `FirstStub` alone stands
            // in for the priority list entry. `'FirstStub::class.":api"'` -- a
            // class name with its arguments appended -- is `[FirstStub, "api"]`
            // here, since a middleware carries its arguments beside it rather
            // than encoded into a string (see `SortedMiddleware.ts`'s class
            // comment).
            class FirstStub {}

            const withApi: [typeof FirstStub, string] = [FirstStub, "api"];
            const withFooBar: [typeof FirstStub, string, string] = [FirstStub, "foo", "bar"];

            const priority = [FirstStub, SecondStub, "Third"];

            const middleware = [
                "Something",
                "Something",
                "Something",
                "Something",
                SecondChildStub,
                "Otherthing",
                withApi,
                "Third:foo",
                withFooBar,
                "Third",
                SecondChildStub,
            ];

            const expected = ["Something", withApi, withFooBar, SecondChildStub, "Otherthing", "Third:foo", "Third"];

            expectDeepEqual(new SortedMiddleware(priority, middleware).all(), expected);
        });
    });
};
