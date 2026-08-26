/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Collection } from "Illuminate/Support/Collection";

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `take`, `skip`,
 * `slice`, `forPage`, `random`. See `Construction.spec.ts`'s class comment
 * for the adaptations shared across this directory.
 *
 * `slice()` here does not support a negative `length` (PHP's "take up to
 * n-from-the-end" reading) -- `Collection.sliceEntries()` treats `length`
 * as a plain count from `start`. The negative-length PHP sub-cases
 * (`testSliceOffsetAndNegativeLength`, `testSliceNegativeOffsetAndNegativeLength`)
 * are dropped.
 */
export = (): void => {
    describe("Collection slicing", () => {
        it("take() takes items from the front, or the back with a negative count", () => {
            // PHP: SupportCollectionTest::testTake, ::testTakeLast
            const data = new Collection([1, 2, 3, 4, 5]);

            expectDeepEqual(data.take(3).values().all(), [1, 2, 3]);
            expectDeepEqual(data.take(-2).values().all(), [4, 5]);
        });

        it("skip() drops items from the front", () => {
            // PHP: SupportCollectionTest::testSkipMethod
            const data = new Collection([1, 2, 3, 4, 5, 6]);

            expectDeepEqual(data.skip(4).values().all(), [5, 6]);
            expectDeepEqual(data.skip(10).values().all(), []);
        });

        it("slice() takes a sub-range by offset, and optionally by length", () => {
            // PHP: SupportCollectionTest::testSliceOffset,
            // ::testSliceNegativeOffset, ::testSliceOffsetAndLength,
            // ::testSliceNegativeOffsetAndLength
            const data = new Collection([1, 2, 3, 4, 5, 6, 7, 8]);

            expectDeepEqual(data.slice(3).values().toArray(), [4, 5, 6, 7, 8]);
            expectDeepEqual(data.slice(-3).values().toArray(), [6, 7, 8]);
            expectDeepEqual(data.slice(3, 3).values().toArray(), [4, 5, 6]);
            expectDeepEqual(data.slice(-5, 3).values().toArray(), [4, 5, 6]);
        });

        it("forPage() returns a fixed-size page of items", () => {
            // PHP: SupportCollectionTest::testPaginate
            const c = new Collection(["one", "two", "three", "four"]);

            expectDeepEqual(c.forPage(1, 2).all(), ["one", "two"]);
            expectDeepEqual(c.forPage(2, 2).all(), ["three", "four"]);
            expectDeepEqual(c.forPage(3, 2).all(), []);
        });

        // PHP: SupportCollectionTest::testRandom and friends have no
        // counterpart here -- `Collection.ts` does not port `random()` at
        // all (it lives on `Arr` instead, see `Arr/SequenceAccess.spec.ts`'s
        // "random() draws one or many random values" case).
    });
};
