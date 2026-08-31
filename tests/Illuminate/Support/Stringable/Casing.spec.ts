/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (casing methods:
 * `kebab`, `lower`, `upper`, `title`, `ucwords`, `ucsplit`, `snake`,
 * `studly`, `pascal`, `camel`, `initials`).
 *
 * `lower()`/`upper()` and everything built on them fold ASCII only, same as
 * `Str` (see `Str.ts`'s class comment and `Str/Casing.spec.ts`).
 */
export = (): void => {
    describe('Stringable casing', () => {
        it('kebab() converts to kebab case', () => {
            // PHP: SupportStringableTest::testKebab
            expect(Str.of('LaravelPhpFramework').kebab().toString()).to.equal('laravel-php-framework');
        });

        it('lower()/upper() fold ASCII case', () => {
            // PHP: SupportStringableTest::testLower / testUpper
            expect(Str.of('FOO BAR BAZ').lower().toString()).to.equal('foo bar baz');
            expect(Str.of('fOo Bar bAz').lower().toString()).to.equal('foo bar baz');

            expect(Str.of('foo bar baz').upper().toString()).to.equal('FOO BAR BAZ');
            expect(Str.of('foO bAr BaZ').upper().toString()).to.equal('FOO BAR BAZ');
        });

        it('title() titles every word', () => {
            // PHP: SupportStringableTest::testTitle
            expect(Str.of('jefferson costella').title().toString()).to.equal('Jefferson Costella');
            expect(Str.of('jefFErson coSTella').title().toString()).to.equal('Jefferson Costella');
        });

        it('ucwords() upper-cases the first character of every word', () => {
            // PHP: SupportStringableTest::testUcwords
            expect(Str.of('laravel').ucwords().toString()).to.equal('Laravel');
            expect(Str.of('laravel framework').ucwords().toString()).to.equal('Laravel Framework');
            expect(Str.of('laravel-framework').ucwords('-').toString()).to.equal('Laravel-Framework');
            // Multibyte words: `Str::ucwords()` is Unicode-aware upstream, see
            // the same case in `Str/Casing.spec.ts`.
            expect(Str.of('мама').ucwords().toString()).to.equal('Мама');
            expect(Str.of('мама мыла раму').ucwords().toString()).to.equal('Мама Мыла Раму');
            expect(Str.of('JJ watt').ucwords().toString()).to.equal('JJ Watt');
        });

        it('ucsplit() splits a string on its upper case characters', () => {
            // PHP: SupportStringableTest::testUcsplitOnStringable
            expect(arraysEqual(Str.of('TaylorOtwell').ucsplit().all(), [
                'Taylor',
                'Otwell',
            ])).to.equal(true);
            expect(arraysEqual(Str.of('HelloFromLaravel').ucsplit().all(), [
                'Hello',
                'From',
                'Laravel',
            ])).to.equal(
                true,
            );
            expect(arraysEqual(Str.of('He_llo_World').ucsplit().all(), [
                'He_llo_',
                'World',
            ])).to.equal(true);
        });

        it('snake() converts to snake case', () => {
            // PHP: SupportStringableTest::testSnake
            expect(Str.of('LaravelPHPFramework').snake().toString()).to.equal('laravel_p_h_p_framework');
            expect(Str.of('LaravelPhpFramework').snake().toString()).to.equal('laravel_php_framework');
            expect(Str.of('LaravelPhpFramework').snake(' ').toString()).to.equal('laravel php framework');
            expect(Str.of('Laravel Php Framework').snake().toString()).to.equal('laravel_php_framework');
            // ensure cache keys don't overlap
            expect(Str.of('LaravelPhpFramework').snake('__').toString()).to.equal('laravel__php__framework');
            expect(Str.of('LaravelPhpFramework_').snake('_').toString()).to.equal('laravel_php_framework_');
            // prevent breaking changes
            expect(Str.of('foo-bar').snake().toString()).to.equal('foo-bar');
            expect(Str.of('Foo-Bar').snake().toString()).to.equal('foo-_bar');
            expect(Str.of('Foo_Bar').snake().toString()).to.equal('foo__bar');
            expect(Str.of('ŻółtaŁódka').snake().toString()).to.equal('żółtałódka');
        });

        it('studly()/pascal() convert to studly/pascal case', () => {
            // PHP: SupportStringableTest::testStudly / testPascal
            expect(Str.of('laravel_p_h_p_framework').studly().toString()).to.equal('LaravelPHPFramework');
            expect(Str.of('laravel-phP-framework').studly().toString()).to.equal('LaravelPhPFramework');
            expect(Str.of('fooBar').studly().toString()).to.equal('FooBar');
            expect(Str.of('foo-barBaz').studly().toString()).to.equal('FooBarBaz');

            expect(Str.of('laravel_p_h_p_framework').pascal().toString()).to.equal('LaravelPHPFramework');
            expect(Str.of('laravel-phP-framework').pascal().toString()).to.equal('LaravelPhPFramework');
            expect(Str.of('fooBar').pascal().toString()).to.equal('FooBar');
            expect(Str.of('foo-barBaz').pascal().toString()).to.equal('FooBarBaz');
        });

        it('camel() converts to camel case', () => {
            // PHP: SupportStringableTest::testCamel
            expect(Str.of('Laravel_p_h_p_framework').camel().toString()).to.equal('laravelPHPFramework');
            expect(Str.of('Laravel-phP-framework').camel().toString()).to.equal('laravelPhPFramework');
            expect(Str.of('FooBar').camel().toString()).to.equal('fooBar');
            expect(Str.of('Foo-barBaz').camel().toString()).to.equal('fooBarBaz');
        });

        it('initials() takes the first letter of every word', () => {
            // PHP: SupportStringableTest::testInitials
            expect(Str.of('Taylor Otwell').initials().toString()).to.equal('TO');
            expect(Str.of('taylor otwell').initials().toString()).to.equal('to');
            expect(Str.of('taylor otwell').initials(true).toString()).to.equal('TO');
            expect(Str.of('james bond').initials(true).toString()).to.equal('JB');
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
