/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (replacing methods:
 * `replace`, `replaceArray`, `replaceFirst`, `replaceStart`, `replaceLast`,
 * `replaceEnd`, `remove`, `swap`, `deduplicate`, `replaceMatches`).
 *
 * `Stringable::replace()`/`Stringable::remove()` have no `$caseSensitive`
 * parameter (same as `Str`, see `Str/Replacing.spec.ts`'s class comment);
 * every PHP case passing `false` for it is dropped. `collect([...])`
 * search/replace arguments have no counterpart and are dropped -- the
 * plain-array cases already exercise the same paths.
 *
 * `Stringable::replaceStart('0', '1')`'s PHP case relies on the implicit
 * int-to-string cast of the numeric search `0`; ported as the literal
 * string `"0"`.
 *
 * `Stringable::replaceMatches()`'s pattern is a Luau pattern, not PCRE (see
 * `Str.ts`'s class comment); the capture-group callback case is ported using
 * Luau's single-capture callback form.
 */
export = (): void => {
    describe('Stringable replacing', () => {
        it('replace() replaces every occurrence', () => {
            // PHP: SupportStringableTest::testReplace (case-insensitive and
            // collect() cases dropped, see class comment)
            expect(Str.of('?/?/?').replace('?', 'foo').toString()).to.equal('foo/foo/foo');
            expect(Str.of('?/?').replace('?', 'bar').toString()).to.equal('bar/bar');
            expect(Str.of('? ? ?').replace(' ', '/').toString()).to.equal('?/?/?');
            expect(
                Str.of('?1/?2/?3/?4').replace(['?1', '?2', '?3', '?4'], ['foo', 'bar', 'baz', 'bam']).toString(),
            ).to.equal('foo/bar/baz/bam');
        });

        it('replaceArray() replaces a value sequentially with an array', () => {
            // PHP: SupportStringableTest::testReplaceArray (collect() case
            // dropped)
            expect(Str.of('?/?/?').replaceArray('?', ['foo', 'bar', 'baz']).toString()).to.equal('foo/bar/baz');
            expect(Str.of('?/?/?/?').replaceArray('?', ['foo', 'bar', 'baz']).toString()).to.equal('foo/bar/baz/?');
            expect(Str.of('?/?').replaceArray('?', ['foo', 'bar', 'baz']).toString()).to.equal('foo/bar');
            expect(Str.of('?/?/?').replaceArray('x', ['foo', 'bar', 'baz']).toString()).to.equal('?/?/?');
            expect(Str.of('?/?/?').replaceArray('?', ['foo?', 'bar', 'baz']).toString()).to.equal('foo?/bar/baz');
        });

        it('replaceFirst()/replaceStart() replace the leading occurrence', () => {
            // PHP: SupportStringableTest::testReplaceFirst / testReplaceStart
            expect(Str.of('foobar foobar').replaceFirst('bar', 'qux').toString()).to.equal('fooqux foobar');
            expect(Str.of('foobar foobar').replaceFirst('bar', '').toString()).to.equal('foo foobar');
            expect(Str.of('foobar foobar').replaceFirst('xxx', 'yyy').toString()).to.equal('foobar foobar');
            expect(Str.of('foobar foobar').replaceFirst('', 'yyy').toString()).to.equal('foobar foobar');
            expect(Str.of('Jönköping Malmö').replaceFirst('ö', 'xxx').toString()).to.equal('Jxxxnköping Malmö');

            expect(Str.of('foobar foobar').replaceStart('bar', 'qux').toString()).to.equal('foobar foobar');
            expect(Str.of('foobar foobar').replaceStart('foo', 'qux').toString()).to.equal('quxbar foobar');
            expect(Str.of('foobar foobar').replaceStart('foo', '').toString()).to.equal('bar foobar');
            expect(Str.of('0').replaceStart('0', '1').toString()).to.equal('1');
            expect(Str.of('Jönköping Malmö').replaceStart('Jö', 'xxx').toString()).to.equal('xxxnköping Malmö');
        });

        it('replaceLast()/replaceEnd() replace the trailing occurrence', () => {
            // PHP: SupportStringableTest::testReplaceLast / testReplaceEnd
            expect(Str.of('foobar foobar').replaceLast('bar', 'qux').toString()).to.equal('foobar fooqux');
            expect(Str.of('foobar foobar').replaceLast('bar', '').toString()).to.equal('foobar foo');
            expect(Str.of('foobar foobar').replaceLast('xxx', 'yyy').toString()).to.equal('foobar foobar');
            expect(Str.of('Malmö Jönköping').replaceLast('ö', 'xxx').toString()).to.equal('Malmö Jönkxxxping');

            expect(Str.of('foobar foobar').replaceEnd('bar', 'qux').toString()).to.equal('foobar fooqux');
            expect(Str.of('foobar foobar').replaceEnd('bar', '').toString()).to.equal('foobar foo');
            expect(Str.of('fooxxx foobar').replaceEnd('xxx', 'yyy').toString()).to.equal('fooxxx foobar');
            expect(Str.of('Malmö Jönköping').replaceEnd('ö', 'xxx').toString()).to.equal('Malmö Jönköping');
            expect(Str.of('Malmö Jönköping').replaceEnd('öping', 'yyy').toString()).to.equal('Malmö Jönkyyy');
        });

        it('remove() removes any occurrence of the given string(s)', () => {
            // PHP: SupportStringableTest::testRemove (case-insensitive cases
            // dropped, see class comment)
            expect(Str.of('Foobar').remove('o').toString()).to.equal('Fbar');
            expect(Str.of('Foobar').remove('bar').toString()).to.equal('Foo');
            expect(Str.of('Foobar').remove('F').toString()).to.equal('oobar');
            expect(Str.of('Foobar').remove('f').toString()).to.equal('Foobar');
            expect(Str.of('Foobar').remove(['o', 'a']).toString()).to.equal('Fbr');
            expect(Str.of('Foobar').remove(['f', 'b']).toString()).to.equal('Fooar');
            expect(Str.of('Foo|bar').remove(['f', '|']).toString()).to.equal('Foobar');
        });

        it('swap() replaces multiple keys with their values', () => {
            // PHP: SupportStringableTest::testSwap (assoc array -> array of
            // pairs, see `Str.swap()`'s class comment)
            expect(
                Str.of('PHP is awesome')
                    .swap([
                        ['PHP', 'PHP 8'],
                        ['awesome', 'fantastic'],
                    ])
                    .toString(),
            ).to.equal('PHP 8 is fantastic');
        });

        it('deduplicate() collapses runs of a repeated character', () => {
            // PHP: SupportStringableTest::testDedup
            expect(Str.of(' laravel   php  framework ').deduplicate().toString()).to.equal(' laravel php framework ');
            expect(Str.of('whaaat').deduplicate('a').toString()).to.equal('what');
            expect(Str.of('/some//odd//path/').deduplicate('/').toString()).to.equal('/some/odd/path/');
            expect(Str.of('ムだだム').deduplicate('だ').toString()).to.equal('ムだム');
            expect(Str.of(' laravell    foreverrr  ').deduplicate([' ', 'l', 'r']).toString()).to.equal(
                ' laravel forever ',
            );
        });

        it('replaceMatches() replaces every match, with a string or a callback', () => {
            // PHP: SupportStringableTest::testReplaceMatches (adapted to
            // Luau patterns, see class comment)
            const result = Str.of('Hello world!').replaceMatches('world', (match) => Str.upper(match));

            expect(result.toString()).to.equal('Hello WORLD!');

            const limited = Str.of('apple orange apple').replaceMatches('apple', 'fruit', 1);

            expect(limited.toString()).to.equal('fruit orange apple');
        });
    });
};
