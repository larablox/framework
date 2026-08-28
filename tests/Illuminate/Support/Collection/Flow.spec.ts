/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Collection } from 'Illuminate/Support/Collection';
import { VarDumper } from 'Illuminate/Support/VarDumper';

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `tap`, `pipe`,
 * `when`, `unless`, `whenEmpty`, `whenNotEmpty`, `dump`. See
 * `Construction.spec.ts`'s class comment for the adaptations shared across
 * this directory.
 *
 * PHP's `when()`/`unless()`/`whenEmpty()`/`whenNotEmpty()` return whatever
 * the invoked callback returns (falling back to `$this`), which is how
 * `$data = $data->when($cond, fn ($c) => $c->concat([...]))` picks up a
 * *new* collection built by a non-mutating call like `concat()`. This
 * port's `when()` (`Collection.ts`) always returns `this` regardless of the
 * callback's return value, so every scenario here drives the callback with
 * a mutating call (`push()`) instead of `concat()`, preserving the
 * "callback ran / didn't run" behavior under test without relying on the
 * return-value substitution PHP's version does.
 */
export = (): void => {
    describe('Collection flow', () => {
        it('tap() passes the collection to a callback and returns it unchanged', () => {
            // PHP: SupportCollectionTest::testTap
            const data = new Collection([
                1,
                2,
                3,
            ]);

            let fromTap: Array<number> = [];
            let tappedInstance: Collection<defined, number> | undefined;
            const result = data.tap((collection) => {
                fromTap = collection.slice(0, 1).toArray() as Array<number>;
                tappedInstance = collection;
            });

            expect(result).to.equal(data);
            expect(tappedInstance).to.equal(data);
            expectDeepEqual(fromTap, [1]);
            expectDeepEqual(data.toArray(), [
                1,
                2,
                3,
            ]);
        });

        it('pipe() passes the collection to a callback and returns its result', () => {
            // PHP: SupportCollectionTest::testPipe
            const data = new Collection([
                1,
                2,
                3,
            ]);

            expect(data.pipe((collection) => collection.sum())).to.equal(6);
        });

        it('when() runs a callback only if the condition is true, with an otherwise', () => {
            // PHP: SupportCollectionTest::testWhen, ::testWhenDefault
            const data = new Collection([
                'michael',
                'tom',
            ]);
            data.when(true, (collection) => collection.push('adam'));
            expectDeepEqual(data.toArray(), [
                'michael',
                'tom',
                'adam',
            ]);

            const untouched = new Collection([
                'michael',
                'tom',
            ]);
            untouched.when(false, (collection) => collection.push('adam'));
            expectDeepEqual(untouched.toArray(), [
                'michael',
                'tom',
            ]);

            const withOtherwise = new Collection([
                'michael',
                'tom',
            ]);
            withOtherwise.when(
                false,
                (collection) => collection.push('adam'),
                (collection) => collection.push('taylor'),
            );
            expectDeepEqual(withOtherwise.toArray(), [
                'michael',
                'tom',
                'taylor',
            ]);
        });

        it('unless() runs a callback only if the condition is false, with an otherwise', () => {
            // PHP: SupportCollectionTest::testUnless, ::testUnlessDefault
            const data = new Collection([
                'michael',
                'tom',
            ]);
            data.unless(false, (collection) => collection.push('caleb'));
            expectDeepEqual(data.toArray(), [
                'michael',
                'tom',
                'caleb',
            ]);

            const untouched = new Collection([
                'michael',
                'tom',
            ]);
            untouched.unless(true, (collection) => collection.push('caleb'));
            expectDeepEqual(untouched.toArray(), [
                'michael',
                'tom',
            ]);
        });

        it("whenEmpty() / whenNotEmpty() branch on the collection's emptiness", () => {
            // PHP: SupportCollectionTest::testWhenEmpty, ::testWhenNotEmpty
            const data = new Collection([
                'michael',
                'tom',
            ]);
            data.whenEmpty(() => {
                throw 'whenEmpty() should not trigger on a non-empty collection';
            });
            expectDeepEqual(data.toArray(), [
                'michael',
                'tom',
            ]);

            const empty = new Collection<number, string>();
            empty.whenEmpty((collection) => collection.push('adam'));
            expectDeepEqual(empty.toArray(), ['adam']);

            const notEmpty = new Collection([
                'michael',
                'tom',
            ]);
            notEmpty.whenNotEmpty((collection) => collection.push('adam'));
            expectDeepEqual(notEmpty.toArray(), [
                'michael',
                'tom',
                'adam',
            ]);

            const stillEmpty = new Collection<number, string>();
            stillEmpty.whenNotEmpty((collection) => collection.push('adam'));
            expectDeepEqual(stillEmpty.toArray(), []);
        });

        it('dump() dumps the items, then each extra argument, and returns the collection unchanged', () => {
            // PHP: SupportCollectionTest::testDump
            // `defined`, not `unknown`: a Luau table cannot hold a nil,
            // so an array is typed as never holding one either.
            const log: Array<defined> = [];

            // Swapped and put back around the call and nothing else: an
            // assertion failing in between would leave every later `dump()`
            // in the run writing into this array instead of the console.
            // Upstream restores at the end of the test and has the same hole.
            VarDumper.setHandler((value) => {
                log.push(value as defined);
            });

            const data = new Collection([
                1,
                2,
                3,
            ]);
            const returned = data.dump('one', 'two');

            VarDumper.setHandler();

            expect(returned).to.equal(data);
            expectDeepEqual(log, [
                [
                    1,
                    2,
                    3,
                ],
                'one',
                'two',
            ]);
            expectDeepEqual(data.toArray(), [
                1,
                2,
                3,
            ]);
        });
    });
};
