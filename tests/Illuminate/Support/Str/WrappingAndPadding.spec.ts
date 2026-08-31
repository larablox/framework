/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (wrapping and padding
 * methods: `start`, `finish`, `wrap`, `unwrap`, `chopStart`, `chopEnd`,
 * `padBoth`, `padLeft`, `padRight`, `mask`, `substrReplace`, `repeat`).
 *
 * `Str::mask()`'s PHP `$encoding` argument (its `ISO-8859-1` cases) has no
 * counterpart -- this port's `mask()` always works codepoint-aware through
 * `utf8`, so those two assertions are dropped. `Str::repeat()` with a
 * negative `$times` throws `ValueError` in PHP; Luau's `string.rep()` simply
 * returns `""` for a negative count instead of erroring, so
 * `testRepeatWhenTimesIsNegative` isn't ported (no exception to assert).
 *
 * `Str::chopStart()`/`Str::chopEnd()`'s PHP test data is a single associative
 * array literal with several **repeated keys** (`'http://laravel.com'`
 * appears six times, for instance); PHP array-literal semantics keep only
 * the last value assigned to each key; at position each key's *first*
 * occurrence, so most of those entries never actually run in the original
 * test. The cases below are exactly the ones PHP's own key collision leaves
 * standing, not a re-selection.
 */
