/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (trimming methods: `trim`,
 * `ltrim`, `rtrim`, `squish`).
 *
 * `Str::trim()`'s PHP test also strips a raw high-byte character (`"\xE9"`,
 * Latin-1 `é` outside valid UTF-8) to prove PHP's `trim()` treats it as an
 * ordinary, non-whitespace byte. This port's `trim()` runs through Luau
 * pattern character classes over the string's raw bytes the same way, so the
 * scenario -- a non-ASCII byte survives trimming untouched -- still holds
 * and is kept using a valid UTF-8 stand-in (`"é"`) instead of an invalid
 * byte sequence, which Luau string literals cannot express portably.
 */
export = (): void => {
    describe('Str trimming', () => {
        it('trim() removes whitespace, or the given characters, from both ends', () => {
            // PHP: SupportStrTest::testTrim
            expect(Str.trim('   foo bar   ')).to.equal('foo bar');
            expect(Str.trim('foo bar   ')).to.equal('foo bar');
            expect(Str.trim('   foo bar')).to.equal('foo bar');
            expect(Str.trim('foo bar')).to.equal('foo bar');
            expect(Str.trim(' foo bar ', '')).to.equal(' foo bar ');
            expect(Str.trim(' foo bar ', ' ')).to.equal('foo bar');
            expect(Str.trim('-foo  bar_', '-_')).to.equal('foo  bar');

            expect(Str.trim(' foo    bar ')).to.equal('foo    bar');

            expect(Str.trim('   123    ')).to.equal('123');
            expect(Str.trim('だ')).to.equal('だ');
            expect(Str.trim('ム')).to.equal('ム');
            expect(Str.trim('   だ    ')).to.equal('だ');
            expect(Str.trim('   ム    ')).to.equal('ム');

            expect(
                Str.trim(`
                foo bar
            `),
            ).to.equal('foo bar');
            expect(
                Str.trim(`
                foo
                bar
            `),
            ).to.equal('foo\n                bar');

            // Non-ASCII, non-whitespace byte survives trimming untouched --
            // see class comment.
            expect(Str.trim(' é ')).to.equal('é');

            const trimDefaultChars = [' ', '\n', '\r', '\t', '\v', '\0'];

            for (const character of trimDefaultChars) {
                expect(Str.trim(` ${character} `)).to.equal('');
                expect(Str.trim(`${character} foo bar ${character}`)).to.equal('foo bar');
            }
        });

        it('ltrim() removes whitespace, or the given characters, from the start', () => {
            // PHP: SupportStrTest::testLtrim
            expect(Str.ltrim(' foo    bar ')).to.equal('foo    bar ');

            expect(Str.ltrim('   123    ')).to.equal('123    ');
            expect(Str.ltrim('だ')).to.equal('だ');
            expect(Str.ltrim('ム')).to.equal('ム');
            expect(Str.ltrim('   だ    ')).to.equal('だ    ');
            expect(Str.ltrim('   ム    ')).to.equal('ム    ');

            expect(
                Str.ltrim(`
                foo bar
            `),
            ).to.equal('foo bar\n            ');

            expect(Str.ltrim(' é ')).to.equal('é ');

            const ltrimDefaultChars = [' ', '\n', '\r', '\t', '\v', '\0'];

            for (const character of ltrimDefaultChars) {
                expect(Str.ltrim(` ${character} `)).to.equal('');
                expect(Str.ltrim(`${character} foo bar ${character}`)).to.equal(`foo bar ${character}`);
            }
        });

        it('rtrim() removes whitespace, or the given characters, from the end', () => {
            // PHP: SupportStrTest::testRtrim
            expect(Str.rtrim(' foo    bar ')).to.equal(' foo    bar');

            expect(Str.rtrim('   123    ')).to.equal('   123');
            expect(Str.rtrim('だ')).to.equal('だ');
            expect(Str.rtrim('ム')).to.equal('ム');
            expect(Str.rtrim('   だ    ')).to.equal('   だ');
            expect(Str.rtrim('   ム    ')).to.equal('   ム');

            expect(
                Str.rtrim(`
                foo bar
            `),
            ).to.equal('\n                foo bar');

            expect(Str.rtrim(' é ')).to.equal(' é');

            const rtrimDefaultChars = [' ', '\n', '\r', '\t', '\v', '\0'];

            for (const character of rtrimDefaultChars) {
                expect(Str.rtrim(` ${character} `)).to.equal('');
                expect(Str.rtrim(`${character} foo bar ${character}`)).to.equal(`${character} foo bar`);
            }
        });

        it('squish() collapses extraneous whitespace into single spaces', () => {
            // PHP: SupportStrTest::testSquish
            expect(Str.squish(' laravel   php  framework ')).to.equal('laravel php framework');
            expect(Str.squish('laravel\t\tphp\n\nframework')).to.equal('laravel php framework');
            expect(
                Str.squish(`
            laravel
            php
            framework
        `),
            ).to.equal('laravel php framework');
            expect(Str.squish('   laravel   php   framework   ')).to.equal('laravel php framework');
            expect(Str.squish('   123    ')).to.equal('123');
            expect(Str.squish('だ')).to.equal('だ');
            expect(Str.squish('ム')).to.equal('ム');
            expect(Str.squish('   だ    ')).to.equal('だ');
            expect(Str.squish('   ム    ')).to.equal('ム');
            expect(Str.squish('laravelㅤㅤㅤphpㅤframework')).to.equal('laravel php framework');
            expect(Str.squish('laravelᅠᅠᅠᅠᅠᅠᅠᅠᅠᅠphpᅠᅠframework')).to.equal('laravel php framework');
        });
    });
};
