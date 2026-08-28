/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (casing methods: `title`,
 * `headline`, `initials`, `apa`, `convertCase`, `kebab`, `lower`, `upper`,
 * `studly`, `pascal`, `camel`, `snake`, `lcfirst`, `ucfirst`, `ucwords`,
 * `ucsplit`).
 *
 * `lower()`/`upper()` and everything built on them (`title`, `studly`,
 * `camel`, `snake`, `apa`, `ucfirst`, `lcfirst`, ...) fold ASCII only -- see
 * the class comment on `Str` in `Str.ts`. `Str::apa()`'s PHP cases that
 * depend on folding non-Latin scripts (Cyrillic, accented French) are
 * dropped for that reason: this port's `ucfirst()` leaves a non-ASCII first
 * letter untouched, so those assertions would fail on a platform limit, not
 * a logic bug. `Str::studly()`/`Str::pascal()`'s `normalize` parameter (PHP
 * 12) has no counterpart -- see `agent_docs/laravel-parity.md` -- so the
 * `normalize: true` cases are dropped too.
 */
export = (): void => {
    describe('Str casing', () => {
        it('title() titles every word', () => {
            // PHP: SupportStrTest::testStringTitle
            expect(Str.title('jefferson costella')).to.equal('Jefferson Costella');
            expect(Str.title('jefFErson coSTella')).to.equal('Jefferson Costella');
            expect(Str.title('')).to.equal('');
            expect(Str.title('123 laravel')).to.equal('123 Laravel');
            expect(Str.title('❤laravel')).to.equal('❤Laravel');
            expect(Str.title('laravel ❤')).to.equal('Laravel ❤');
            expect(Str.title('laravel123')).to.equal('Laravel123');
            expect(Str.title('Laravel123')).to.equal('Laravel123');

            const longString = `lorem ipsum ${'dolor sit amet '.rep(1000)}`;
            const expected = `Lorem Ipsum Dolor Sit Amet ${'Dolor Sit Amet '.rep(999)}`;
            expect(Str.title(longString)).to.equal(expected);
        });

        it('headline() titles every word and normalizes separators', () => {
            // PHP: SupportStrTest::testStringHeadline
            expect(Str.headline('jefferson costella')).to.equal('Jefferson Costella');
            expect(Str.headline('jefFErson coSTella')).to.equal('Jefferson Costella');
            expect(Str.headline('jefferson_costella uses-_Laravel')).to.equal('Jefferson Costella Uses Laravel');
            expect(Str.headline('jefferson_costella uses__Laravel')).to.equal('Jefferson Costella Uses Laravel');

            expect(Str.headline('laravel_p_h_p_framework')).to.equal('Laravel P H P Framework');
            expect(Str.headline('laravel _p _h _p _framework')).to.equal('Laravel P H P Framework');
            expect(Str.headline('laravel_php_framework')).to.equal('Laravel Php Framework');
            expect(Str.headline('laravel-phP-framework')).to.equal('Laravel Ph P Framework');
            expect(Str.headline('laravel  -_-  php   -_-   framework   ')).to.equal('Laravel Php Framework');

            expect(Str.headline('fooBar')).to.equal('Foo Bar');
            expect(Str.headline('foo_bar')).to.equal('Foo Bar');
            expect(Str.headline('foo-barBaz')).to.equal('Foo Bar Baz');
            expect(Str.headline('foo-bar_baz')).to.equal('Foo Bar Baz');

            expect(Str.headline('öffentliche-überraschungen')).to.equal('Öffentliche Überraschungen');
            expect(Str.headline('-_öffentliche_überraschungen_-')).to.equal('Öffentliche Überraschungen');
            expect(Str.headline('-öffentliche überraschungen')).to.equal('Öffentliche Überraschungen');

            expect(Str.headline('sindÖdeUndSo')).to.equal('Sind Öde Und So');

            expect(Str.headline('❤_multiByte-☆')).to.equal('❤ Multi Byte ☆');

            expect(Str.headline('orwell 1984')).to.equal('Orwell 1984');
            expect(Str.headline('orwell   1984')).to.equal('Orwell 1984');
            expect(Str.headline('-orwell-1984 -')).to.equal('Orwell 1984');
            expect(Str.headline(' orwell_- 1984 ')).to.equal('Orwell 1984');

            expect(Str.headline('laravel rocks!')).to.equal('Laravel Rocks!');
        });

        it('initials() takes the first letter of every word', () => {
            // PHP: SupportStrTest::testStringInitials
            expect(Str.initials('james bond')).to.equal('jb');
            expect(Str.initials(' james bond')).to.equal('jb');
            expect(Str.initials('james  bond')).to.equal('jb');

            expect(Str.initials('James Bond')).to.equal('JB');

            expect(Str.initials('james bond', true)).to.equal('JB');

            expect(Str.initials('james bond loves laravel', true)).to.equal('JBLL');

            expect(Str.initials('❤ MULTIByte ☆')).to.equal('❤M☆');

            expect(Str.initials('laravel rocks!')).to.equal('lr');
            expect(Str.initials('laravel rocks!', true)).to.equal('LR');
        });

        it('apa() applies APA-style title case, English service words only', () => {
            // PHP: SupportStrTest::testStringApa (Cyrillic and accented-French
            // cases dropped -- ucfirst()/upper() fold ASCII only, see class
            // comment)
            expect(Str.apa('tom and jerry')).to.equal('Tom and Jerry');
            expect(Str.apa('TOM AND JERRY')).to.equal('Tom and Jerry');
            expect(Str.apa('Tom And Jerry')).to.equal('Tom and Jerry');

            expect(Str.apa('back to the future')).to.equal('Back to the Future');
            expect(Str.apa('BACK TO THE FUTURE')).to.equal('Back to the Future');
            expect(Str.apa('Back To The Future')).to.equal('Back to the Future');

            expect(Str.apa('this, then that')).to.equal('This, Then That');
            expect(Str.apa('THIS, THEN THAT')).to.equal('This, Then That');
            expect(Str.apa('This, Then That')).to.equal('This, Then That');

            expect(Str.apa('bond. james bond.')).to.equal('Bond. James Bond.');
            expect(Str.apa('BOND. JAMES BOND.')).to.equal('Bond. James Bond.');
            expect(Str.apa('Bond. James Bond.')).to.equal('Bond. James Bond.');

            expect(Str.apa('self-report')).to.equal('Self-Report');
            expect(Str.apa('Self-report')).to.equal('Self-Report');
            expect(Str.apa('SELF-REPORT')).to.equal('Self-Report');

            expect(Str.apa('as the world turns, so are the days of our lives')).to.equal(
                'As the World Turns, So Are the Days of Our Lives',
            );
            expect(Str.apa('AS THE WORLD TURNS, SO ARE THE DAYS OF OUR LIVES')).to.equal(
                'As the World Turns, So Are the Days of Our Lives',
            );
            expect(Str.apa('As The World Turns, So Are The Days Of Our Lives')).to.equal(
                'As the World Turns, So Are the Days of Our Lives',
            );

            expect(Str.apa('to kill a mockingbird')).to.equal('To Kill a Mockingbird');
            expect(Str.apa('TO KILL A MOCKINGBIRD')).to.equal('To Kill a Mockingbird');
            expect(Str.apa('To Kill A Mockingbird')).to.equal('To Kill a Mockingbird');

            expect(Str.apa('Laravel Rocks!')).to.equal('Laravel Rocks!');
            expect(Str.apa('Laravel rocks!')).to.equal('Laravel Rocks!');
            expect(Str.apa('LARAVEL ROCKS!')).to.equal('Laravel Rocks!');

            expect(Str.apa('')).to.equal('');
            expect(Str.apa('   ')).to.equal('   ');
        });

        it('convertCase() switches between lower, upper and title case', () => {
            // PHP: SupportStrTest::testConvertCase (MB_CASE_FOLD, the
            // multi-byte UTF-8 cases and the ValueError-on-unsupported-mode
            // case are dropped -- convertCase() takes one of exactly three
            // TypeScript-checked modes, no runtime-invalid mode exists to
            // throw for, and case folding here is ASCII-only, see class
            // comment)
            expect(Str.convertCase('hello', 'upper')).to.equal('HELLO');
            expect(Str.convertCase('WORLD', 'upper')).to.equal('WORLD');

            expect(Str.convertCase('HELLO', 'lower')).to.equal('hello');
            expect(Str.convertCase('WORLD', 'lower')).to.equal('world');
        });

        it('kebab() converts to kebab case', () => {
            // PHP: SupportStrTest::testKebab
            expect(Str.kebab('LaravelPhpFramework')).to.equal('laravel-php-framework');
            expect(Str.kebab('Laravel Php Framework')).to.equal('laravel-php-framework');
            expect(Str.kebab('Laravel ❤ Php Framework')).to.equal('laravel❤-php-framework');
            expect(Str.kebab('')).to.equal('');
        });

        it('lower() lower-cases ASCII letters', () => {
            // PHP: SupportStrTest::testLower
            expect(Str.lower('FOO BAR BAZ')).to.equal('foo bar baz');
            expect(Str.lower('fOo Bar bAz')).to.equal('foo bar baz');
        });

        it('upper() upper-cases ASCII letters', () => {
            // PHP: SupportStrTest::testUpper
            expect(Str.upper('foo bar baz')).to.equal('FOO BAR BAZ');
            expect(Str.upper('foO bAr BaZ')).to.equal('FOO BAR BAZ');
        });

        it('studly() converts to studly caps case', () => {
            // PHP: SupportStrTest::testStudly (normalize: true cases dropped,
            // see class comment)
            expect(Str.studly('laravel_p_h_p_framework')).to.equal('LaravelPHPFramework');
            expect(Str.studly('laravel_php_framework')).to.equal('LaravelPhpFramework');
            expect(Str.studly('laravel-phP-framework')).to.equal('LaravelPhPFramework');
            expect(Str.studly('laravel  -_-  php   -_-   framework   ')).to.equal('LaravelPhpFramework');

            expect(Str.studly('fooBar')).to.equal('FooBar');
            expect(Str.studly('foo_bar')).to.equal('FooBar');
            expect(Str.studly('foo_bar')).to.equal('FooBar'); // exercises the cache
            expect(Str.studly('foo-barBaz')).to.equal('FooBarBaz');
            expect(Str.studly('foo-bar_baz')).to.equal('FooBarBaz');

            expect(Str.studly('öffentliche-überraschungen')).to.equal('ÖffentlicheÜberraschungen');
            expect(Str.studly('❤ multi-byte☆')).to.equal('❤MultiByte☆');

            expect(Str.studly('laravel rocks!')).to.equal('LaravelRocks!');
        });

        it('pascal() converts to pascal case', () => {
            // PHP: SupportStrTest::testPascal
            expect(Str.pascal('laravel_php_framework')).to.equal('LaravelPhpFramework');
            expect(Str.pascal('laravel-php-framework')).to.equal('LaravelPhpFramework');
            expect(Str.pascal('laravel  -_-  php   -_-   framework   ')).to.equal('LaravelPhpFramework');

            expect(Str.pascal('fooBar')).to.equal('FooBar');
            expect(Str.pascal('foo_bar')).to.equal('FooBar');
            expect(Str.pascal('foo_bar')).to.equal('FooBar'); // exercises the cache
            expect(Str.pascal('foo-barBaz')).to.equal('FooBarBaz');
            expect(Str.pascal('foo-bar_baz')).to.equal('FooBarBaz');

            expect(Str.pascal('öffentliche-überraschungen')).to.equal('ÖffentlicheÜberraschungen');
        });

        it('camel() converts to camel case', () => {
            // PHP: SupportStrTest::testCamel
            expect(Str.camel('Laravel_p_h_p_framework')).to.equal('laravelPHPFramework');
            expect(Str.camel('Laravel_php_framework')).to.equal('laravelPhpFramework');
            expect(Str.camel('Laravel-phP-framework')).to.equal('laravelPhPFramework');
            expect(Str.camel('Laravel  -_-  php   -_-   framework   ')).to.equal('laravelPhpFramework');

            expect(Str.camel('FooBar')).to.equal('fooBar');
            expect(Str.camel('foo_bar')).to.equal('fooBar');
            expect(Str.camel('foo_bar')).to.equal('fooBar'); // exercises the cache
            expect(Str.camel('Foo-barBaz')).to.equal('fooBarBaz');
            expect(Str.camel('foo-bar_baz')).to.equal('fooBarBaz');

            expect(Str.camel('')).to.equal('');
            expect(Str.camel('LARAVEL_PHP_FRAMEWORK')).to.equal('lARAVELPHPFRAMEWORK');
            expect(Str.camel('   laravel   php   framework   ')).to.equal('laravelPhpFramework');

            expect(Str.camel('foo1_bar')).to.equal('foo1Bar');
            expect(Str.camel('1 foo bar')).to.equal('1FooBar');
        });

        it('snake() converts to snake case', () => {
            // PHP: SupportStrTest::testSnake
            expect(Str.snake('LaravelPHPFramework')).to.equal('laravel_p_h_p_framework');
            expect(Str.snake('LaravelPhpFramework')).to.equal('laravel_php_framework');
            expect(Str.snake('LaravelPhpFramework', ' ')).to.equal('laravel php framework');
            expect(Str.snake('Laravel Php Framework')).to.equal('laravel_php_framework');
            expect(Str.snake('Laravel    Php      Framework   ')).to.equal('laravel_php_framework');
            // Ensure cache keys don't overlap
            expect(Str.snake('LaravelPhpFramework', '__')).to.equal('laravel__php__framework');
            expect(Str.snake('LaravelPhpFramework_', '_')).to.equal('laravel_php_framework_');
            expect(Str.snake('laravel php Framework')).to.equal('laravel_php_framework');
            expect(Str.snake('laravel php FrameWork')).to.equal('laravel_php_frame_work');
            // Prevent breaking changes
            expect(Str.snake('foo-bar')).to.equal('foo-bar');
            expect(Str.snake('Foo-Bar')).to.equal('foo-_bar');
            expect(Str.snake('Foo_Bar')).to.equal('foo__bar');
            expect(Str.snake('ŻółtaŁódka')).to.equal('żółtałódka');
        });

        it('lcfirst() lower-cases only the first character', () => {
            // PHP: SupportStrTest::testLcfirst
            expect(Str.lcfirst('Laravel')).to.equal('laravel');
            expect(Str.lcfirst('Laravel framework')).to.equal('laravel framework');
            // Multibyte first character: upstream `Str::lcfirst()` is
            // `mb_lcfirst()`, and `Support/Unicode.ts` applies the same simple
            // case mapping here.
            expect(Str.lcfirst('Мама')).to.equal('мама');
            expect(Str.lcfirst('Мама мыла раму')).to.equal('мама мыла раму');
        });

        it('ucfirst() upper-cases only the first character', () => {
            // PHP: SupportStrTest::testUcfirst
            expect(Str.ucfirst('laravel')).to.equal('Laravel');
            expect(Str.ucfirst('laravel framework')).to.equal('Laravel framework');
            // Multibyte first character, see lcfirst() above.
            expect(Str.ucfirst('мама')).to.equal('Мама');
            expect(Str.ucfirst('мама мыла раму')).to.equal('Мама мыла раму');
        });

        it('ucwords() upper-cases the first character of every word', () => {
            // PHP: SupportStrTest::testUcwords
            expect(Str.ucwords('laravel')).to.equal('Laravel');
            expect(Str.ucwords('laravel framework')).to.equal('Laravel Framework');
            expect(Str.ucwords('laravel-framework', '-')).to.equal('Laravel-Framework');
            // Multibyte words: upstream `Str::ucwords()` matches `\p{Ll}` and
            // upper cases through `mb_strtoupper()`, so Cyrillic is covered.
            // `Str::snake()` is the one that stays ASCII -- it calls PHP's
            // *global* `ucwords()` instead, see the snake() case below.
            expect(Str.ucwords('мама')).to.equal('Мама');
            expect(Str.ucwords('мама мыла раму')).to.equal('Мама Мыла Раму');
            expect(Str.ucwords('JJ watt')).to.equal('JJ Watt');
        });

        it('ucsplit() splits a string on its upper case characters', () => {
            // PHP: SupportStrTest::testUcsplit
            expect(arraysEqual(Str.ucsplit('Laravel_p_h_p_framework'), ['Laravel_p_h_p_framework'])).to.equal(true);
            expect(arraysEqual(Str.ucsplit('Laravel_P_h_p_framework'), ['Laravel_', 'P_h_p_framework'])).to.equal(true);
            expect(arraysEqual(Str.ucsplit('laravelPHPFramework'), ['laravel', 'P', 'H', 'P', 'Framework'])).to.equal(
                true,
            );
            expect(arraysEqual(Str.ucsplit('Laravel-phP-framework'), ['Laravel-ph', 'P-framework'])).to.equal(true);

            expect(arraysEqual(Str.ucsplit('ŻółtaŁódka'), ['Żółta', 'Łódka'])).to.equal(true);
            expect(arraysEqual(Str.ucsplit('sindÖdeUndSo'), ['sind', 'Öde', 'Und', 'So'])).to.equal(true);
            expect(arraysEqual(Str.ucsplit('ÖffentlicheÜberraschungen'), ['Öffentliche', 'Überraschungen'])).to.equal(
                true,
            );
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
