/// <reference types="@rbxts/testez/globals" />
import { Collection } from 'Illuminate/Support/Collection';

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `contains`,
 * `doesntContain`, `every`, `sum`, `avg`/`average`, `min`, `max`, `reduce`.
 * See `Construction.spec.ts`'s class comment for the adaptations shared
 * across this directory.
 *
 * `contains()` here takes only a value or a callback -- the `(key,
 * operator, value)` and `(key, value)` overloads it shares with `where()`
 * in PHP have no counterpart, so those sub-cases (and `containsStrict`,
 * `doesntContainStrict`, `some()`'s equivalent overloads) are dropped.
 */
export = (): void => {
    describe('Collection aggregation', () => {
        it('contains() / doesntContain() test for a value or a callback match', () => {
            // PHP: SupportCollectionTest::testContains, ::testDoesntContain
            const c = new Collection([1, 3, 5]);

            expect(c.contains(1)).to.equal(true);
            expect(c.contains(2)).to.equal(false);
            expect(c.doesntContain(1)).to.equal(false);
            expect(c.doesntContain(2)).to.equal(true);

            expect(c.contains((value) => value < 5)).to.equal(true);
            expect(c.contains((value) => value > 5)).to.equal(false);

            const sentinel = -1;
            const withSentinel = new Collection([sentinel, 1, 2]);
            expect(withSentinel.contains((value) => value === sentinel)).to.equal(true);
        });

        it('every() tests whether every item passes a truth test', () => {
            // PHP: SupportCollectionTest::testEvery (Collection-level analog;
            // the PHP method under this name lives on `Arr`/`Enumerable` for
            // the sequence case, ported here against `Collection` directly)
            const c = new Collection([1, 2, 3, 4]);

            expect(c.every((value) => value > 0)).to.equal(true);
            expect(c.every((value) => value > 2)).to.equal(false);
            expect(new Collection<number, number>().every(() => false)).to.equal(true);
        });

        it("sum() totals the collection, a key, or a callback's result", () => {
            // PHP: SupportCollectionTest::testGettingSumFromCollection,
            // ::testCanSumValuesWithoutACallback,
            // ::testGettingSumFromEmptyCollection
            const c = new Collection([{ foo: 50 }, { foo: 50 }]);
            expect(c.sum('foo')).to.equal(100);
            expect(c.sum((item) => item.foo)).to.equal(100);

            expect(new Collection([1, 2, 3, 4, 5]).sum()).to.equal(15);
            expect(new Collection<number, { foo: number }>().sum('foo')).to.equal(0);
        });

        it('avg() / average() compute the mean, of the whole collection or a key', () => {
            // PHP: SupportCollectionTest::testGettingAvgItemsFromCollection
            const c = new Collection([{ foo: 10 }, { foo: 20 }]);
            expect(c.avg('foo')).to.equal(15);
            expect(c.avg((item) => item.foo)).to.equal(15);
            expect(c.average('foo')).to.equal(15);

            expect(new Collection([1, 2, 3, 4, 5]).avg()).to.equal(3);
            expect(new Collection<number, number>().avg()).to.equal(undefined);
        });

        it('min() / max() find the extreme value, of the whole collection or a key', () => {
            // PHP: SupportCollectionTest::testGettingMaxItemsFromCollection,
            // ::testGettingMinItemsFromCollection
            const c = new Collection([{ foo: 10 }, { foo: 20 }]);
            expect(c.max('foo')).to.equal(20);
            expect(c.max((item) => item.foo)).to.equal(20);
            expect(c.min('foo')).to.equal(10);
            expect(c.min((item) => item.foo)).to.equal(10);

            expect(new Collection([1, 2, 3, 4, 5]).max()).to.equal(5);
            expect(new Collection([1, 2, 3, 4, 5]).min()).to.equal(1);

            expect(new Collection<number, number>().max()).to.equal(undefined);
            expect(new Collection<number, number>().min()).to.equal(undefined);
        });

        it('reduce() folds the collection down to a single value', () => {
            // PHP: SupportCollectionTest::testReduce
            const data = new Collection([1, 2, 3]);
            expect(data.reduce((carry, element) => carry + element, 0)).to.equal(6);

            // Built entry by entry rather than from an object literal: the
            // fold reads keys in iteration order, and `pairs()` does not
            // define the order of a literal's keys (laravel-parity.md,
            // "Collection: ключи и объём").
            const keyed = new Collection<string, string>().put('foo', 'bar').put('baz', 'qux');
            expect(keyed.reduce((carry, element, key) => carry + key + element, '')).to.equal('foobarbazqux');
        });
    });
};
