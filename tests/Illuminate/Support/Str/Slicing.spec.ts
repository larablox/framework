/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (slicing methods: `length`,
 * `substr`, `charAt`, `take`, `reverse`).
 *
 * `Str::length()`/`Str::substr()` accept an `$encoding` argument in PHP
 * (`mb_strlen`/`mb_substr`'s third parameter); this port's `Str.length()`/
 * `Str.substr()` always work codepoint-aware through the `utf8` library and
 * take no encoding parameter, so the `'UTF-8'` arguments PHP's tests pass are
 * simply dropped -- the assertions themselves are unchanged.
 */
export = (): void => {
    describe('Str slicing', () => {
        it('length() counts codepoints', () => {
            // PHP: SupportStrTest::testLength
            expect(Str.length('foo bar baz')).to.equal(11);
        });

        it('substr() slices by codepoint, PHP mb_substr semantics', () => {
            // PHP: SupportStrTest::testSubstr
            expect(Str.substr('БГДЖИЛЁ', -1)).to.equal('Ё');
            expect(Str.substr('БГДЖИЛЁ', -2)).to.equal('ЛЁ');
            expect(Str.substr('БГДЖИЛЁ', -3, 1)).to.equal('И');
            expect(Str.substr('БГДЖИЛЁ', 2, -1)).to.equal('ДЖИЛ');
            expect(Str.substr('БГДЖИЛЁ', 4, -4)).to.equal('');
            expect(Str.substr('БГДЖИЛЁ', -3, -1)).to.equal('ИЛ');
            expect(Str.substr('БГДЖИЛЁ', 1)).to.equal('ГДЖИЛЁ');
            expect(Str.substr('БГДЖИЛЁ', 1, 3)).to.equal('ГДЖ');
            expect(Str.substr('БГДЖИЛЁ', 0, 4)).to.equal('БГДЖ');
            expect(Str.substr('БГДЖИЛЁ', -1, 1)).to.equal('Ё');
            expect(Str.substr('Б', 2)).to.equal('');
        });

        it('charAt() returns the codepoint at an index, undefined out of range', () => {
            // PHP: SupportStrTest::testCharAt
            expect(Str.charAt('Привет, мир!', 1)).to.equal('р');
            expect(Str.charAt('「こんにちは世界」', 4)).to.equal('ち');
            expect(Str.charAt('Привет, world!', 8)).to.equal('w');
            expect(Str.charAt('「こんにちは世界」', -2)).to.equal('界');
            expect(Str.charAt('「こんにちは世界」', -200)).to.equal(undefined);
            expect(Str.charAt('Привет, мир!', 100)).to.equal(undefined);
        });

        it('take() takes the first or last N characters', () => {
            // PHP: SupportStrTest::testTake
            expect(Str.take('abcdef', 2)).to.equal('ab');
            expect(Str.take('abcdef', -2)).to.equal('ef');
            expect(Str.take('abcdef', 0)).to.equal('');
            expect(Str.take('', 2)).to.equal('');
            expect(Str.take('abcdef', 10)).to.equal('abcdef');
            expect(Str.take('abcdef', 6)).to.equal('abcdef');
            expect(Str.take('üöä', 1)).to.equal('ü');
        });

        it('reverse() reverses by codepoint', () => {
            // PHP: SupportStrTest::testReverse
            expect(Str.reverse('raBooF')).to.equal('FooBar');
            expect(Str.reverse('őtüzsineT')).to.equal('Teniszütő');
            expect(Str.reverse('☆etyBitluM❤')).to.equal('❤MultiByte☆');
        });
    });
};
