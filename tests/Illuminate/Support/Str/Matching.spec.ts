/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (matching methods: `is`,
 * `match`, `isMatch`, `matchAll`, `replaceMatches`).
 *
 * `Str::isMatch()`/`Str::match()`/`Str::matchAll()`/`Str::replaceMatches()`
 * take PCRE (`/pattern/flags`) in PHP; this port's counterparts take a Luau
 * pattern (see the class comment on `Str` in `Str.ts`). `testIsMatch`'s cases
 * are entirely PCRE-specific -- delimiters, the `i` flag, alternation,
 * anchors with `$(.*)` -- none translate to a Luau pattern without changing
 * what's under test, so that whole test is not ported; `Str.isMatch()`'s
 * behavior (does this pattern match anywhere in the string, any of an array
 * of patterns) is still exercised via `match`/`matchAll` below with Luau
 * patterns of equivalent shape.
 *
 * `Str::replaceMatches()` is already fully covered by `Replacing.spec.ts`
 * (including the capture-group callback and array-of-patterns cases), so it
 * is not repeated here.
 *
 * `Str::is()`'s PHP test exercises PHP-only shapes not expressible here:
 * `Stringable` pattern/value objects, numeric (int) values and patterns,
 * `null` needles/patterns, and multiline heredoc patterns containing literal
 * newlines matched by `*` -- Lua's magic-character escaping and pattern
 * matching handle the `*`-wildcard-vs-multiline-string case differently
 * (`.` in a Luau pattern already matches `\n`), so `testIsWithMultilineStrings`
 * is dropped wholesale rather than partially ported into a different claim.
 */
export = (): void => {
    describe('Str matching', () => {
        it('is() matches strings against wildcard patterns', () => {
            // PHP: SupportStrTest::testIs (adapted -- see class comment)
            expect(Str.is('/', '/')).to.equal(true);
            expect(Str.is('/', ' /')).to.equal(false);
            expect(Str.is('/', '/a')).to.equal(false);
            expect(Str.is('foo/*', 'foo/bar/baz')).to.equal(true);

            expect(Str.is('*@*', 'App\\Class@method')).to.equal(true);
            expect(Str.is('*@*', 'app\\Class@')).to.equal(true);
            expect(Str.is('*@*', '@method')).to.equal(true);

            // is case sensitive
            expect(Str.is('*BAZ*', 'foo/bar/baz')).to.equal(false);
            expect(Str.is('*FOO*', 'foo/bar/baz')).to.equal(false);
            expect(Str.is('A', 'a')).to.equal(false);

            // is not case sensitive
            expect(Str.is('A', 'a', true)).to.equal(true);
            expect(Str.is('*BAZ*', 'foo/bar/baz', true)).to.equal(true);
            expect(Str.is(['A*', 'B*'], 'a/', true)).to.equal(true);
            expect(Str.is(['A*', 'B*'], 'f/', true)).to.equal(false);
            expect(Str.is('FOO', 'foo', true)).to.equal(true);
            expect(Str.is('*FOO*', 'foo/bar/baz', true)).to.equal(true);
            expect(Str.is('foo/*', 'FOO/bar', true)).to.equal(true);

            // Accepts array of patterns
            expect(Str.is(['a*', 'b*'], 'a/')).to.equal(true);
            expect(Str.is(['a*', 'b*'], 'b/')).to.equal(true);
            expect(Str.is(['a*', 'b*'], 'f/')).to.equal(false);

            expect(Str.is('*/foo', 'blah/baz/foo')).to.equal(true);

            // empty patterns
            expect(Str.is([], 'test')).to.equal(false);
        });

        it('match() returns the first match, or empty string', () => {
            // PHP: SupportStrTest::testMatch (PCRE delimiters and capture
            // groups translated to Luau patterns)
            expect(Str.match('bar', 'foo bar')).to.equal('bar');
            expect(Str.match('foo (.*)', 'foo bar')).to.equal('bar');
            expect(Str.match('nothing', 'foo bar')).to.equal('');

            expect(Str.match('pattern', '')).to.equal('');
        });

        it('matchAll() returns every match as a collection', () => {
            // PHP: SupportStrTest::testMatch
            expect(arraysEqual(Str.matchAll('bar', 'bar foo bar').all(), ['bar', 'bar'])).to.equal(true);

            expect(arraysEqual(Str.matchAll('f(%w*)', 'bar fun bar fly').all(), ['un', 'ly'])).to.equal(true);

            expect(Str.matchAll('nothing', 'bar fun bar fly').isEmpty()).to.equal(true);

            expect(Str.matchAll('pattern', '').isEmpty()).to.equal(true);
        });

        it('isMatch() reports whether any of the given patterns matched', () => {
            // PHP: SupportStrTest::testIsMatch (adapted to Luau patterns --
            // see class comment)
            expect(Str.isMatch('bar', 'Hello, Laravel!')).to.equal(false);
            expect(Str.isMatch('Laravel', 'Hello, Laravel!')).to.equal(true);
            expect(Str.isMatch('^Hello', 'Hello, Laravel!')).to.equal(true);
            expect(Str.isMatch('nope!', 'Hello, Laravel!')).to.equal(false);

            expect(Str.isMatch(['nope!', 'Laravel'], 'Hello, Laravel!')).to.equal(true);
            expect(Str.isMatch(['nope!', 'also nope'], 'Hello, Laravel!')).to.equal(false);
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
