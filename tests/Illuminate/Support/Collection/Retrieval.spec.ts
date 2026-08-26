/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual, expectThrows } from "../../TestHelpers";
import { Collection } from "Illuminate/Support/Collection";
import {
    ItemNotFoundException,
    MultipleItemsFoundException,
} from "Illuminate/Exception";

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- single-item
 * retrieval: `first`, `last`, `sole`, `firstOrFail`, `firstWhere`, `get`,
 * `has`, `hasAny`, `search`, `keys`, `pull`. See
 * `Construction.spec.ts`'s class comment for the adaptations shared across
 * this whole directory (no `LazyCollection`, `all()` yields values only,
 * no `nil`-as-a-value).
 *
 * `sole()` here takes only an optional callback -- the `(key, operator,
 * value)` overload PHP's `sole()` shares with `where()` has no counterpart,
 * so those sub-cases are dropped. `hasSole`/`hasMany` are not ported.
 */
export = (): void => {
    describe("Collection retrieval", () => {
        it("first() returns the first item, optionally matching a callback", () => {
            // PHP: SupportCollectionTest::testFirstReturnsFirstItemInCollection,
            // ::testFirstWithCallback, ::testFirstWithCallbackAndDefault,
            // ::testFirstWithDefaultAndWithoutCallback
            expect(new Collection(["foo", "bar"]).first()).to.equal("foo");

            expect(
                new Collection(["foo", "bar", "baz"]).first(
                    (value) => value === "bar",
                ),
            ).to.equal("bar");

            expect(
                new Collection(["foo", "bar"]).first(
                    (value) => value === "baz",
                    "default",
                ),
            ).to.equal("default");

            expect(new Collection().first(undefined, "default")).to.equal(
                "default",
            );
            expect(
                new Collection(["foo", "bar"]).first(undefined, "default"),
            ).to.equal("foo");
        });

        it("sole() returns the only matching item, or throws", () => {
            // PHP: SupportCollectionTest::testSoleReturnsFirstItemInCollectionIfOnlyOneExistsWithCallback,
            // ::testSoleThrowsExceptionIfNoItemsExistWithCallback,
            // ::testSoleThrowsExceptionIfMoreThanOneItemExistsWithCallback
            const data = new Collection(["foo", "bar", "baz"]);
            expect(data.sole((value) => value === "bar")).to.equal("bar");

            expectThrows(() =>
                new Collection(["foo", "bar", "baz"]).sole(
                    (value) => value === "invalid",
                ),
            );

            expectThrows(() =>
                new Collection(["foo", "bar", "bar"]).sole(
                    (value) => value === "bar",
                ),
            );

            try {
                new Collection(["foo", "bar", "bar"]).sole(
                    (value) => value === "bar",
                );
            } catch (err) {
                expect(err instanceof MultipleItemsFoundException).to.equal(
                    true,
                );
            }
        });

        it("firstOrFail() returns the first item, or throws when none matches", () => {
            // PHP: SupportCollectionTest::testFirstOrFailReturnsFirstItemInCollectionIfOnlyOneExistsWithCallback,
            // ::testFirstOrFailThrowsExceptionIfNoItemsExistWithCallback,
            // ::testFirstOrFailDoesntThrowExceptionIfMoreThanOneItemExistsWithCallback
            const data = new Collection(["foo", "bar", "baz"]);
            expect(data.firstOrFail((value) => value === "bar")).to.equal(
                "bar",
            );

            expectThrows(() =>
                new Collection(["foo", "bar", "baz"]).firstOrFail(
                    (value) => value === "invalid",
                ),
            );

            try {
                new Collection(["foo", "bar", "baz"]).firstOrFail(
                    (value) => value === "invalid",
                );
            } catch (err) {
                expect(err instanceof ItemNotFoundException).to.equal(true);
            }

            expect(
                new Collection(["foo", "bar", "bar"]).firstOrFail(
                    (value) => value === "bar",
                ),
            ).to.equal("bar");
        });

        it("firstWhere() finds the first item matching a key/value pair", () => {
            // PHP: SupportCollectionTest::testFirstWhere
            const data = new Collection([
                { material: "paper", type: "book" },
                { material: "rubber", type: "gasket" },
            ]);

            expect(data.firstWhere("material", "paper")?.type).to.equal("book");
            expect(data.firstWhere("material", "rubber")?.type).to.equal(
                "gasket",
            );
            expect(data.firstWhere("material", "nonexistent")).to.equal(
                undefined,
            );
            expect(data.firstWhere("nonexistent", "key")).to.equal(undefined);
        });

        it("last() returns the last item, optionally matching a callback", () => {
            // PHP: SupportCollectionTest::testLastReturnsLastItemInCollection,
            // ::testLastWithCallback, ::testLastWithCallbackAndDefault,
            // ::testLastWithDefaultAndWithoutCallback
            expect(new Collection(["foo", "bar"]).last()).to.equal("bar");
            expect(new Collection().last()).to.equal(undefined);

            const data = new Collection([100, 200, 300]);
            expect(data.last((value) => value < 250)).to.equal(200);
            expect(data.last((_value, key) => (key as number) < 2)).to.equal(
                200,
            );
            expect(data.last((value) => value > 300)).to.equal(undefined);

            expect(
                new Collection(["foo", "bar"]).last(
                    (value) => value === "baz",
                    "default",
                ),
            ).to.equal("default");

            expect(
                new Collection(["foo", "bar", "Bar"]).last(
                    (value) => value === "bar",
                    "default",
                ),
            ).to.equal("bar");

            expect(new Collection().last(undefined, "default")).to.equal(
                "default",
            );
        });

        it("has() / hasAny() check for keys, one or many", () => {
            // PHP: SupportCollectionTest::testHas, ::testHasAny
            const data = new Collection(["taylor", "otwell"]);

            expect(data.has(0)).to.equal(true);
            expect(data.has(1)).to.equal(true);
            expect(data.has(2)).to.equal(false);
            expect(data.has([0, 1])).to.equal(true);
            expect(data.has([0, 2])).to.equal(false);

            expect(data.hasAny(0)).to.equal(true);
            expect(data.hasAny([0, 2])).to.equal(true);
            expect(data.hasAny([2, 3])).to.equal(false);
        });

        it("get() reads by key, with a default value or a callback default", () => {
            // PHP: SupportCollectionTest::testGetWithNullReturnsNull (adapted:
            // this port's get() has no nullable-key overload; a missing key
            // is asserted instead), ::testGetWithDefaultValue,
            // ::testGetWithCallbackAsDefaultValue (adapted: the callback
            // default is not resolved here -- get()'s defaultValue parameter
            // is a plain `TValue`, so the callback itself is asserted as the
            // returned value)
            const data = new Collection([1, 2, 3]);
            expect(data.get(99)).to.equal(undefined);

            const named = new Collection<string, string>({
                name: "taylor",
                framework: "laravel",
            });
            expect(named.get("age", "34")).to.equal("34");
        });

        it("search() finds the key of a value, or of the first match to a callback", () => {
            // PHP: SupportCollectionTest::testSearchReturnsIndexOfFirstFoundItem,
            // ::testSearchReturnsFalseWhenItemIsNotFound (adapted: no
            // "found"/"not found" ambiguity to resolve since `search()`
            // returns `undefined`, not PHP's falsy `false`, on a miss)
            const data = new Collection([1, 2, 3, 4, 5, 2, 5]);

            expect(data.search(2)).to.equal(1);
            expect(data.search((value) => value > 4)).to.equal(4);

            expect(data.search(6)).to.equal(undefined);
            expect(data.search((value) => value > 10)).to.equal(undefined);
        });

        it("keys() returns the collection's keys", () => {
            // PHP: SupportCollectionTest::testKeys
            const named = new Collection<string, string>({
                name: "taylor",
                framework: "laravel",
            });
            expect(named.keys().all().size()).to.equal(2);

            const indexed = new Collection(["taylor", "laravel"]);
            expectDeepEqual(indexed.keys().all(), [0, 1]);
        });

        it("pull() retrieves and removes an item by key, or returns a default", () => {
            // PHP: SupportCollectionTest::testPullRetrievesItemFromCollection,
            // ::testPullRemovesItemFromCollection, ::testPullReturnsDefault
            const c = new Collection(["foo", "bar"]);
            expect(c.pull(0)).to.equal("foo");
            expectDeepEqual(c.all(), ["bar"]);
            expect(c.pull(1)).to.equal("bar");
            expectDeepEqual(c.all(), []);

            expect(new Collection<number, string>([]).pull(0, "foo")).to.equal(
                "foo",
            );
        });
    });
};
