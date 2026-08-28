/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Collection } from "Illuminate/Support/Collection";
import { Util } from "Illuminate/Container/Util";

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `filter`,
 * `reject`, `where`/`whereIn`/`whereNotIn`/`whereNull`/`whereNotNull`/
 * `whereInstanceOf`, `only`, `except`. See `Construction.spec.ts`'s class
 * comment for the adaptations shared across this directory.
 *
 * `where()` here has no `===`/`!==` strict-comparison behavior -- only the
 * loose operators PHP's `Collection::operatorForWhere()` also treats
 * loosely (`=`, `==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, and anything else
 * falling back to `=`). The `===`/`!==` sub-cases of `testWhere` are
 * dropped, along with `whereStrict`/`whereInStrict`/`whereNotInStrict`
 * (not ported at all).
 */
export = (): void => {
    describe("Collection filtering", () => {
        it("filter() keeps items passing a truth test, or truthy items with no callback", () => {
            // PHP: SupportCollectionTest::testFilter
            const c = new Collection([
                { id: 1, name: "Hello" },
                { id: 2, name: "World" },
            ]);
            expectDeepEqual(c.filter((item) => item.id === 2).all(), [{ id: 2, name: "World" }]);

            const truthy = new Collection(["", "Hello", "", "World"]);
            expectDeepEqual(truthy.filter().values().toArray(), ["Hello", "World"]);
        });

        it("reject() removes items passing a truth test, or truthy items with no callback", () => {
            // PHP: SupportCollectionTest::testRejectRemovesElementsPassingTruthTest,
            // ::testRejectWithoutAnArgumentRemovesTruthyValues
            const c = new Collection(["foo", "bar"]);
            expectDeepEqual(
                c
                    .reject((value) => value === "bar")
                    .values()
                    .all(),
                ["foo"],
            );

            expectDeepEqual(
                c
                    .reject((value) => value === "baz")
                    .values()
                    .all(),
                ["foo", "bar"],
            );

            const data1 = new Collection<number, boolean | number>([false, true, 0]);
            expectDeepEqual(data1.reject((value) => Util.truthy(value)).all(), [false, 0]);

            const data2 = new Collection<string, boolean>({
                a: true,
                b: true,
                c: true,
            });
            expect(data2.reject((value) => Util.truthy(value)).isEmpty()).to.equal(true);
        });

        it("where() filters items by a key/value pair, with an operator or none", () => {
            // PHP: SupportCollectionTest::testWhere
            const c = new Collection([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]);

            expectDeepEqual(c.where("v", 3).values().all(), [{ v: 3 }]);
            expectDeepEqual(c.where("v", "=", 3).values().all(), [{ v: 3 }]);
            expectDeepEqual(c.where("v", "==", 3).values().all(), [{ v: 3 }]);

            expectDeepEqual(c.where("v", "<>", 3).values().all(), [{ v: 1 }, { v: 2 }, { v: 4 }]);
            expectDeepEqual(c.where("v", "!=", 3).values().all(), [{ v: 1 }, { v: 2 }, { v: 4 }]);
            expectDeepEqual(c.where("v", "<=", 3).values().all(), [{ v: 1 }, { v: 2 }, { v: 3 }]);
            expectDeepEqual(c.where("v", ">=", 3).values().all(), [{ v: 3 }, { v: 4 }]);
            expectDeepEqual(c.where("v", "<", 3).values().all(), [{ v: 1 }, { v: 2 }]);
            expectDeepEqual(c.where("v", ">", 3).values().all(), [{ v: 4 }]);

            // This port's `where()` only takes the key/operator/value form --
            // the callback form is `filter()`.
            expectDeepEqual(
                c
                    .filter((value) => value.v === 3)
                    .values()
                    .all(),
                [{ v: 3 }],
            );

            // Chaining `where()` narrows further, same as filter() would.
            const g = new Collection([
                { v: 1, g: 3 },
                { v: 2, g: 2 },
                { v: 2, g: 3 },
                { v: 2, g: 4 },
            ]);
            expectDeepEqual(g.where("v", 2).where("g", 3).values().all(), [{ v: 2, g: 3 }]);
            expectDeepEqual(g.where("v", 2).where("g", ">", 2).values().all(), [
                { v: 2, g: 3 },
                { v: 2, g: 4 },
            ]);
        });

        it("whereInstanceOf() keeps items of a given type", () => {
            // PHP: SupportCollectionTest::testWhereInstanceOf (narrowed to a
            // single class rather than the array-of-classes overload)
            const c = new Collection([new Collection(), "not a collection", new Collection([1])]);
            expect(c.whereInstanceOf(Collection).count()).to.equal(2);
        });

        it("whereIn() / whereNotIn() filter by membership in a value list", () => {
            // PHP: SupportCollectionTest::testWhereIn, ::testWhereNotIn
            const c = new Collection([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]);

            expectDeepEqual(c.whereIn("v", [1, 3]).values().all(), [{ v: 1 }, { v: 3 }]);
            expectDeepEqual(c.whereIn("v", [2]).whereIn("v", [1, 3]).values().all(), []);

            expectDeepEqual(c.whereNotIn("v", [1, 3]).values().all(), [{ v: 2 }, { v: 4 }]);
        });

        it("whereNull() / whereNotNull() filter by a key being undefined or not", () => {
            // PHP: SupportCollectionTest::testWhereNull, ::testWhereNotNull
            // (the no-key overload of both methods is dropped -- this
            // port's `whereNull`/`whereNotNull` require a key)
            const data = new Collection([{ name: "Taylor" }, { name: undefined }, { name: "Bert" }]);

            expectDeepEqual(data.whereNull("name").values().all(), [{ name: undefined }]);
            expectDeepEqual(data.whereNotNull("name").values().all(), [{ name: "Taylor" }, { name: "Bert" }]);
        });

        it("only() / except() keep or drop items by key", () => {
            // PHP: SupportCollectionTest::testOnly, ::testExcept
            const data = new Collection<string, string>({
                first: "Taylor",
                last: "Otwell",
                email: "taylorotwell@gmail.com",
            });

            expectDeepEqual(data.only(["first", "missing"]).all(), ["Taylor"]);
            expectDeepEqual(data.only("first").all(), ["Taylor"]);

            const excepted = data.except("email");
            expect(excepted.count()).to.equal(2);
            expect(excepted.has("email")).to.equal(false);
        });
    });
};
