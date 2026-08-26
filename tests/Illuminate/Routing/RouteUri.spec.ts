/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../TestHelpers";
import { RouteUri } from "Illuminate/Routing/RouteUri";

/**
 * PHP: `Illuminate\Tests\Routing\RouteUriTest`.
 *
 * Ported in full -- `RouteUri::parse()` is unchanged from PHP other than
 * walking the URI a segment at a time (see `RouteUri.ts`'s class comment).
 */
export = (): void => {
    describe("Routing.RouteUri", () => {
        // PHP: RouteUriTest::testRouteUrisAreProperlyParsed (data provider inlined)
        it("parses URIs, extracting binding fields", () => {
            const cases: Array<[string, string, Record<string, string>]> = [
                ["/foo", "/foo", {}],
                ["/foo/{bar}", "/foo/{bar}", {}],
                ["/foo/{bar}/baz/{qux}", "/foo/{bar}/baz/{qux}", {}],
                ["/foo/{bar}/baz/{qux?}", "/foo/{bar}/baz/{qux?}", {}],
                ["/foo/{bar:slug}", "/foo/{bar}", { bar: "slug" }],
                [
                    "/foo/{bar}/baz/{qux:slug}",
                    "/foo/{bar}/baz/{qux}",
                    { qux: "slug" },
                ],
                [
                    "/foo/{bar}/baz/{qux:slug?}",
                    "/foo/{bar}/baz/{qux?}",
                    { qux: "slug" },
                ],
                [
                    "/foo/{bar}/baz/{qux:slug?}/{test:id?}",
                    "/foo/{bar}/baz/{qux?}/{test?}",
                    { qux: "slug", test: "id" },
                ],
            ];

            for (const [uri, expectedUri, expectedBindingFields] of cases) {
                const parsed = RouteUri.parse(uri);
                expect(parsed.uri).to.equal(expectedUri);
                expectDeepEqual(parsed.bindingFields, expectedBindingFields);
            }
        });
    });
};
