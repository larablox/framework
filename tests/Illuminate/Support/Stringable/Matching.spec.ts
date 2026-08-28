/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (matching methods:
 * `match`, `matchAll`, `test`, `isMatch`, `is`).
 *
 * `Stringable::isMatch()`/`match()`/`matchAll()`/`test()` take PCRE in PHP;
 * this port's counterparts take a Luau pattern (see `Str.ts`'s class
 * comment and `Str/Matching.spec.ts`'s class comment for the full
 * rationale). `testIsMatch`'s PCRE-only cases (delimiters, the `i` flag,
 * alternation) don't translate and aren't ported -- `isMatch()`'s
 * true/false-on-any-of-an-array behavior is still exercised through `test()`
 * below. `testIsWithMultilineStrings` isn't ported either, for the same
 * reason as `Str.is()`'s (see `Str/Matching.spec.ts`).
 */
export = (): void => {
    describe('Stringable matching', () => {
        it('match()/matchAll() return matches against a Luau pattern', () => {
            // PHP: SupportStringableTest::testMatch (PCRE translated to Luau
            // patterns)
            const stringable = Str.of('foo bar');

            expect(stringable.match('bar').toString()).to.equal('bar');
            expect(stringable.match('foo (.*)').toString()).to.equal('bar');
            expect(stringable.match('nothing').isEmpty()).to.equal(true);

            expect(arraysEqual(Str.of('bar foo bar').matchAll('bar').all(), ['bar', 'bar'])).to.equal(true);

            const multi = Str.of('bar fun bar fly');

            expect(arraysEqual(multi.matchAll('f(%w*)').all(), ['un', 'ly'])).to.equal(true);
            expect(multi.matchAll('nothing').isEmpty()).to.equal(true);
        });

        it('test() reports whether the Luau pattern matches', () => {
            // PHP: SupportStringableTest::testTest (adapted to Luau
            // patterns)
            const stringable = Str.of('foo bar');

            expect(stringable.test('bar')).to.equal(true);
            expect(stringable.test('foo (.*)')).to.equal(true);
            expect(stringable.test('nope')).to.equal(false);
        });

        it('is() matches strings against wildcard patterns', () => {
            // PHP: SupportStringableTest::testIs (StringableObjectStub and
            // numeric-value/pattern cases dropped -- `is()`'s arguments are
            // typed `string | Array<string>` here)
            expect(Str.of('/').is('/')).to.equal(true);
            expect(Str.of('/').is(' /')).to.equal(false);
            expect(Str.of('/a').is('/')).to.equal(false);
            expect(Str.of('foo/bar/baz').is('foo/*')).to.equal(true);

            expect(Str.of('App\\Class@method').is('*@*')).to.equal(true);
            expect(Str.of('app\\Class@').is('*@*')).to.equal(true);
            expect(Str.of('@method').is('*@*')).to.equal(true);

            // is case sensitive
            expect(Str.of('foo/bar/baz').is('*BAZ*')).to.equal(false);
            expect(Str.of('foo/bar/baz').is('*FOO*')).to.equal(false);
            expect(Str.of('a').is('A')).to.equal(false);

            // is not case sensitive
            expect(Str.of('a').is('A', true)).to.equal(true);
            expect(Str.of('foo/bar/baz').is('*BAZ*', true)).to.equal(true);
            expect(Str.of('a/').is(['A*', 'B*'], true)).to.equal(true);
            expect(Str.of('f/').is(['A*', 'B*'], true)).to.equal(false);
            expect(Str.of('foo').is('FOO', true)).to.equal(true);
            expect(Str.of('FOO/bar').is('foo/*', true)).to.equal(true);

            // Accepts array of patterns
            expect(Str.of('a/').is(['a*', 'b*'])).to.equal(true);
            expect(Str.of('b/').is(['a*', 'b*'])).to.equal(true);
            expect(Str.of('f/').is(['a*', 'b*'])).to.equal(false);

            expect(Str.of('blah/baz/foo').is('*/foo')).to.equal(true);

            // empty patterns
            expect(Str.of('test').is([])).to.equal(false);
        });
    });
};

/** Shallow array-equality helper -- TestEZ's `expect().to.equal()` is `===`. */
function arraysEqual(value: Array<string>, expected: Array<string>): boolean
{
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
