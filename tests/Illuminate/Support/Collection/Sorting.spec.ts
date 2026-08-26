/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Collection } from "Illuminate/Support/Collection";

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `sort`,
 * `sortDesc`, `sortBy`, `sortByDesc`, `sortKeys`, `sortKeysDesc`,
 * `reverse`, `shuffle`. See `Construction.spec.ts`'s class comment for the
 * adaptations shared across this directory.
 *
 * None of `sort()`/`sortBy()`/`sortDesc()` take PHP's `$options` sort-flag
 * argument (`SORT_STRING`, `SORT_NATURAL`, ...) -- every PHP sub-case that
 * exercises a flag is dropped; `Collection.compare()`'s natural
 * number/string ordering is exercised through its default behavior
 * instead. `sortBy()`'s array-of-`[key, direction]` "sort by many" form and
 * `sortKeysUsing()` are not ported.
 */
export = (): void => {
    describe("Collection sorting", () => {
        it("sort() orders values naturally", () => {
            // PHP: SupportCollectionTest::testSort
            expectDeepEqual(
                new Collection([5, 3, 1, 2, 4]).sort().values().all(),
                [1, 2, 3, 4, 5],
            );

            expectDeepEqual(
                new Collection([-1, -3, -2, 0, 2, 1]).sort().values().all(),
                [-3, -2, -1, 0, 1, 2],
            );
        });

        it("sortDesc() orders values in reverse", () => {
            // PHP: SupportCollectionTest::testSortDesc
            expectDeepEqual(
                new Collection([5, 3, 1, 2, 4]).sortDesc().values().all(),
                [5, 4, 3, 2, 1],
            );
        });

        it("sort() accepts a comparator callback", () => {
            // PHP: SupportCollectionTest::testSortWithCallback
            const data = new Collection([5, 3, 1, 2, 4]).sort(
                (first, second) => first - second,
            );

            expectDeepEqual(data.values().all(), [1, 2, 3, 4, 5]);
        });

        it("sortBy() / sortByDesc() order by the result of a callback or a key", () => {
            // PHP: SupportCollectionTest::testSortBy, ::testSortByString
            const data = new Collection(["taylor", "dayle"]).sortBy(
                (name) => name,
            );
            expectDeepEqual(data.values().all(), ["dayle", "taylor"]);

            const desc = new Collection(["dayle", "taylor"]).sortByDesc(
                (name) => name,
            );
            expectDeepEqual(desc.values().all(), ["taylor", "dayle"]);

            const byKey = new Collection([
                { name: "taylor" },
                { name: "dayle" },
            ]).sortBy("name");
            expectDeepEqual(byKey.values().all(), [
                { name: "dayle" },
                { name: "taylor" },
            ]);
        });

        it("sortKeys() / sortKeysDesc() order by key", () => {
            // PHP: SupportCollectionTest::testSortKeys, ::testSortKeysDesc
            const data = new Collection<string, string>({
                b: "dayle",
                a: "taylor",
            });

            expectDeepEqual(data.sortKeys().entries(), [
                ["a", "taylor"],
                ["b", "dayle"],
            ]);
            expectDeepEqual(data.sortKeysDesc().entries(), [
                ["b", "dayle"],
                ["a", "taylor"],
            ]);
        });

        it("reverse() reverses item order while keeping keys", () => {
            // PHP: SupportCollectionTest::testReverse
            const data = new Collection(["zaeed", "alan"]);
            const reversed = data.reverse();

            expectDeepEqual(reversed.entries(), [
                [1, "alan"],
                [0, "zaeed"],
            ]);
        });

        it("shuffle() keeps the same values, in some order", () => {
            // PHP: SupportCollectionTest::testShuffleActuallyShuffles is not
            // reproducible deterministically (see `Arr/SequenceAccess.spec.ts`
            // for the analogous adaptation on `Arr.shuffle()`) -- only the
            // "keeps the same values" invariant is asserted here.
            const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const shuffled = new Collection(input).shuffle().values().all();

            expect(shuffled.size()).to.equal(input.size());
            for (const value of input) {
                expect(shuffled.includes(value)).to.equal(true);
            }

            expect(
                new Collection<number, number>().shuffle().isEmpty(),
            ).to.equal(true);
        });
    });
};
