/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Collection } from 'Illuminate/Support/Collection';

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `map`,
 * `mapWithKeys`, `flatMap`, `transform`, `each`, `pluck`, `keyBy`,
 * `implode`/`join`. See `Construction.spec.ts`'s class comment for the
 * adaptations shared across this directory.
 */
export = (): void => {
    describe('Collection transformation', () => {
        it('map() runs a callback over every item, keeping keys', () => {
            // PHP: SupportCollectionTest::testMap
            const data = new Collection<string, string>({
                first: 'taylor',
                last: 'otwell',
            });
            const mapped = data.map((item, key) => key + item.upper());

            expect(mapped.entries().size()).to.equal(2);
            const values = mapped.values().all();
            expect(values.includes('firstTAYLOR')).to.equal(true);
            expect(values.includes('lastOTWELL')).to.equal(true);
        });

        it('mapWithKeys() builds a fresh key/value pair for every item', () => {
            // PHP: SupportCollectionTest::testMapWithKeys
            const data = new Collection([
                { name: 'Blastoise', type: 'Water' },
                { name: 'Charmander', type: 'Fire' },
            ]);

            const result = data.mapWithKeys((pokemon) => [pokemon.name, pokemon.type] as [string, string]);

            expect(result.get('Blastoise')).to.equal('Water');
            expect(result.get('Charmander')).to.equal('Fire');
        });

        it('flatMap() maps then flattens the result by a single level', () => {
            // PHP: SupportCollectionTest::testFlatMap
            const data = new Collection([
                { name: 'taylor', hobbies: ['programming', 'basketball'] },
                { name: 'adam', hobbies: ['music', 'powerlifting'] },
            ]);

            const flattened = data.flatMap((person) => person.hobbies);

            expectDeepEqual(flattened.all(), ['programming', 'basketball', 'music', 'powerlifting']);
        });

        it('transform() mutates every item in place', () => {
            // PHP: SupportCollectionTest::testTransform
            const data = new Collection<string, string>({
                first: 'taylor',
                last: 'otwell',
            });
            data.transform((item, key) => `${key}-${item.reverse()}`);

            expect(data.get('first')).to.equal('first-rolyat');
            expect(data.get('last')).to.equal('last-llewto');
        });

        it('each() iterates every item, stopping early on `false`', () => {
            // PHP: SupportCollectionTest::testEach
            const original = [1, 2, 3, 4, 5];
            const c = new Collection(original);

            const result: Array<number> = [];
            c.each((item) => {
                result.push(item);
            });
            expectDeepEqual(result, original);

            const partial: Array<number> = [];
            c.each((item) => {
                partial.push(item);

                if (item === 3) {
                    return false;
                }

                return undefined;
            });
            expectDeepEqual(partial, [1, 2, 3]);
        });

        it('pluck() plucks a value out of every item, optionally re-keying it', () => {
            // PHP: SupportCollectionTest::testPluckWithArrayAndObjectValues,
            // ::testPluckWithDotNotation
            const data = new Collection([
                { name: 'taylor', email: 'foo' },
                { name: 'dayle', email: 'bar' },
            ]);

            expectDeepEqual(data.pluck('name').all(), ['taylor', 'dayle']);

            const keyed = data.pluck<string>('email', 'name');
            expect(keyed.get('taylor')).to.equal('foo');
            expect(keyed.get('dayle')).to.equal('bar');

            const nested = new Collection([{ user: { name: 'taylor' } }, { user: { name: 'dayle' } }]);
            expectDeepEqual(nested.pluck('user.name').all(), ['taylor', 'dayle']);
        });

        it('keyBy() re-keys the collection by a field or a callback', () => {
            // PHP: SupportCollectionTest::testKeyByAttribute, ::testKeyByClosure
            const data = new Collection([
                { rating: 1, name: '1' },
                { rating: 2, name: '2' },
                { rating: 3, name: '3' },
            ]);

            const result = data.keyBy<number>('rating');
            expectDeepEqual(result.get(1), { rating: 1, name: '1' });
            expectDeepEqual(result.get(2), { rating: 2, name: '2' });
            expectDeepEqual(result.get(3), { rating: 3, name: '3' });

            const doubled = data.keyBy((item) => item.rating * 2);
            expectDeepEqual(doubled.get(2), { rating: 1, name: '1' });
            expectDeepEqual(doubled.get(6), { rating: 3, name: '3' });
        });

        it('implode() / join() concatenate the items, or a given key of them', () => {
            // PHP: SupportCollectionTest::testImplode, ::testJoin
            const data = new Collection([
                { name: 'taylor', email: 'foo' },
                { name: 'dayle', email: 'bar' },
            ]);
            expect(data.implode(',', 'name')).to.equal('taylor,dayle');

            expect(new Collection(['a', 'b', 'c']).join(', ')).to.equal('a, b, c');
            expect(new Collection(['a']).join(', ')).to.equal('a');
            expect(new Collection([]).join(', ')).to.equal('');
        });
    });
};
