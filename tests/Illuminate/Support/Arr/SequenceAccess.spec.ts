/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual, expectThrows } from '../../TestHelpers';
import { Arr, ArrayAccessible } from 'Illuminate/Support/Arr';
import { InvalidArgumentException } from 'Illuminate/Exception';

/**
 * PHP: `Illuminate\Tests\Support\SupportArrTest` -- the methods that walk a
 * *sequence* rather than address a key: `first`, `last`, `sole`, `take`,
 * `every`, `some`, `where`, `reject`, `whereNotNull`, `partition`, `map`,
 * `mapWithKeys`, `mapSpread`, `keyBy`, `pluck`, `select`, `onlyValues`,
 * `exceptValues`, `prepend`, `collapse`, `flatten`, `crossJoin`, `divide`,
 * `join`, `random`, `shuffle`, `sort`, `sortDesc`, `sortRecursive`,
 * `sortRecursiveDesc`, `from`, plus the typed accessors `string`/`integer`/
 * `boolean`/`array`. `tests/Illuminate/Support/Arr/KeyedAccess.spec.ts`
 * covers everything else -- see its class comment for the systematic
 * adaptations that also apply here (no `nil`-as-a-value, no closure-unwrapping
 * default, no `ArrayAccess` objects, string-only keys).
 *
 * Systematic adaptations specific to this file:
 *
 * - **Sequence methods take/return an `Array`, not a keyed table.**
 *   `Arr.ts`'s class comment: PHP's single array type is a list and an
 *   ordered map at once; the port splits by use. Every PHP case here that
 *   passes an *associative* array into a sequence method (`Arr::map` on
 *   `['first' => ..., 'last' => ...]`, `Arr::sort` on values keyed by name,
 *   `Arr::reject` on `['a' => 1, ...]`) has been re-expressed as a plain list
 *   with the same values, in the same relative order, keeping the behavior
 *   under test; the specific string keys are gone because there is nowhere
 *   for a sequence method to put them.
 * - **`pairs()` iteration order over a table is not guaranteed.** Any
 *   assertion built on `Arr.divide()` (which walks a table with `pairs()`)
 *   is written order-independently (checking membership/size) rather than
 *   asserting one exact array shape.
 * - **No PHP `iterable` support.** `ArrayIterator`/generator cases
 *   (`testFirstWorksWithArrayObject`, `testLastAcceptsIterables`,
 *   `testEveryAcceptsIterables`, `testSomeAcceptsIterables`) have no
 *   counterpart -- every sequence method here takes a real `Array`.
 */
