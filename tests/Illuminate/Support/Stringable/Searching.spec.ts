/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (searching methods:
 * `isAscii`, `isUrl`, `isUuid`, `isUlid`, `isJson`, `isEmpty`, `isNotEmpty`,
 * `contains`, `containsAll`, `doesntContain`, `startsWith`, `doesntStartWith`,
 * `endsWith`, `doesntEndWith`, `position`, `substrCount`, `exactly`).
 *
 * Systematic drops, all a consequence of this port's methods being typed
 * `string | Array<string>` rather than PHP's untyped parameters (same as
 * `Str/Searching.spec.ts`):
 * - PHP's implicit int/float-to-string casts on needles (`startsWith(7)`,
 *   `endsWith(0.27)`) are dropped; only cases where the *subject* itself is
 *   numeric (`Str.of(7.123)`, valid since `Stringable`'s constructor takes
 *   `string | number | Stringable`) are kept, since the needle argument
 *   stays `string`.
 * - `null` needles and `collect([...])` needle arrays have no counterpart
 *   and are dropped.
 *
 * `Stringable::isUuid($version)`/`Stringable::isJson(null)` have no
 * counterpart: this port's `isUuid()` takes no version, and every method
 * here works on the instance's own string, there's no null overload.
 */
export = (): void => {
    describe('Stringable searching', () => {
        it('isAscii() reports whether the string is 7-bit ASCII', () => {
            // PHP: SupportStringableTest::testIsAscii
            expect(Str.of('A').isAscii()).to.equal(true);
            expect(Str.of('ù').isAscii()).to.equal(false);
        });

        it('isUrl() reports whether the string looks like a URL', () => {
            // PHP: SupportStringableTest::testIsUrl
            expect(Str.of('https://laravel.com').isUrl()).to.equal(true);
            expect(Str.of('https://laravel.com').isUrl(['https'])).to.equal(true);

            expect(Str.of('invalid url').isUrl()).to.equal(false);
            expect(Str.of('https://laravel.com').isUrl(['http'])).to.equal(false);
        });

        it('isUuid() reports whether the string is a valid UUID', () => {
            // PHP: SupportStringableTest::testIsUuid (the `$version` cases
            // are dropped, see class comment)
            expect(Str.of('2cdc7039-65a6-4ac7-8e5d-d554a98e7b15').isUuid()).to.equal(true);
            expect(Str.of('2cdc7039-65a6-4ac7-8e5d-d554a98').isUuid()).to.equal(false);
        });

        it('isUlid() reports whether the string is a valid ULID', () => {
            // PHP: SupportStringableTest::testIsUlid
            expect(Str.of('01GJSNW9MAF792C0XYY8RX6QFT').isUlid()).to.equal(true);
            expect(Str.of('01GJSNW9MAF-792C0XYY8RX6ssssss-QFT').isUlid()).to.equal(false);
        });

        it('isJson() validates JSON, including the malformed cases', () => {
            // PHP: SupportStringableTest::testIsJson (`null` case dropped)
            expect(Str.of('1').isJson()).to.equal(true);
            expect(Str.of('[1,2,3]').isJson()).to.equal(true);
            expect(Str.of('[1,   2,   3]').isJson()).to.equal(true);
            expect(Str.of('{"first": "John", "last": "Doe"}').isJson()).to.equal(true);
            expect(Str.of('[{"first": "John", "last": "Doe"}, {"first": "Jane", "last": "Doe"}]').isJson()).to.equal(
                true,
            );

            expect(Str.of('1,').isJson()).to.equal(false);
            expect(Str.of('[1,2,3').isJson()).to.equal(false);
            expect(Str.of('[1,   2   3]').isJson()).to.equal(false);
            expect(Str.of('{first: "John"}').isJson()).to.equal(false);
            expect(Str.of('[{first: "John"}, {first: "Jane"}]').isJson()).to.equal(false);
            expect(Str.of('').isJson()).to.equal(false);
        });

        it('isEmpty()/isNotEmpty() report whether the string is empty', () => {
            // PHP: SupportStringableTest::testIsEmpty / testIsNotEmpty
            expect(Str.of('').isEmpty()).to.equal(true);
            expect(Str.of('A').isEmpty()).to.equal(false);
            expect(Str.of('0').isEmpty()).to.equal(false);

            expect(Str.of('').isNotEmpty()).to.equal(false);
            expect(Str.of('A').isNotEmpty()).to.equal(true);
        });

        it('contains() reports whether the string contains a substring', () => {
            // PHP: SupportStringableTest::testContains (collect() needle
            // dropped, see class comment)
            expect(Str.of('taylor').contains('ylo')).to.equal(true);
            expect(Str.of('taylor').contains('taylor')).to.equal(true);
            expect(Str.of('taylor').contains(['ylo'])).to.equal(true);
            expect(Str.of('taylor').contains(['xxx', 'ylo'])).to.equal(true);
            expect(Str.of('taylor').contains(['LOR'], true)).to.equal(true);
            expect(Str.of('taylor').contains('xxx')).to.equal(false);
            expect(Str.of('taylor').contains(['xxx'])).to.equal(false);
            expect(Str.of('taylor').contains('')).to.equal(false);
        });

        it('containsAll() reports whether the string contains every value', () => {
            // PHP: SupportStringableTest::testContainsAll
            expect(Str.of('taylor otwell').containsAll(['taylor', 'otwell'])).to.equal(true);
            expect(Str.of('taylor otwell').containsAll(['TAYLOR', 'OTWELL'], true)).to.equal(true);
            expect(Str.of('taylor otwell').containsAll(['taylor'])).to.equal(true);
            expect(Str.of('taylor otwell').containsAll(['taylor', 'xxx'])).to.equal(false);
        });

        it('doesntContain() reports the inverse of contains()', () => {
            // PHP: SupportStringableTest::testDoesntContain
            expect(Str.of('taylor').doesntContain('xxx')).to.equal(true);
            expect(Str.of('taylor').doesntContain(['xxx'])).to.equal(true);
            expect(Str.of('taylor').doesntContain(['xxx', 'yyy'])).to.equal(true);
            expect(Str.of('taylor').doesntContain('')).to.equal(true);
            expect(Str.of('taylor').doesntContain('ylo')).to.equal(false);
            expect(Str.of('taylor').doesntContain('taylor')).to.equal(false);
            expect(Str.of('taylor').doesntContain(['xxx', 'ylo'])).to.equal(false);
            expect(Str.of('taylor').doesntContain(['LOR'], true)).to.equal(false);
        });

        it('startsWith()/doesntStartWith() check the prefix', () => {
            // PHP: SupportStringableTest::testStartsWith / testDoesntStartWith
            // (numeric-needle casts and collect()/null needles dropped)
            expect(Str.of('jason').startsWith('jas')).to.equal(true);
            expect(Str.of('jason').startsWith('jason')).to.equal(true);
            expect(Str.of('jason').startsWith(['jas'])).to.equal(true);
            expect(Str.of('jason').startsWith(['day', 'jas'])).to.equal(true);
            expect(Str.of('jason').startsWith('day')).to.equal(false);
            expect(Str.of('jason').startsWith(['day'])).to.equal(false);
            expect(Str.of('jason').startsWith('J')).to.equal(false);
            expect(Str.of('jason').startsWith('')).to.equal(false);
            expect(Str.of('7').startsWith(' 7')).to.equal(false);
            expect(Str.of('7a').startsWith('7')).to.equal(true);
            expect(Str.of(7.123).startsWith('7')).to.equal(true);
            expect(Str.of(7.123).startsWith('7.12')).to.equal(true);
            expect(Str.of(7.123).startsWith('7.13')).to.equal(false);
            // multibyte
            expect(Str.of('Jönköping').startsWith('Jö')).to.equal(true);
            expect(Str.of('Malmö').startsWith('Malmö')).to.equal(true);
            expect(Str.of('Jönköping').startsWith('Jonko')).to.equal(false);
            expect(Str.of('Malmö').startsWith('Malmo')).to.equal(false);

            expect(Str.of('jason').doesntStartWith('jas')).to.equal(false);
            expect(Str.of('jason').doesntStartWith('day')).to.equal(true);
            expect(Str.of('jason').doesntStartWith('')).to.equal(true);
            expect(Str.of('Jönköping').doesntStartWith('Jö')).to.equal(false);
            expect(Str.of('Jönköping').doesntStartWith('Jonko')).to.equal(true);
        });

        it('endsWith()/doesntEndWith() check the suffix', () => {
            // PHP: SupportStringableTest::testEndsWith / testDoesntEndWith
            // (numeric-needle casts and collect()/null needles dropped)
            expect(Str.of('jason').endsWith('on')).to.equal(true);
            expect(Str.of('jason').endsWith('jason')).to.equal(true);
            expect(Str.of('jason').endsWith(['on'])).to.equal(true);
            expect(Str.of('jason').endsWith(['no', 'on'])).to.equal(true);
            expect(Str.of('jason').endsWith('no')).to.equal(false);
            expect(Str.of('jason').endsWith(['no'])).to.equal(false);
            expect(Str.of('jason').endsWith('')).to.equal(false);
            expect(Str.of('jason').endsWith('N')).to.equal(false);
            expect(Str.of('7').endsWith(' 7')).to.equal(false);
            expect(Str.of('a7').endsWith('7')).to.equal(true);
            expect(Str.of(0.27).endsWith('7')).to.equal(true);
            expect(Str.of(0.27).endsWith('0.27')).to.equal(true);
            expect(Str.of(0.27).endsWith('8')).to.equal(false);
            // multibyte
            expect(Str.of('Jönköping').endsWith('öping')).to.equal(true);
            expect(Str.of('Malmö').endsWith('mö')).to.equal(true);
            expect(Str.of('Jönköping').endsWith('oping')).to.equal(false);
            expect(Str.of('Malmö').endsWith('mo')).to.equal(false);

            expect(Str.of('jason').doesntEndWith('on')).to.equal(false);
            expect(Str.of('jason').doesntEndWith('no')).to.equal(true);
            expect(Str.of('jason').doesntEndWith('')).to.equal(true);
        });

        it('position() finds the position of a substring', () => {
            // PHP: SupportStringableTest::testPosition (`$encoding` argument
            // dropped -- this port's `position()` takes no encoding, see
            // `Str/Slicing.spec.ts`'s class comment for the equivalent note
            // on `substr()`)
            expect(Str.of('Hello, World!').position('W')).to.equal(7);
            expect(Str.of('This is a test string.').position('test')).to.equal(10);
            expect(Str.of('This is a test string, test again.').position('test', 15)).to.equal(23);
            expect(Str.of('Hello, World!').position('Hello')).to.equal(0);
            expect(Str.of('Hello, World!').position('World!')).to.equal(7);
            expect(Str.of('Hello, World!').position('W', -6)).to.equal(7);
            expect(Str.of('Äpfel, Birnen und Kirschen').position('Kirschen', -10)).to.equal(18);
            expect(Str.of('Hello, World!').position('w')).to.equal(undefined);
            expect(Str.of('Hello, World!').position('X')).to.equal(undefined);
            expect(Str.of('').position('test')).to.equal(undefined);
        });

        it('substrCount() counts substring occurrences', () => {
            // PHP: SupportStringableTest::testSubstrCount ($offset/$length
            // arguments have no counterpart -- this port's `substrCount()`
            // takes only `needle`, see `agent_docs/laravel-parity.md`)
            expect(Str.of('laravelPHPFramework').substrCount('a')).to.equal(3);
            expect(Str.of('laravelPHPFramework').substrCount('z')).to.equal(0);
        });

        it('exactly() reports whether two strings match exactly', () => {
            // PHP: SupportStringableTest::testExactly (the `[]`/`0` scalar
            // comparisons are dropped -- `exactly()`'s argument is typed
            // `string | Stringable` here, there's no loosely-typed overload)
            expect(Str.of('foo').exactly(Str.of('foo'))).to.equal(true);
            expect(Str.of('foo').exactly('foo')).to.equal(true);

            expect(Str.of('Foo').exactly(Str.of('foo'))).to.equal(false);
            expect(Str.of('Foo').exactly('foo')).to.equal(false);
        });
    });
};
