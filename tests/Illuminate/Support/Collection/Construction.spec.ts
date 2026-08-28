/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Collection } from 'Illuminate/Support/Collection';
import { OrderedMap } from 'Illuminate/Support/OrderedMap';

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- construction,
 * static factories, and the plain reading surface (`all`, `entries`,
 * `toArray`, `count`, `isEmpty`).
 *
 * This file's class comment (shared by every file under
 * `tests/Illuminate/Support/Collection/`) documents the systematic
 * adaptations used throughout this port of `SupportCollectionTest`:
 *
 * - **`LazyCollection` is not ported.** Every PHP test method here is
 *   `#[DataProvider('collectionClassProvider')]`, which runs the same
 *   scenario against both `Collection` and `LazyCollection`. Each such test
 *   is ported once, directly against `Collection`, with the `$collection`
 *   parameterization dropped.
 * - **`all()` returns values, not key => value pairs.** `Collection<TKey,
 *   TValue>` stores its items in an `OrderedMap`, not a PHP array, so
 *   `all()` (mirroring the TS source's own doc comment) yields the values in
 *   order; the key => value pairs a PHP assertion on `->all()` checks are
 *   read from `entries()` instead, and the intent of the original assertion
 *   is preserved by checking those pairs directly.
 * - **No `nil`-as-a-value.** A collection item can never be `undefined`, so
 *   PHP fixtures built around `null` items are adapted to use a sentinel
 *   value, or the sub-case is dropped where `null` itself was the point.
 * - **Not ported at all, and not tested here:** `toJson`/`jsonSerialize`/
 *   `dd`, `macro`/`Macroable`, `median`, `mode`, `duplicates`, `crossJoin`,
 *   `diff*`, `intersect*`, `union`, `combine`, `replace*`, `nth`, `sliding`,
 *   `split`, `splitIn`, `chunkWhile`, `splice`, `zip`, `pad`, `dot`/`undot`,
 *   `flip`, `getOrPut`, `multiply`, `select`, `mapToDictionary`/
 *   `mapToGroups`, `mapInto`, `mapSpread`, `eachSpread`, `reduceSpread`,
 *   `reduceInto`, `pipeThrough`/`pipeInto`, `ensure`, `percentage`,
 *   `whereBetween`/`whereNotBetween`, every `Strict` variant (`whereStrict`,
 *   `containsStrict`, `whereInStrict`, ...), `before`/`after`,
 *   `skipUntil`/`skipWhile`, `takeUntil`/`takeWhile`, `sortKeysUsing`,
 *   `unshift`, `add`, `lazy`, `ArrayAccess` (`$c[...]`), `getIterator`/
 *   `getCachingIterator`. Also not portable in principle: the higher-order
 *   proxy (`$c->map->name`), `Macroable`, `dd`/`dump`'s `VarDumper` hook,
 *   `LazyCollection`, `Enumerable`, PHP enum-keyed scenarios, and anything
 *   that inspects the class via reflection (`testGetArrayableItems`) or
 *   mocks (`m::mock`).
 */
export = (): void => {
    describe('Collection construction and reading', () => {
        it('is constructed from a scalar, empty, or nothing', () => {
            // PHP: SupportCollectionTest::testCollectionIsConstructed
            // (the `null` sub-case collapses into the "nothing" case, since
            // this port's constructor takes an optional argument rather
            // than a nullable one; the scalar sub-cases are adapted to pass
            // a single-element array -- this port's constructor takes
            // `ArrayableItems`, not a bare scalar, unlike PHP's `Arrayable`)
            expectDeepEqual(new Collection(['foo']).all(), ['foo']);
            expectDeepEqual(new Collection([2]).all(), [2]);
            expectDeepEqual(new Collection([false]).all(), [false]);
            expectDeepEqual(new Collection().all(), []);
        });

        it('isEmpty() / isNotEmpty() report on the item count', () => {
            // PHP: SupportCollectionTest::testEmptyCollectionIsEmpty,
            // ::testEmptyCollectionIsNotEmpty
            expect(new Collection().isEmpty()).to.equal(true);

            const c = new Collection([
                'foo',
                'bar',
            ]);
            expect(c.isEmpty()).to.equal(false);
            expect(c.isNotEmpty()).to.equal(true);
        });

        it('count() / containsOneItem() report on the item count', () => {
            // PHP: SupportCollectionTest::testCountable,
            // ::testContainsOneItem (the callback-argument overload of
            // containsOneItem() is not ported -- Collection.ts's method
            // takes no arguments)
            expect(new Collection([
                'foo',
                'bar',
            ]).count()).to.equal(2);

            expect(new Collection<number, number>([]).containsOneItem()).to.equal(false);
            expect(new Collection([1]).containsOneItem()).to.equal(true);
            expect(new Collection([
                1,
                2,
            ]).containsOneItem()).to.equal(false);
        });

        it('all() / entries() read the items back in order', () => {
            // PHP: SupportCollectionTest::testValuesResetKey (adapted: the
            // PHP assertion checks `values()->all()` reindexes a
            // string-keyed source; here it is `entries()` on the source
            // itself that carries the original keys, and `all()` that
            // always yields plain values in insertion order regardless)
            const items = new OrderedMap<number, string>();
            items.set(1, 'a');
            items.set(2, 'b');
            items.set(3, 'c');
            const data = new Collection(items);

            expectDeepEqual(data.all(), [
                'a',
                'b',
                'c',
            ]);
            expectDeepEqual(data.values().all(), [
                'a',
                'b',
                'c',
            ]);
        });

        it('toArray() reads the items back, resolving nested collections', () => {
            // PHP: SupportCollectionTest::testToArrayCallsToArrayOnEachItemInCollection
            // (adapted: the port has no `Arrayable` interface to call
            // `toArray()` through, so a nested `Collection` is used as the
            // item that needs resolving instead of a mocked `Arrayable`)
            const c = new Collection([
                new Collection([
                    'foo',
                    'array',
                ]),
                new Collection([
                    'bar',
                    'array',
                ]),
            ]);

            expectDeepEqual(c.toArray(), [
                [
                    'foo',
                    'array',
                ],
                [
                    'bar',
                    'array',
                ],
            ]);
        });

        it('make() creates a new collection instance', () => {
            // PHP: SupportCollectionTest::testMakeMethod,
            // ::testMakeMethodFromNull, ::testMakeMethodFromCollection,
            // ::testMakeMethodFromArray
            expectDeepEqual(Collection.make().all(), []);
            expectDeepEqual(Collection.make(['foo']).all(), ['foo']);

            const collection = Collection.make([
                'foo',
                'bar',
            ]);
            expectDeepEqual(Collection.make(collection).all(), [
                'foo',
                'bar',
            ]);
        });

        it('wrap() / unwrap() normalize a value to and from a collection', () => {
            // PHP: SupportCollectionTest::testWrapWithScalar,
            // ::testWrapWithArray, ::testWrapWithCollectionClass,
            // ::testUnwrapCollection, ::testUnwrapCollectionWithArray
            expectDeepEqual(Collection.wrap('foo').all(), ['foo']);
            expectDeepEqual(Collection.wrap(['foo']).all(), ['foo']);

            const collection = Collection.wrap(new Collection(['foo']));
            expectDeepEqual(collection.all(), ['foo']);

            expectDeepEqual(Collection.unwrap(new Collection(['foo'])), ['foo']);
            expectDeepEqual(Collection.unwrap(['foo']), ['foo']);
        });

        it('empty() creates an instance with no items', () => {
            // PHP: SupportCollectionTest::testEmptyMethod
            expectDeepEqual(Collection.empty().all(), []);
            expect(Collection.empty().isEmpty()).to.equal(true);
        });

        it('times() invokes a callback a given number of times', () => {
            // PHP: SupportCollectionTest::testTimesMethod
            const two = Collection.times(2, (index) => `slug-${index}`);
            expectDeepEqual(two.all(), [
                'slug-1',
                'slug-2',
            ]);

            expect(Collection.times(0, (index) => index).isEmpty()).to.equal(true);
        });

        it('range() builds a collection of a numeric range', () => {
            // PHP: SupportCollectionTest::testRangeMethod
            expectDeepEqual(Collection.range(1, 5).all(), [
                1,
                2,
                3,
                4,
                5,
            ]);
            expectDeepEqual(Collection.range(1, 1).all(), [1]);
            expectDeepEqual(Collection.range(5, 1).all(), []);
        });

        it('collect() re-wraps the items in a new base Collection', () => {
            // PHP: SupportCollectionTest::testCollect
            const data = Collection.make([
                'a',
                'b',
                'c',
            ]).collect();

            expect(data instanceof Collection).to.equal(true);
            expectDeepEqual(data.all(), [
                'a',
                'b',
                'c',
            ]);
        });
    });
};