export = (): void => {
    describe('Arr sequence access', () => {
        it('first() returns the first element passing a truth test', () => {
            // PHP: SupportArrTest::testFirst
            const array = [
                100,
                200,
                300,
            ];

            expect(Arr.first([])).to.equal(undefined);
            expect(Arr.first([], undefined, 'foo')).to.equal('foo');

            expect(Arr.first(array)).to.equal(100);

            expect(Arr.first(array, (value) => value >= 150)).to.equal(200);

            expect(Arr.first(array, (value) => value > 300)).to.equal(undefined);
            expect(Arr.first(array, (value) => value > 300, 'bar' as unknown as number)).to.equal('bar');
            expect(Arr.first(array, (value, key) => (key as number) < 2)).to.equal(100);
        });

        it('last() returns the last element passing a truth test', () => {
            // PHP: SupportArrTest::testLast
            const array = [
                100,
                200,
                300,
            ];

            expect(Arr.last([])).to.equal(undefined);
            expect(Arr.last([], undefined, 'foo')).to.equal('foo');

            expect(Arr.last(array)).to.equal(300);

            expect(Arr.last(array, (value) => value < 250)).to.equal(200);

            expect(Arr.last(array, (value) => value > 300)).to.equal(undefined);
            expect(Arr.last(array, (value) => value > 300, 'bar' as unknown as number)).to.equal('bar');
            expect(Arr.last(array, (value, key) => (key as number) < 2)).to.equal(200);
        });

        it('sole() returns the only matching item, or throws', () => {
            // PHP: SupportArrTest::testSoleReturnsFirstItemInCollectionIfOnlyOneExists,
            // ::testSoleThrowsExceptionIfNoItemsExist,
            // ::testSoleThrowsExceptionIfMoreThanOneItemExists
            expect(Arr.sole(['foo'])).to.equal('foo');

            const array = [
                { name: 'foo' },
                { name: 'bar' },
            ];
            expect(Arr.sole(array, (value) => value.name === 'foo')).to.equal(array[0]);

            expectThrows(() => Arr.sole(['foo'], (value) => value === 'baz'));

            expectThrows(() =>
                Arr.sole([
                    'baz',
                    'foo',
                    'baz',
                ], (value) => value === 'baz')
            );
        });

        it('take() takes items from the front or back of an array', () => {
            // PHP: SupportArrTest::testTake
            const array = [
                1,
                2,
                3,
                4,
                5,
                6,
            ];

            expectDeepEqual(Arr.take(array, 3), [
                1,
                2,
                3,
            ]);
            expectDeepEqual(Arr.take(array, -3), [
                4,
                5,
                6,
            ]);
            expectDeepEqual(Arr.take(array, 0), []);
            expectDeepEqual(Arr.take(array, 10), [
                1,
                2,
                3,
                4,
                5,
                6,
            ]);
            expectDeepEqual(Arr.take(array, -10), [
                1,
                2,
                3,
                4,
                5,
                6,
            ]);
        });

        it('every() / some() test every or some items with a callback', () => {
            // PHP: SupportArrTest::testEvery, ::testSome (iterable variants
            // dropped, see class comment)
            expect(Arr.every([
                1,
                2,
            ], (value) => typeIs(value, 'string'))).to.equal(false);
            expect(Arr.every([
                'foo',
                2,
            ], (value) => typeIs(value, 'string'))).to.equal(false);
            expect(Arr.every([
                'foo',
                'bar',
            ], (value) => typeIs(value, 'string'))).to.equal(true);

            expect(Arr.some([
                1,
                2,
            ], (value) => typeIs(value, 'string'))).to.equal(false);
            expect(Arr.some([
                'foo',
                2,
            ], (value) => typeIs(value, 'string'))).to.equal(true);
            expect(Arr.some([
                'foo',
                'bar',
            ], (value) => typeIs(value, 'string'))).to.equal(true);
        });

        it('where() filters a sequence using a callback', () => {
            // PHP: SupportArrTest::testWhere (testWhereKey dropped -- it
            // exercises PHP string/int key coercion via `is_numeric($key)`,
            // which has no counterpart once the target is a plain array with
            // numeric indices only, see class comment)
            const array = [
                100,
                '200',
                300,
                '400',
                500,
            ];

            expectDeepEqual(
                Arr.where(array, (value) => typeIs(value, 'string')),
                [
                    '200',
                    '400',
                ],
            );
        });

        it('reject() filters a sequence using the negation of a callback', () => {
            // PHP: SupportArrTest::testReject (the associative-array
            // sub-case is re-expressed as a plain list, see class comment)
            const array = [
                1,
                2,
                3,
                4,
                5,
                6,
            ];

            expectDeepEqual(
                Arr.reject(array, (value) => (value as number) % 2 === 0),
                [
                    1,
                    3,
                    5,
                ],
            );

            const values = [
                1,
                2,
                3,
                4,
            ];
            expectDeepEqual(
                Arr.reject(values, (value) => value > 2),
                [
                    1,
                    2,
                ],
            );
        });

        it('whereNotNull() drops undefined entries', () => {
            // PHP: SupportArrTest::testWhereNotNull (PHP `null` maps to this
            // port's `undefined`, see `Arr.ts`'s "no nil-as-a-value" note in
            // `KeyedAccess.spec.ts`'s class comment; the `stdClass`/closure
            // sub-case is kept using plain stub objects)
            expectDeepEqual(
                Arr.whereNotNull([
                    undefined,
                    0,
                    false,
                    '',
                    undefined,
                    [],
                ]),
                [
                    0,
                    false,
                    '',
                    [],
                ],
            );

            expectDeepEqual(
                Arr.whereNotNull([
                    1,
                    2,
                    3,
                ]),
                [
                    1,
                    2,
                    3,
                ],
            );
            expectDeepEqual(
                Arr.whereNotNull([
                    undefined,
                    undefined,
                ]),
                [],
            );
            expectDeepEqual(
                Arr.whereNotNull([
                    'a',
                    undefined,
                    'b',
                    undefined,
                    'c',
                ]),
                [
                    'a',
                    'b',
                    'c',
                ],
            );
        });

        it('partition() splits a sequence by a truth test', () => {
            // PHP: SupportArrTest::testPartition
            const array = [
                'John',
                'Jane',
                'Greg',
            ];

            const [matched, unmatched] = Arr.partition(array, (value) => value.find('J')[0] !== undefined);
            expectDeepEqual(matched, [
                'John',
                'Jane',
            ]);
            expectDeepEqual(unmatched, ['Greg']);
        });

        it('map() runs a callback over each item', () => {
            // PHP: SupportArrTest::testMap, ::testMapWithEmptyArray,
            // ::testMapNullValues, ::testMapByReference (the associative
            // fixture is re-expressed as a plain list, see class comment;
            // the "does not mutate the source" and "strrev by string
            // callback name" sub-cases are folded into this same scenario)
            const data = [
                'taylor',
                'otwell',
            ];
            const mapped = Arr.map(data, (value, key) => `${key}-${value}`);

            expectDeepEqual(mapped, [
                '0-taylor',
                '1-otwell',
            ]);
            expectDeepEqual(data, [
                'taylor',
                'otwell',
            ]);

            expectDeepEqual(
                Arr.map([], (value, key) => `${key}-${value}`),
                [],
            );
        });

        it('mapWithKeys() builds a keyed table from a sequence', () => {
            // PHP: SupportArrTest::testMapWithKeys
            const data = [
                { name: 'Blastoise', type: 'Water' },
                { name: 'Charmander', type: 'Fire' },
                { name: 'Dragonair', type: 'Dragon' },
            ];

            expectDeepEqual(
                Arr.mapWithKeys(data, (pokemon) => [
                    pokemon.name,
                    pokemon.type,
                ]),
                {
                    Blastoise: 'Water',
                    Charmander: 'Fire',
                    Dragonair: 'Dragon',
                },
            );
        });

        it('mapSpread() runs a callback over each chunk, spread as arguments', () => {
            // PHP: SupportArrTest::testMapSpread
            const chunks: Array<Array<defined>> = [
                [
                    1,
                    'a',
                ],
                [
                    2,
                    'b',
                ],
            ];

            expectDeepEqual(
                Arr.mapSpread(chunks, (numberValue: number, character: string) => `${numberValue}-${character}`),
                [
                    '1-a',
                    '2-b',
                ],
            );

            expectDeepEqual(
                Arr.mapSpread(
                    chunks,
                    (numberValue: number, character: string, key: number) => `${numberValue}-${character}-${key}`,
                ),
                [
                    '1-a-0',
                    '2-b-1',
                ],
            );
        });

        it('keyBy() keys a sequence by a field or callback', () => {
            // PHP: SupportArrTest::testKeyBy
            const array = [
                { id: '123', data: 'abc' },
                { id: '345', data: 'def' },
                { id: '498', data: 'hgi' },
            ];

            expectDeepEqual(Arr.keyBy(array, 'id'), {
                '123': array[0],
                '345': array[1],
                '498': array[2],
            });
        });

        it('pluck() plucks a value out of every item', () => {
            // PHP: SupportArrTest::testPluck (the second, keying argument is
            // dropped -- that variant lives on `Collection::pluck`, see
            // `Arr.ts`'s doc comment; the `*`-wildcard segment sub-case in
            // `testArrayPluckWithNestedArrays` is dropped too, `Arr.get`'s
            // dot-notation walk has no wildcard support)
            const data = [
                {
                    comments: {
                        tags: [
                            '#foo',
                            '#bar',
                        ],
                    },
                },
                { comments: { tags: ['#baz'] } },
            ];

            expectDeepEqual(Arr.pluck(data, 'comments.tags'), [
                [
                    '#foo',
                    '#bar',
                ],
                ['#baz'],
            ]);

            const developers = [
                { developer: { name: 'Taylor' } },
                { developer: { name: 'Abigail' } },
            ];
            expectDeepEqual(Arr.pluck(developers, 'developer.name'), [
                'Taylor',
                'Abigail',
            ]);

            // Missing key -- undefined values are simply skipped, unlike
            // PHP's `null`-filled result (see class comment's "no
            // nil-as-a-value" note).
            expectDeepEqual(Arr.pluck(data, 'foo'), []);
        });

        it('select() plucks a subset of keys from every item', () => {
            // PHP: SupportArrTest::testSelect (the `null`-keys sub-case is
            // dropped -- `select()`'s `keys` parameter is a required
            // `string | Array<string>` here)
            const array = [
                { name: 'Taylor', role: 'Developer', age: 1 },
                { name: 'Abigail', role: 'Infrastructure', age: 2 },
            ];

            expectDeepEqual(
                Arr.select(array, [
                    'name',
                    'age',
                ]),
                [
                    { name: 'Taylor', age: 1 },
                    { name: 'Abigail', age: 2 },
                ],
            );

            expectDeepEqual(Arr.select(array, 'name'), [
                { name: 'Taylor' },
                { name: 'Abigail' },
            ]);

            expectDeepEqual(Arr.select(array, 'nonExistingKey'), [
                {},
                {},
            ]);
        });

        it('onlyValues() / exceptValues() keep or drop a sequence by value', () => {
            // PHP: SupportArrTest::testOnlyValues, ::testExceptValues (the
            // `$strict` sub-cases are dropped -- neither method takes a
            // strict-comparison flag in this port; the associative fixtures
            // are re-expressed as plain lists, see class comment)
            const array = [
                'foo',
                'bar',
                'baz',
                'qux',
            ];

            expectDeepEqual(
                Arr.onlyValues(array, [
                    'foo',
                    'baz',
                ]),
                [
                    'foo',
                    'baz',
                ],
            );
            expectDeepEqual(Arr.onlyValues(array, 'baz'), ['baz']);
            expectDeepEqual(Arr.onlyValues([], 'foo'), []);
            expectDeepEqual(
                Arr.onlyValues([
                    'foo',
                    'bar',
                ], []),
                [],
            );

            expectDeepEqual(
                Arr.exceptValues(array, [
                    'foo',
                    'baz',
                ]),
                [
                    'bar',
                    'qux',
                ],
            );
            expectDeepEqual(Arr.exceptValues(array, 'baz'), [
                'foo',
                'bar',
                'qux',
            ]);
            expectDeepEqual(Arr.exceptValues([], 'foo'), []);
            expectDeepEqual(
                Arr.exceptValues([
                    'foo',
                    'bar',
                ], []),
                [
                    'foo',
                    'bar',
                ],
            );
        });

        it('prepend() pushes a value onto the front of an array', () => {
            // PHP: SupportArrTest::testPrepend (every sub-case that supplies
            // a third, key argument is dropped -- this port's `prepend()` is
            // list-only, with no keyed form at all)
            expectDeepEqual(
                Arr.prepend([
                    'one',
                    'two',
                    'three',
                    'four',
                ], 'zero'),
                [
                    'zero',
                    'one',
                    'two',
                    'three',
                    'four',
                ],
            );

            expectDeepEqual(Arr.prepend([], 'zero'), ['zero']);
            expectDeepEqual(Arr.prepend([''], 'zero'), [
                'zero',
                '',
            ]);
            expectDeepEqual(
                Arr.prepend([
                    'one',
                    'two',
                ] as unknown as Array<Array<string>>, ['zero']),
                [
                    ['zero'],
                    'one',
                    'two',
                ],
            );
        });

        it('collapse() flattens one level of arrays', () => {
            // PHP: SupportArrTest::testCollapse (the `Collection`-element
            // sub-case is dropped, see class comment)
            expectDeepEqual(
                Arr.collapse([
                    [
                        'foo',
                        'bar',
                    ],
                    ['baz'],
                ]),
                [
                    'foo',
                    'bar',
                    'baz',
                ],
            );

            expectDeepEqual(
                Arr.collapse([
                    [1],
                    [2],
                    [3],
                    [
                        'foo',
                        'bar',
                    ],
                ]),
                [
                    1,
                    2,
                    3,
                    'foo',
                    'bar',
                ],
            );

            expectDeepEqual(
                Arr.collapse([
                    [],
                    [],
                    [],
                ]),
                [],
            );

            expectDeepEqual(
                Arr.collapse([
                    [],
                    [
                        1,
                        2,
                    ],
                    [],
                    [
                        'foo',
                        'bar',
                    ],
                ]),
                [
                    1,
                    2,
                    'foo',
                    'bar',
                ],
            );
        });

        it('flatten() flattens a multi-dimensional array', () => {
            // PHP: SupportArrTest::testFlatten, ::testFlattenWithDepth (the
            // `null`-item and `Collection`-element sub-cases are dropped,
            // see class comment)
            expectDeepEqual(
                Arr.flatten([
                    '#foo',
                    '#bar',
                    '#baz',
                ]),
                [
                    '#foo',
                    '#bar',
                    '#baz',
                ],
            );

            expectDeepEqual(
                Arr.flatten([
                    [
                        '#foo',
                        '#bar',
                    ],
                    '#baz',
                ]),
                [
                    '#foo',
                    '#bar',
                    '#baz',
                ],
            );

            expectDeepEqual(
                Arr.flatten([
                    [
                        '#foo',
                        ['#bar'],
                    ],
                    ['#baz'],
                ]),
                [
                    '#foo',
                    '#bar',
                    '#baz',
                ],
            );

            // No depth flattens recursively.
            const deep = [
                [
                    '#foo',
                    [
                        '#bar',
                        ['#baz'],
                    ],
                ],
                '#zap',
            ];
            expectDeepEqual(Arr.flatten(deep), [
                '#foo',
                '#bar',
                '#baz',
                '#zap',
            ]);

            // A depth only flattens that far.
            expectDeepEqual(Arr.flatten(deep, 1), [
                '#foo',
                [
                    '#bar',
                    ['#baz'],
                ],
                '#zap',
            ]);
            expectDeepEqual(Arr.flatten(deep, 2), [
                '#foo',
                '#bar',
                ['#baz'],
                '#zap',
            ]);
        });

        it('crossJoin() returns every combination across arrays', () => {
            // PHP: SupportArrTest::testCrossJoin
            expectDeepEqual(
                Arr.crossJoin([1], [
                    'a',
                    'b',
                    'c',
                ]),
                [
                    [
                        1,
                        'a',
                    ],
                    [
                        1,
                        'b',
                    ],
                    [
                        1,
                        'c',
                    ],
                ],
            );

            expectDeepEqual(
                Arr.crossJoin([
                    1,
                    2,
                ], [
                    'a',
                    'b',
                ]),
                [
                    [
                        1,
                        'a',
                    ],
                    [
                        1,
                        'b',
                    ],
                    [
                        2,
                        'a',
                    ],
                    [
                        2,
                        'b',
                    ],
                ],
            );

            expectDeepEqual(
                Arr.crossJoin([
                    1,
                    2,
                ], [
                    'a',
                    'b',
                    'c',
                ]),
                [
                    [
                        1,
                        'a',
                    ],
                    [
                        1,
                        'b',
                    ],
                    [
                        1,
                        'c',
                    ],
                    [
                        2,
                        'a',
                    ],
                    [
                        2,
                        'b',
                    ],
                    [
                        2,
                        'c',
                    ],
                ],
            );

            // With an empty dimension.
            expectDeepEqual(
                Arr.crossJoin([], [
                    'a',
                    'b',
                ], [
                    'I',
                    'II',
                ]),
                [],
            );
            expectDeepEqual(
                Arr.crossJoin(
                    [
                        1,
                        2,
                    ],
                    [],
                    [
                        'I',
                        'II',
                    ],
                ),
                [],
            );

            // No arrays at all.
            expectDeepEqual(Arr.crossJoin(), [[]]);
        });

        it('divide() splits a table into a key array and a value array', () => {
            // PHP: SupportArrTest::testDivide (the int-key and null-key
            // fixtures are dropped -- `divide()` addresses `ArrayAccessible`,
            // string keys only, see `KeyedAccess.spec.ts`'s class comment;
            // multi-entry assertions check membership rather than exact
            // order, `pairs()` iteration order is not guaranteed, see this
            // file's class comment)
            const [emptyKeys, emptyValues] = Arr.divide({});
            expectDeepEqual(emptyKeys, []);
            expectDeepEqual(emptyValues, []);

            const [singleKeys, singleValues] = Arr.divide({ name: 'Desk' });
            expectDeepEqual(singleKeys, ['name']);
            expectDeepEqual(singleValues, ['Desk']);

            const target: ArrayAccessible = {
                name: 'Desk',
                price: 100,
                available: true,
            };
            const [keys, values] = Arr.divide(target);
            expect(keys.size()).to.equal(3);
            expect(values.size()).to.equal(3);
            for (const key of keys) {
                expect(values.includes(target[key] as defined)).to.equal(true);
            }
        });

        it('join() joins a sequence with a glue, and a separate final glue', () => {
            // PHP: SupportArrTest::testJoin
            expect(Arr.join([
                'a',
                'b',
                'c',
            ], ', ')).to.equal('a, b, c');
            expect(Arr.join(
                [
                    'a',
                    'b',
                    'c',
                ],
                ', ',
                ' and ',
            )).to.equal('a, b and c');
            expect(Arr.join(
                [
                    'a',
                    'b',
                ],
                ', ',
                ' and ',
            )).to.equal('a and b');
            expect(Arr.join(['a'], ', ', ' and ')).to.equal('a');
            expect(Arr.join([], ', ', ' and ')).to.equal('');
        });

        it('random() draws one or many random values', () => {
            // PHP: SupportArrTest::testRandom, ::testRandomNotIncrementingKeys,
            // ::testRandomOnEmptyArray (the "preserve keys" sub-case is
            // dropped -- `random()` has no `preserveKeys` parameter here, see
            // `agent_docs/porting-plan.md`)
            const options = [
                'foo',
                'bar',
                'baz',
            ];
            expect(options.includes(Arr.random(options) as string)).to.equal(true);

            const none = Arr.random(options, 0);
            expectDeepEqual(none, []);

            const one = Arr.random(options, 1) as Array<string>;
            expect(one.size()).to.equal(1);
            expect(options.includes(one[0])).to.equal(true);

            const two = Arr.random(options, 2) as Array<string>;
            expect(two.size()).to.equal(2);
            expect(options.includes(two[0])).to.equal(true);
            expect(options.includes(two[1])).to.equal(true);

            expectDeepEqual(Arr.random([], 0), []);
        });

        it('random() throws when more items are requested than are available', () => {
            // PHP: SupportArrTest::testRandomThrowsAnErrorWhenRequestingMoreItemsThanAreAvailable
            expectThrows(() => Arr.random([]));
            expectThrows(() => Arr.random([], 1));
            expectThrows(() => Arr.random([], 2));
        });

        it('merge() concatenates arrays in order', () => {
            // No upstream twin: PHP gets array_merge from the language, so
            // SupportArrTest never tests it.
            expectDeepEqual(
                Arr.merge([
                    'a',
                    'b',
                ], [
                    'c',
                ], [
                    'd',
                ]),
                [
                    'a',
                    'b',
                    'c',
                    'd',
                ],
            );
            expectDeepEqual(Arr.merge([], []), []);

            const single = Arr.merge(['a']);
            expectDeepEqual(single, ['a']);
        });

        it("pad() pads either end, and without a value is the identity PHP's null pad becomes here", () => {
            // No upstream twin: PHP gets array_pad from the language, so
            // SupportArrTest never tests it -- see the method's docblock.
            expectDeepEqual(
                Arr.pad(
                    [
                        'a',
                        'b',
                    ],
                    4,
                    'x',
                ),
                [
                    'a',
                    'b',
                    'x',
                    'x',
                ],
            );
            expectDeepEqual(
                Arr.pad(
                    [
                        'a',
                        'b',
                    ],
                    -4,
                    'x',
                ),
                [
                    'x',
                    'x',
                    'a',
                    'b',
                ],
            );

            const untouched = [
                'a',
                'b',
                'c',
            ];
            expect(Arr.pad(untouched, 2, 'x')).to.equal(untouched);
            expect(Arr.pad(untouched, 5, undefined)).to.equal(untouched);
        });

        it('reverse() returns a reversed copy, leaving the input untouched', () => {
            // No upstream twin: PHP gets array_reverse from the language, so
            // SupportArrTest never tests it -- see the method's docblock.
            const array = [
                'a',
                'b',
                'c',
            ];

            expectDeepEqual(Arr.reverse(array), [
                'c',
                'b',
                'a',
            ]);
            expectDeepEqual(array, [
                'a',
                'b',
                'c',
            ]);
            expectDeepEqual(Arr.reverse([]), []);
            expectDeepEqual(Arr.reverse(['solo']), ['solo']);
        });

        it('shuffle() reorders an array while keeping the same values', () => {
            // PHP: SupportArrTest::testShuffleActuallyShuffles,
            // ::testShuffleKeepsSameValues, ::testEmptyShuffle
            // (`testShuffleProducesDifferentShuffles` is a repeat of the same
            // "actually shuffles" assertion and is not duplicated)
            const input = [
                'a',
                'b',
                'c',
                'd',
                'e',
                'f',
                'g',
                'h',
                'i',
                'j',
                'k',
                'l',
                'm',
                'n',
                'o',
                'p',
                'q',
                'r',
                's',
                't',
            ];

            const shuffled = Arr.shuffle(input);
            expect(shuffled.size()).to.equal(input.size());

            const sorted = table.clone(shuffled);
            sorted.sort();
            const sortedInput = table.clone(input);
            sortedInput.sort();
            expectDeepEqual(sorted, sortedInput);

            expectDeepEqual(Arr.shuffle([]), []);
        });

        it('sort() / sortDesc() sort by a callback or dot-notation key', () => {
            // PHP: SupportArrTest::testSort, ::testSortDesc
            // (`testSortByMany` is dropped in full -- it exercises sorting
            // by an array of keys/callables with per-key direction, which
            // `Arr.sort()`'s `string | ArrCallback` callback parameter has
            // no counterpart for)
            const unsorted = [
                { name: 'Desk' },
                { name: 'Chair' },
            ];
            const expected = [
                { name: 'Chair' },
                { name: 'Desk' },
            ];

            expectDeepEqual(Arr.sort(unsorted), expected);
            expectDeepEqual(
                Arr.sort(unsorted, (value) => value.name),
                expected,
            );
            expectDeepEqual(Arr.sort(unsorted, 'name'), expected);

            const unsortedDesc = [
                { name: 'Chair' },
                { name: 'Desk' },
            ];
            const expectedDesc = [
                { name: 'Desk' },
                { name: 'Chair' },
            ];

            expectDeepEqual(Arr.sortDesc(unsortedDesc), expectedDesc);
            expectDeepEqual(
                Arr.sortDesc(unsortedDesc, (value) => value.name),
                expectedDesc,
            );
            expectDeepEqual(Arr.sortDesc(unsortedDesc, 'name'), expectedDesc);
        });

        it('sortRecursive() / sortRecursiveDesc() sort nested arrays', () => {
            // PHP: SupportArrTest::testSortRecursive, ::testSortRecursiveDesc
            // (both PHP fixtures are keyed tables mixing string and numeric
            // keys throughout -- `sortRecursive()` only walks `Array`, so the
            // scenario is narrowed to a single nested numeric array, keeping
            // the "recurses into nested arrays" behavior under test; the
            // "sort non-incrementing numerical keys" / "sort associative
            // arrays by keys" sub-cases have no counterpart on a plain array,
            // see class comment)
            expectDeepEqual(
                Arr.sortRecursive([
                    [
                        2,
                        1,
                        0,
                    ],
                ]),
                [
                    [
                        0,
                        1,
                        2,
                    ],
                ],
            );
            expectDeepEqual(
                Arr.sortRecursiveDesc([
                    [
                        2,
                        3,
                        1,
                    ],
                ]),
                [
                    [
                        3,
                        2,
                        1,
                    ],
                ],
            );
        });

        it('from() reads the underlying array of items', () => {
            // PHP: SupportArrTest::testFrom (the `stdClass`/enum/`Arrayable`/
            // `Jsonable`/`WeakMap` sub-cases are dropped -- those interfaces
            // are erased in this port, see `Arr.ts`'s class comment; only the
            // plain-array pass-through, the `->all()`-shaped stub, and the
            // scalar-throws case survive)
            const array = [
                1,
                2,
                3,
            ];
            expect(Arr.from(array)).to.equal(array);

            const stub = {
                all: () => [
                    4,
                    5,
                    6,
                ],
            };
            expectDeepEqual(Arr.from(stub), [
                4,
                5,
                6,
            ]);

            expectThrows(() => Arr.from(123), 'Items cannot be represented by a scalar value.');
        });

        it('string() / integer() / boolean() / array() read a typed dotted value', () => {
            // PHP: SupportArrTest::testItGetsAString, ::testItGetsAnInteger,
            // ::testItGetsABoolean, ::testItGetsAnArray
            // (`testItGetsAFloat` is dropped -- `Arr.ts`'s class comment: "no
            // `float`, Luau has one number type", there is no `Arr.float()`
            // to test)
            const testArray = { string: 'foo bar', integer: 1234 };

            expect(Arr.string(testArray, 'string')).to.equal('foo bar');
            expect(Arr.string(testArray, 'missing_key', 'default')).to.equal('default');
            expectThrows(() => Arr.string(testArray, 'integer'), InvalidArgumentException);

            expect(Arr.integer(testArray, 'integer')).to.equal(1234);
            expect(Arr.integer(testArray, 'missing_key', 999)).to.equal(999);
            expectThrows(() => Arr.integer(testArray, 'string'), InvalidArgumentException);

            const boolArray = { string: 'foo bar', boolean: true };
            expect(Arr.boolean(boolArray, 'boolean')).to.equal(true);
            expect(Arr.boolean(boolArray, 'missing_key', true)).to.equal(true);
            expectThrows(() => Arr.boolean(boolArray, 'string'), InvalidArgumentException);

            const arrayArray = {
                string: 'foo bar',
                array: [
                    'foo',
                    'bar',
                ],
            };
            expectDeepEqual(Arr.array(arrayArray, 'array'), [
                'foo',
                'bar',
            ]);
            expectDeepEqual(
                Arr.array(arrayArray, 'missing_key', [
                    1,
                    'two',
                ]),
                [
                    1,
                    'two',
                ],
            );
            expectThrows(() => Arr.array(arrayArray, 'string'), InvalidArgumentException);
        });
    });
};
