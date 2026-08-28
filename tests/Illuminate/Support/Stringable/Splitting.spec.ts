/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (splitting methods:
 * `explode`, `split`).
 *
 * `testExplode`'s `assertInstanceOf(Collection::class, ...)` and its
 * `json_encode($stringable->explode(...))` string-comparison assertions are
 * replaced with a direct array comparison of `explode()`'s `Collection`
 * contents -- the underlying claim (what `explode()` produces, including the
 * `$limit` behavior) is unchanged. `testChunk`'s name refers to PHP's
 * `Stringable::chunk()`; this port's equivalent is `split()` given a
 * numeric pattern (see the class comment on `Stringable::split()` in
 * `Str.ts`), which is what the PHP test itself calls.
 */
export = (): void => {
    describe('Stringable splitting', () => {
        it('explode() splits the string into a collection', () => {
            // PHP: SupportStringableTest::testExplode
            expect(arraysEqual(Str.of('Foo Bar Baz').explode(' ').all(), ['Foo', 'Bar', 'Baz'])).to.equal(true);

            // with limit
            expect(arraysEqual(Str.of('Foo Bar Baz').explode(' ', 2).all(), ['Foo', 'Bar Baz'])).to.equal(true);
            expect(arraysEqual(Str.of('Foo Bar Baz').explode(' ', -1).all(), ['Foo', 'Bar'])).to.equal(true);
        });

        it('split() breaks the string into fixed-size chunks', () => {
            // PHP: SupportStringableTest::testChunk
            const chunks = Str.of('foobarbaz').split(3);

            expect(arraysEqual(chunks.all(), ['foo', 'bar', 'baz'])).to.equal(true);
        });
    });
};

/** Shallow array-equality helper -- TestEZ's `expect().to.equal()` is `===`. */
function arraysEqual(value: Array<string>, expected: Array<string>): boolean {
    if (value.size() !== expected.size()) {
        return false;
    }

    for (let index = 0; index < expected.size(); index++) {
        if (value[index] !== expected[index]) {
            return false;
        }
    }

    return true;
}