export = (): void => {
    describe('Str wrapping and padding', () => {
        it('start() begins a string with a single instance of a value', () => {
            // PHP: SupportStrTest::testStrStart
            expect(Str.start('test/string', '/')).to.equal('/test/string');
            expect(Str.start('/test/string', '/')).to.equal('/test/string');
            expect(Str.start('//test/string', '/')).to.equal('/test/string');
        });

        it('finish() caps a string with a single instance of a value', () => {
            // PHP: SupportStrTest::testFinish
            expect(Str.finish('ab', 'bc')).to.equal('abbc');
            expect(Str.finish('abbcbc', 'bc')).to.equal('abbc');
            expect(Str.finish('abcbbcbc', 'bc')).to.equal('abcbbc');
        });

        it('wrap() wraps a string with the given strings', () => {
            // PHP: SupportStrTest::testWrap
            expect(Str.wrap('value', '"')).to.equal('"value"');
            expect(Str.wrap('-bar-', 'foo', 'baz')).to.equal('foo-bar-baz');
        });

        it('wrap() handles edge cases', () => {
            // PHP: SupportStrTest::testWrapEdgeCases
            expect(Str.wrap('mid', '[]')).to.equal('[]mid[]');
            expect(Str.wrap('mid', '(', '')).to.equal('(mid');
            expect(Str.wrap('mid', '<')).to.equal('<mid<');
            expect(Str.wrap('value', '')).to.equal('value');
            expect(Str.wrap('', '[]')).to.equal('[][]');
            expect(Str.wrap('値', '«', '»')).to.equal('«値»');
            expect(Str.wrap('X', '🧪')).to.equal('🧪X🧪');
        });

        it('unwrap() removes the given strings from a wrapped string', () => {
            // PHP: SupportStrTest::testUnwrap
            expect(Str.unwrap('"value"', '"')).to.equal('value');
            expect(Str.unwrap('"value', '"')).to.equal('value');
            expect(Str.unwrap('value"', '"')).to.equal('value');
            expect(Str.unwrap('foo-bar-baz', 'foo-', '-baz')).to.equal('bar');
            expect(Str.unwrap('{some: "json"}', '{', '}')).to.equal('some: "json"');
        });

        it('chopStart() removes a needle from the start of a string', () => {
            // PHP: SupportStrTest::testChopStart (deduplicated, see class
            // comment)
            expect(Str.chopStart('', '')).to.equal('');
            expect(Str.chopStart('Laravel', '')).to.equal('Laravel');
            expect(Str.chopStart('Ship it', [
                '',
                'Ship ',
            ])).to.equal('it');
            expect(Str.chopStart('http://laravel.com', [
                'https://',
                'http://',
            ])).to.equal('laravel.com');
            expect(Str.chopStart('http://-http://', 'http://')).to.equal('-http://');
            expect(Str.chopStart('http://www.laravel.com', [
                'http://',
                'www.',
            ])).to.equal('www.laravel.com');
            expect(Str.chopStart('http://http-is-fun.test', 'http://')).to.equal('http-is-fun.test');
            // Multibyte emoji tests
            expect(Str.chopStart('🌊✋', '✋')).to.equal('🌊✋');
            expect(Str.chopStart('🚀🌟💫', '🚀🌟')).to.equal('💫');
            // Multibyte character tests (Japanese, Chinese, Arabic, ...)
            expect(Str.chopStart('你好世界', '你好')).to.equal('世界');
            expect(Str.chopStart('مرحبا بك', 'مرحبا ')).to.equal('بك');
            // Mixed multibyte and ASCII
            expect(Str.chopStart('🎉Laravel', '🎉')).to.equal('Laravel');
            expect(Str.chopStart('Hello🌍World', 'Hello🌍')).to.equal('World');
            // Multiple needle array with multibyte
            expect(Str.chopStart('🌊✋🎉', [
                '🚀',
                '🌊',
            ])).to.equal('✋🎉');
            expect(Str.chopStart('こんにちは世界', [
                'Hello',
                'こんにちは',
            ])).to.equal('世界');
        });

        it('chopEnd() removes a needle from the end of a string', () => {
            // PHP: SupportStrTest::testChopEnd (deduplicated, see class
            // comment)
            expect(Str.chopEnd('', '')).to.equal('');
            expect(Str.chopEnd('Laravel', '')).to.equal('Laravel');
            expect(Str.chopEnd('Ship it', [
                '',
                ' it',
            ])).to.equal('Ship');
            expect(Str.chopEnd('path/to/file.php', [
                '.php',
                'file',
            ])).to.equal('path/to/file');
            expect(Str.chopEnd('.php-.php', '.php')).to.equal('.php-');
            expect(Str.chopEnd('path/to/php.php', '.php')).to.equal('path/to/php');
            // Multibyte emoji tests
            expect(Str.chopEnd('✋🌊', '✋')).to.equal('✋🌊');
            expect(Str.chopEnd('🌟💫🚀', '💫🚀')).to.equal('🌟');
            // Multibyte character tests (Japanese, Chinese, Arabic, ...)
            expect(Str.chopEnd('世界こんにちは', [
                'Hello',
                'こんにちは',
            ])).to.equal('世界');
            expect(Str.chopEnd('世界你好', '你好')).to.equal('世界');
            expect(Str.chopEnd('بك مرحبا', ' مرحبا')).to.equal('بك');
            // Mixed multibyte and ASCII
            expect(Str.chopEnd('Laravel🎉', '🎉')).to.equal('Laravel');
            expect(Str.chopEnd('Hello🌍World', 'World')).to.equal('Hello🌍');
            // Multiple needle array with multibyte
            expect(Str.chopEnd('🎉✋🌊', [
                '🚀',
                '🌊',
            ])).to.equal('🎉✋');
        });

        it('padBoth() pads both sides of a string', () => {
            // PHP: SupportStrTest::testPadBoth
            expect(Str.padBoth('Alien', 10, '_')).to.equal('__Alien___');
            expect(Str.padBoth('Alien', 10)).to.equal('  Alien   ');
            expect(Str.padBoth('❤MultiByte☆', 16)).to.equal('  ❤MultiByte☆   ');
            expect(Str.padBoth('❤MultiByte☆', 16, '❤☆')).to.equal('❤☆❤MultiByte☆❤☆❤');
        });

        it('padLeft() pads the left side of a string', () => {
            // PHP: SupportStrTest::testPadLeft
            expect(Str.padLeft('Alien', 10, '-=')).to.equal('-=-=-Alien');
            expect(Str.padLeft('Alien', 10)).to.equal('     Alien');
            expect(Str.padLeft('❤MultiByte☆', 16)).to.equal('     ❤MultiByte☆');
            expect(Str.padLeft('❤MultiByte☆', 16, '❤☆')).to.equal('❤☆❤☆❤❤MultiByte☆');
        });

        it('padRight() pads the right side of a string', () => {
            // PHP: SupportStrTest::testPadRight
            expect(Str.padRight('Alien', 10, '-=')).to.equal('Alien-=-=-');
            expect(Str.padRight('Alien', 10)).to.equal('Alien     ');
            expect(Str.padRight('❤MultiByte☆', 16)).to.equal('❤MultiByte☆     ');
            expect(Str.padRight('❤MultiByte☆', 16, '❤☆')).to.equal('❤MultiByte☆❤☆❤☆❤');
        });

        it('mask() masks a portion of a string', () => {
            // PHP: SupportStrTest::testMask (ISO-8859-1 encoding cases
            // dropped, see class comment)
            expect(Str.mask('taylor@email.com', '*', 3)).to.equal('tay*************');
            expect(Str.mask('taylor@email.com', '*', 0, 6)).to.equal('******@email.com');
            expect(Str.mask('taylor@email.com', '*', -13)).to.equal('tay*************');
            expect(Str.mask('taylor@email.com', '*', -13, 3)).to.equal('tay***@email.com');

            expect(Str.mask('taylor@email.com', '*', -17)).to.equal('****************');
            expect(Str.mask('taylor@email.com', '*', -99, 5)).to.equal('*****r@email.com');

            expect(Str.mask('taylor@email.com', '*', 16)).to.equal('taylor@email.com');
            expect(Str.mask('taylor@email.com', '*', 16, 99)).to.equal('taylor@email.com');

            expect(Str.mask('taylor@email.com', '', 3)).to.equal('taylor@email.com');

            expect(Str.mask('taylor@email.com', 'something', 3)).to.equal('taysssssssssssss');
            expect(Str.mask('taylor@email.com', Str.of('something').toString(), 3)).to.equal('taysssssssssssss');

            expect(Str.mask('这是一段中文', '*', 3)).to.equal('这是一***');
            expect(Str.mask('这是一段中文', '*', 0, 2)).to.equal('**一段中文');

            expect(Str.mask('maan@email.com', '*', 2, 1)).to.equal('ma*n@email.com');
            expect(Str.mask('maan@email.com', '*', 2, 3)).to.equal('ma***email.com');
            expect(Str.mask('maan@email.com', '*', 2)).to.equal('ma************');

            expect(Str.mask('maria@email.com', '*', 4, 1)).to.equal('mari*@email.com');
            expect(Str.mask('tamara@email.com', '*', 5, 1)).to.equal('tamar*@email.com');

            expect(Str.mask('maria@email.com', '*', 0, 1)).to.equal('*aria@email.com');
            expect(Str.mask('maria@email.com', '*', -1, 1)).to.equal('maria@email.co*');
            expect(Str.mask('maria@email.com', '*', -1)).to.equal('maria@email.co*');
            expect(Str.mask('maria@email.com', '*', -15)).to.equal('***************');
            expect(Str.mask('maria@email.com', '*', 0)).to.equal('***************');
        });

        it('substrReplace() replaces text within a portion of a string', () => {
            // PHP: SupportStrTest::testSubstrReplace
            expect(Str.substrReplace('1200', ':', 2, 0)).to.equal('12:00');
            expect(Str.substrReplace('The Framework', 'Laravel ', 4, 0)).to.equal('The Laravel Framework');
            expect(Str.substrReplace('Laravel Framework', '– The PHP Framework for Web Artisans', 8)).to.equal(
                'Laravel – The PHP Framework for Web Artisans',
            );
            // Edge cases with negative offset or length
            expect(Str.substrReplace('1234', '567', -3, 3)).to.equal('1567');
            expect(Str.substrReplace('1234', '567', 2, -1)).to.equal('125674');
            expect(Str.substrReplace('1234', '567', -2, -1)).to.equal('125674');
        });

        it('substrReplace() handles multibyte strings', () => {
            // PHP: SupportStrTest::testSubstrReplaceWithMultibyte
            expect(Str.substrReplace('kenkä', 'ng', -3, 2)).to.equal('kengä');
            expect(Str.substrReplace('kenka', 'ng', -3, 2)).to.equal('kenga');
        });

        it('repeat() repeats a string a given number of times', () => {
            // PHP: SupportStrTest::testRepeat (the ValueError-on-negative
            // case dropped, see class comment)
            expect(Str.repeat('Hello', 0)).to.equal('');
            expect(Str.repeat('Hello', 1)).to.equal('Hello');
            expect(Str.repeat('a', 5)).to.equal('aaaaa');
            expect(Str.repeat('', 5)).to.equal('');
        });
    });
};
