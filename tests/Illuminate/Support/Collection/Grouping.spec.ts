/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Collection } from "Illuminate/Support/Collection";

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `groupBy`,
 * `countBy`, `partition`, `chunk`. See `Construction.spec.ts`'s class
 * comment for the adaptations shared across this directory.
 *
 * `groupBy()` here takes only a single string key or callback -- no
 * `preserveKeys` flag, and no array-of-keys "multi-level" form. The
 * `preserveKeys`/multi-level sub-cases of the PHP tests are dropped.
 */
export = (): void => {
    describe("Collection grouping", () => {
        it("groupBy() groups items by an attribute or a callback", () => {
            // PHP: SupportCollectionTest::testGroupByAttribute,
            // ::testGroupByClosureWhereItemsHaveSingleGroup
            const data = new Collection([
                { rating: 1, url: "1" },
                { rating: 1, url: "1" },
                { rating: 2, url: "2" },
            ]);

            const byRating = data.groupBy<number>("rating");
            expect(byRating.get(1)?.count()).to.equal(2);
            expect(byRating.get(2)?.count()).to.equal(1);

            const byCallback = data.groupBy((item) => item.rating);
            expect(byCallback.get(1)?.count()).to.equal(2);
            expect(byCallback.get(2)?.count()).to.equal(1);
        });

        it("countBy() counts items by their value, a key, or a callback", () => {
            // PHP: SupportCollectionTest::testCountByStandalone,
            // ::testCountByWithKey, ::testCountableByWithCallback
            const c = new Collection(["foo", "foo", "foo", "bar", "bar", "foobar"]);
            const counted = c.countBy();
            expect(counted.get("foo")).to.equal(3);
            expect(counted.get("bar")).to.equal(2);
            expect(counted.get("foobar")).to.equal(1);

            const keyed = new Collection([{ key: "a" }, { key: "a" }, { key: "b" }]);
            const byKey = keyed.countBy((item) => item.key);
            expect(byKey.get("a")).to.equal(2);
            expect(byKey.get("b")).to.equal(1);

            const names = new Collection(["alice", "aaron", "bob", "carla"]);
            const byFirstLetter = names.countBy((name) => name.sub(1, 1));
            expect(byFirstLetter.get("a")).to.equal(2);
            expect(byFirstLetter.get("b")).to.equal(1);
            expect(byFirstLetter.get("c")).to.equal(1);
        });

        it("partition() splits into two collections by a truth test", () => {
            // PHP: SupportCollectionTest::testPartition,
            // ::testPartitionByKey, ::testPartitionEmptyCollection
            const data = Collection.range(1, 10);

            const [firstHalf, secondHalf] = data.partition((item) => item <= 5);

            expectDeepEqual(firstHalf.values().toArray(), [1, 2, 3, 4, 5]);
            expectDeepEqual(secondHalf.values().toArray(), [6, 7, 8, 9, 10]);

            const courses = new Collection([
                { free: true, title: "Basic" },
                { free: false, title: "Premium" },
            ]);
            const [free, premium] = courses.partition((course) => course.free);
            expectDeepEqual(free.values().toArray(), [{ free: true, title: "Basic" }]);
            expectDeepEqual(premium.values().toArray(), [{ free: false, title: "Premium" }]);

            const [a, b] = new Collection<number, number>().partition(() => true);
            expect(a.isEmpty()).to.equal(true);
            expect(b.isEmpty()).to.equal(true);
        });

        it("chunk() splits into fixed-size chunks, including a trailing remainder", () => {
            // PHP: SupportCollectionTest::testChunk,
            // ::testChunkWhenGivenZeroAsSize, ::testChunkWhenGivenLessThanZero
            const data = Collection.range(1, 10).chunk(3);

            expect(data.count()).to.equal(4);
            expectDeepEqual(data.get(0)?.values().all(), [1, 2, 3]);
            expectDeepEqual(data.get(1)?.values().all(), [4, 5, 6]);
            expectDeepEqual(data.get(3)?.values().all(), [10]);

            expect(Collection.range(1, 10).chunk(0).isEmpty()).to.equal(true);
            expect(Collection.range(1, 10).chunk(-1).isEmpty()).to.equal(true);
        });
    });
};
