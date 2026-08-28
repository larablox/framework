/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (words-and-limits methods:
 * `words`, `limit`, `wordCount`, `wordWrap`, `numbers`).
 *
 * `Str::wordCount()`'s PHP `$characters` argument (an `str_word_count()`
 * charlist widening what counts as a letter) has no counterpart here -- see
 * `agent_docs/laravel-parity.md` -- so every case that passes it is dropped;
 * the PHP source itself notes its own multibyte cases without `$characters`
 * are locale-dependent and not meaningful to pin down, which is a second,
 * independent reason to drop those too. `Str::numbers()`'s PHP array-subject
 * overload is dropped -- this port's `numbers()` takes a plain `string`.
 */
export = (): void => {
    describe('Str words and limits', () => {
        it('words() limits the number of words', () => {
            // PHP: SupportStrTest::testStringCanBeLimitedByWords
            expect(Str.words('Taylor Otwell', 1)).to.equal('Taylor...');
            expect(Str.words('Taylor Otwell', 1, '___')).to.equal('Taylor___');
            expect(Str.words('Taylor Otwell', 3)).to.equal('Taylor Otwell');
            expect(Str.words('Taylor Otwell', -1, '...')).to.equal('Taylor Otwell');
            expect(Str.words('', 3, '...')).to.equal('');
        });

        it('words() limits non-ASCII words the same way', () => {
            // PHP: SupportStrTest::testStringCanBeLimitedByWordsNonAscii
            expect(Str.words('这是 段中文', 1)).to.equal('这是...');
            expect(Str.words('这是 段中文', 1, '___')).to.equal('这是___');
            expect(Str.words('这是-段中文', 3, '___')).to.equal('这是-段中文');
            expect(Str.words('这是     段中文', 1, '___')).to.equal('这是___');
        });

        it('words() only trims where necessary', () => {
            // PHP: SupportStrTest::testStringTrimmedOnlyWhereNecessary
            expect(Str.words(' Taylor Otwell ', 3)).to.equal(' Taylor Otwell ');
            expect(Str.words(' Taylor Otwell ', 1)).to.equal(' Taylor...');
        });

        it("words() doesn't error on a string with no words", () => {
            // PHP: SupportStrTest::testStringWithoutWordsDoesntProduceError
            const nbsp = '\u{C2}\u{A0}';

            expect(Str.words(' ')).to.equal(' ');
            expect(Str.words(nbsp)).to.equal(nbsp);
            expect(Str.words('   ')).to.equal('   ');
            expect(Str.words('\t\t\t')).to.equal('\t\t\t');
        });

        it('limit() truncates a string to a character length', () => {
            // PHP: SupportStrTest::testLimit
            expect(Str.limit('Laravel is a free, open source PHP web application framework.', 10)).to.equal(
                'Laravel is...',
            );
            expect(Str.limit('这是一段中文', 6)).to.equal('这是一...');
            expect(
                Str.limit('Laravel is a free, open source PHP web application framework.', 15, '...', true),
            ).to.equal('Laravel is a...');

            const value = 'The PHP framework for web artisans.';

            expect(Str.limit(value, 7)).to.equal('The PHP...');
            expect(Str.limit(value, 10, '...', true)).to.equal('The PHP...');
            expect(Str.limit(value, 7, '')).to.equal('The PHP');
            expect(Str.limit(value, 10, '', true)).to.equal('The PHP');
            expect(Str.limit(value, 100)).to.equal('The PHP framework for web artisans.');
            expect(Str.limit(value, 100, '...', true)).to.equal('The PHP framework for web artisans.');
            expect(Str.limit(value, 20, '...', true)).to.equal('The PHP framework...');

            const nonAsciiString = '这是一段中文';

            expect(Str.limit(nonAsciiString, 6)).to.equal('这是一...');
            expect(Str.limit(nonAsciiString, 6, '...', true)).to.equal('这是一...');
            expect(Str.limit(nonAsciiString, 6, '')).to.equal('这是一');
            expect(Str.limit(nonAsciiString, 6, '', true)).to.equal('这是一');
        });

        it('numbers() strips everything but the digits', () => {
            // PHP: SupportStrTest::testNumbers (array-subject overload
            // dropped, see class comment)
            expect(Str.numbers('(555) 123-4567')).to.equal('5551234567');
            expect(Str.numbers('L4r4v3l!')).to.equal('443');
            expect(Str.numbers('Laravel!')).to.equal('');
        });

        it('wordCount() counts the words in a string', () => {
            // PHP: SupportStrTest::testWordCount ($characters and the
            // locale-dependent multibyte cases dropped, see class comment)
            expect(Str.wordCount('Hello, world!')).to.equal(2);
            expect(Str.wordCount('Hi, this is my first contribution to the Laravel framework.')).to.equal(10);
        });

        it('wordWrap() wraps a string to a given number of characters', () => {
            // PHP: SupportStrTest::testWordWrap
            expect(Str.wordWrap('Hello World', 3, '<br />')).to.equal('Hello<br />World');
            expect(Str.wordWrap('Hello World', 3, '<br />', true)).to.equal('Hel<br />lo<br />Wor<br />ld');

            expect(Str.wordWrap('❤Multi Byte☆❤☆❤☆❤', 3, '<br />')).to.equal('❤Multi<br />Byte☆❤☆❤☆❤');

            expect(Str.wordWrap('žltý kôň', 8, '\n')).to.equal('žltý kôň');
            expect(Str.wordWrap('žltý kôň', 4, '\n', true)).to.equal('žltý\nkôň');
            expect(Str.wordWrap('žltý', 2, '\n', true)).to.equal('žl\ntý');
            expect(Str.wordWrap('😀😀😀😀', 2, '\n', true)).to.equal('😀😀\n😀😀');
            expect(Str.wordWrap('é é', 1, 'A\x1aB')).to.equal('éA\x1aBé');
            expect(Str.wordWrap('❤Multi Byte☆❤☆❤☆❤', 3, '<br />', true)).to.equal(
                '❤Mu<br />lti<br />Byt<br />e☆❤<br />☆❤☆<br />❤',
            );
        });
    });
};
