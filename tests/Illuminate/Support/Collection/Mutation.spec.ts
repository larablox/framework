/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Collection } from 'Illuminate/Support/Collection';

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- the mutating and
 * combining methods: `push`, `put`, `prepend`, `pop`, `shift`, `forget`,
 * `merge`, `concat`, `unique`, `collapse`, `flatten`. See
 * `Construction.spec.ts`'s class comment for the adaptations shared across
 * this directory.
 *
 * `pop()`/`shift()` here take no "how many" argument -- only the
 * single-item PHP sub-cases of `testPopReturnsAndRemovesLastItemInCollection`
 * / `testShiftReturnsAndRemovesFirstItemInCollection` are ported;
 * `push()`/`unshift()`'s "spread a collection into it" sub-cases are
 * dropped along with `unshift()` itself (not ported).
 */
export = (): void => {
    describe('Collection mutation', () => {
        it('push() appends one or more items', () => {
            // PHP: SupportCollectionTest::testPushWithOneItem,
            // ::testPushWithMultipleItems
            const data = new Collection([
                4,
                5,
                6,
            ]);
            data.push(7);
            expectDeepEqual(data.all(), [
                4,
                5,
                6,
                7,
            ]);

            data.push(8, 9);
            expectDeepEqual(data.all(), [
                4,
                5,
                6,
                7,
                8,
                9,
            ]);
        });

        it('put() sets an item by key', () => {
            // PHP: SupportCollectionTest::testPutAddsItemToCollection
            const data = new Collection<string, string>();
            data.put('name', 'taylor');

            expect(data.get('name')).to.equal('taylor');
        });

        it('prepend() pushes an item onto the front, optionally under a key', () => {
            // PHP: SupportCollectionTest::testPrepend
            const c = new Collection([
                'one',
                'two',
                'three',
                'four',
            ]);
            expectDeepEqual(c.prepend('zero').all(), [
                'zero',
                'one',
                'two',
                'three',
                'four',
            ]);

            const keyed = new Collection<string, number>({
                one: 1,
                two: 2,
            });
            keyed.prepend(0, 'zero');
            expect(keyed.get('zero')).to.equal(0);
        });

        it('pop() / shift() remove and return the last / first item', () => {
            // PHP: SupportCollectionTest::testPopReturnsAndRemovesLastItemInCollection,
            // ::testShiftReturnsAndRemovesFirstItemInCollection,
            // ::testShiftReturnsNullOnEmptyCollection
            const c = new Collection([
                'foo',
                'bar',
            ]);
            expect(c.pop()).to.equal('bar');
            expect(c.first()).to.equal('foo');

            const data = new Collection([
                'Taylor',
                'Otwell',
            ]);
            expect(data.shift()).to.equal('Taylor');
            expect(data.first()).to.equal('Otwell');
            expect(data.shift()).to.equal('Otwell');
            expect(data.first()).to.equal(undefined);
            expect(data.shift()).to.equal(undefined);
        });

        it('forget() removes one key, or many', () => {
            // PHP: SupportCollectionTest::testForgetSingleKey,
            // ::testForgetArrayOfKeys
            const c = new Collection([
                'foo',
                'bar',
            ]);
            c.forget(0);
            expect(c.has(0)).to.equal(false);
            expect(c.has(1)).to.equal(true);

            const named = new Collection<string, string>({
                name: 'taylor',
                foo: 'bar',
                baz: 'qux',
            });
            named.forget([
                'foo',
                'baz',
            ]);
            expect(named.has('foo')).to.equal(false);
            expect(named.has('baz')).to.equal(false);
            expect(named.has('name')).to.equal(true);
        });

        it('merge() combines with another set of items, keyed items overwriting', () => {
            // PHP: SupportCollectionTest::testMergeArray, ::testMergeCollection
            const c = new Collection<string, string>({ name: 'Hello' });
            const merged = c.merge({ id: '1' });
            expect(merged.get('name')).to.equal('Hello');
            expect(merged.get('id')).to.equal('1');

            const other = new Collection<string, string>({ id: '1' });
            expect(c.merge(other).get('id')).to.equal('1');
        });

        it('concat() appends every item of another set, reindexing', () => {
            // PHP: SupportCollectionTest::testConcatWithArray,
            // ::testConcatWithCollection
            const data = new Collection<number, number | string>([
                4,
                5,
                6,
            ]).concat([
                'a',
                'b',
                'c',
            ] as Array<
                number | string
            >);
            expectDeepEqual(data.all(), [
                4,
                5,
                6,
                'a',
                'b',
                'c',
            ]);

            const combined = new Collection([
                1,
                2,
            ]).concat(
                new Collection([
                    3,
                    4,
                ]),
            );
            expectDeepEqual(combined.all(), [
                1,
                2,
                3,
                4,
            ]);
        });

        it('unique() drops duplicate items, by value or by a callback', () => {
            // PHP: SupportCollectionTest::testUnique, ::testUniqueWithCallback
            const c = new Collection([
                1,
                1,
                2,
                2,
                3,
                4,
                2,
            ]);
            expectDeepEqual(c.unique().values().all(), [
                1,
                2,
                3,
                4,
            ]);

            const byId = new Collection([
                { id: 1, name: 'first' },
                { id: 1, name: 'second' },
            ]);
            expect(byId.unique((item) => item.id).count()).to.equal(1);
        });

        it('collapse() flattens one level of nested arrays or collections', () => {
            // PHP: SupportCollectionTest::testCollapse,
            // ::testCollapseWithNestedCollections
            const data = new Collection([
                [1],
                [2],
                [3],
                [
                    'foo',
                    'bar',
                ],
            ]);
            expectDeepEqual(data.collapse().all(), [
                1,
                2,
                3,
                'foo',
                'bar',
            ]);

            const nested = new Collection([
                new Collection([
                    1,
                    2,
                    3,
                ]),
                new Collection([
                    4,
                    5,
                    6,
                ]),
            ]);
            expectDeepEqual(nested.collapse().all(), [
                1,
                2,
                3,
                4,
                5,
                6,
            ]);

            expectDeepEqual(
                new Collection([
                    [],
                    [],
                    [],
                ]).collapse().all(),
                [],
            );
        });

        it('flatten() flattens a multi-dimensional array, to a depth or fully', () => {
            // PHP: SupportCollectionTest::testFlatten, ::testFlattenWithDepth
            const data = new Collection([
                '#foo',
                '#bar',
                '#baz',
            ]);
            expectDeepEqual(data.flatten().all(), [
                '#foo',
                '#bar',
                '#baz',
            ]);

            const nested = new Collection([
                [
                    '#foo',
                    '#bar',
                ],
                '#baz',
            ]);
            expectDeepEqual(nested.flatten().all(), [
                '#foo',
                '#bar',
                '#baz',
            ]);

            const deep = new Collection([
                [
                    '#foo',
                    [
                        '#bar',
                        ['#baz'],
                    ],
                ],
                '#zap',
            ]);
            expectDeepEqual(deep.flatten().all(), [
                '#foo',
                '#bar',
                '#baz',
                '#zap',
            ]);
            expectDeepEqual(deep.flatten(1).all(), [
                '#foo',
                [
                    '#bar',
                    ['#baz'],
                ],
                '#zap',
            ]);
        });
    });
};
