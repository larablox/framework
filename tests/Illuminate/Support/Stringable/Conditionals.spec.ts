/// <reference types="@rbxts/testez/globals" />
import { Str, Stringable } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (conditional
 * methods, from `Conditionable`: `when`, `unless`, and every `Stringable`
 * `when*()` built on it -- `whenContains`, `whenContainsAll`, `whenEmpty`,
 * `whenNotEmpty`, `whenEndsWith`, `whenDoesntEndWith`, `whenExactly`,
 * `whenNotExactly`, `whenIs`, `whenIsAscii`, `whenIsUuid`, `whenIsUlid`,
 * `whenTest`, `whenStartsWith`, `whenDoesntStartWith`).
 *
 * Every callback here returns a `Stringable` (via chained methods, or by
 * wrapping a plain string with `Str.of()`), matching `WhenCallback`'s
 * signature (`(target, value) => TReturn | undefined`).
 */
export = (): void => {
    describe('Stringable conditionals', () => {
        it('unless() invokes the callback when the condition is falsy', () => {
            // PHP: SupportStringableTest::testUnless / testUnlessTruthy /
            // testUnlessFalsy
            expect(
                Str.of('unless')
                    .unless(false, (target) => target.append(' false'))
                    .toString(),
            ).to.equal('unless false');

            expect(
                Str.of('unless')
                    .unless(
                        true,
                        (target, value) => target.append(tostring(value)),
                        (target) => target.append(' true fallbacks to default'),
                    )
                    .toString(),
            ).to.equal('unless true fallbacks to default');

            expect(
                Str.of('unless ')
                    .unless(0, (target, value) => target.append(tostring(value)))
                    .toString(),
            ).to.equal('unless 0');
        });

        it('when() invokes the callback when the condition is truthy', () => {
            // PHP: SupportStringableTest::testWhenFalse / testWhenTrue
            expect(
                Str.of('when')
                    .when(false, (target, value) => target.append(tostring(value)).append('false'))
                    .toString(),
            ).to.equal('when');

            expect(
                Str.of('when ')
                    .when(true, (target) => target.append('true'))
                    .toString(),
            ).to.equal('when true');
        });

        it('whenContains()/whenContainsAll() branch on substring presence', () => {
            // PHP: SupportStringableTest::testWhenContains / testWhenContainsAll
            expect(
                Str.of('stark')
                    .whenContains('tar', (target) => target.prepend('Tony ').title())
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('stark')
                    .whenContains('xxx', (target) => target.prepend('Tony ').title())
                    .toString(),
            ).to.equal('stark');

            expect(
                Str.of('stark')
                    .whenContains(
                        'xxx',
                        (target) => target.prepend('Tony ').title(),
                        (target) => target.prepend('Arno ').title(),
                    )
                    .toString(),
            ).to.equal('Arno Stark');

            expect(
                Str.of('tony stark')
                    .whenContainsAll([
                        'tony',
                        'stark',
                    ], (target) => target.title())
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('tony stark')
                    .whenContainsAll(
                        [
                            'tony',
                            'xxx',
                        ],
                        (target) => target.title(),
                        (target) => target.studly(),
                    )
                    .toString(),
            ).to.equal('TonyStark');
        });

        it('whenEndsWith()/whenDoesntEndWith() branch on the suffix', () => {
            // PHP: SupportStringableTest::testWhenEndsWith / testWhenDoesntEndWith
            expect(
                Str.of('tony stark')
                    .whenEndsWith(
                        'ark',
                        (target) => target.title(),
                        (target) => target.studly(),
                    )
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('tony stark')
                    .whenEndsWith(
                        [
                            'kra',
                            'ark',
                        ],
                        (target) => target.title(),
                        (target) => target.studly(),
                    )
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('tony stark')
                    .whenEndsWith(['xxx'], (target) => target.title())
                    .toString(),
            ).to.equal('tony stark');

            expect(
                Str.of('tony stark')
                    .whenDoesntEndWith(
                        'ark',
                        (target) => target.studly(),
                        (target) => target.title(),
                    )
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('tony stark')
                    .whenDoesntEndWith(['xxx'], (target) => target)
                    .toString(),
            ).to.equal('tony stark');
        });

        it('whenExactly()/whenNotExactly() branch on an exact match', () => {
            // PHP: SupportStringableTest::testWhenExactly / testWhenNotExactly
            expect(
                Str.of('Tony Stark').whenExactly(
                    'Tony Stark',
                    () => 'Nailed it...!',
                    () => 'Swing and a miss...!',
                ),
            ).to.equal('Nailed it...!');

            expect(
                Str.of('Tony Stark').whenExactly(
                    'Iron Man',
                    () => 'Nailed it...!',
                    () => 'Swing and a miss...!',
                ),
            ).to.equal('Swing and a miss...!');

            expect(
                (Str.of('Tony Stark').whenExactly('Iron Man', () => 'Nailed it...!') as Stringable).toString(),
            ).to.equal('Tony Stark');

            expect(Str.of('Tony').whenNotExactly('Tony Stark', () => 'Iron Man')).to.equal('Iron Man');

            expect(
                Str.of('Tony Stark').whenNotExactly(
                    'Tony Stark',
                    () => 'Iron Man',
                    () => 'Swing and a miss...!',
                ),
            ).to.equal('Swing and a miss...!');
        });

        it('whenIs() branches on a wildcard pattern match', () => {
            // PHP: SupportStringableTest::testWhenIs
            expect(
                Str.of('/')
                    .whenIs(
                        '/',
                        (target) => target.prepend('Winner: '),
                        () => Str.of('Try again'),
                    )
                    .toString(),
            ).to.equal('Winner: /');

            expect(
                Str.of('/')
                    .whenIs(' /', (target) => target.prepend('Winner: '))
                    .toString(),
            ).to.equal('/');

            expect(
                Str.of('/')
                    .whenIs(
                        ' /',
                        (target) => target.prepend('Winner: '),
                        () => Str.of('Try again'),
                    )
                    .toString(),
            ).to.equal('Try again');

            expect(
                Str.of('foo/bar/baz')
                    .whenIs('foo/*', (target) => target.prepend('Winner: '))
                    .toString(),
            ).to.equal('Winner: foo/bar/baz');
        });

        it("whenIsAscii()/whenIsUuid()/whenIsUlid() branch on the string's shape", () => {
            // PHP: SupportStringableTest::testWhenIsAscii / testWhenIsUuid /
            // testWhenIsUlid
            expect(
                Str.of('A')
                    .whenIsAscii(
                        (target) => target.prepend('Ascii: '),
                        (target) => target.prepend('Not Ascii: '),
                    )
                    .toString(),
            ).to.equal('Ascii: A');

            expect(
                Str.of('ù')
                    .whenIsAscii((target) => target.prepend('Ascii: '))
                    .toString(),
            ).to.equal('ù');

            expect(
                Str.of('ù')
                    .whenIsAscii(
                        (target) => target.prepend('Ascii: '),
                        (target) => target.prepend('Not Ascii: '),
                    )
                    .toString(),
            ).to.equal('Not Ascii: ù');

            expect(
                Str.of('2cdc7039-65a6-4ac7-8e5d-d554a98e7b15')
                    .whenIsUuid(
                        (target) => target.prepend('Uuid: '),
                        (target) => target.prepend('Not Uuid: '),
                    )
                    .toString(),
            ).to.equal('Uuid: 2cdc7039-65a6-4ac7-8e5d-d554a98e7b15');

            expect(
                Str.of('2cdc7039-65a6-4ac7-8e5d-d554a98')
                    .whenIsUuid(
                        (target) => target.prepend('Uuid: '),
                        (target) => target.prepend('Not Uuid: '),
                    )
                    .toString(),
            ).to.equal('Not Uuid: 2cdc7039-65a6-4ac7-8e5d-d554a98');

            expect(
                Str.of('01GJSNW9MAF792C0XYY8RX6QFT')
                    .whenIsUlid(
                        (target) => target.prepend('Ulid: '),
                        (target) => target.prepend('Not Ulid: '),
                    )
                    .toString(),
            ).to.equal('Ulid: 01GJSNW9MAF792C0XYY8RX6QFT');

            expect(
                Str.of('ss-01GJSNW9MAF792C0XYY8RX6QFT')
                    .whenIsUlid(
                        (target) => target.prepend('Ulid: '),
                        (target) => target.prepend('Not Ulid: '),
                    )
                    .toString(),
            ).to.equal('Not Ulid: ss-01GJSNW9MAF792C0XYY8RX6QFT');
        });

        it('whenTest() branches on a Luau pattern match', () => {
            // PHP: SupportStringableTest::testWhenTest (adapted to Luau
            // patterns)
            expect(
                Str.of('foo bar')
                    .whenTest(
                        'bar',
                        (target) => target.prepend('Winner: '),
                        () => Str.of('Try again'),
                    )
                    .toString(),
            ).to.equal('Winner: foo bar');

            expect(
                Str.of('foo bar')
                    .whenTest(
                        'link',
                        (target) => target.prepend('Winner: '),
                        () => Str.of('Try again'),
                    )
                    .toString(),
            ).to.equal('Try again');

            expect(
                Str.of('foo bar')
                    .whenTest('link', (target) => target.prepend('Winner: '))
                    .toString(),
            ).to.equal('foo bar');
        });

        it('whenStartsWith()/whenDoesntStartWith() branch on the prefix', () => {
            // PHP: SupportStringableTest::testWhenStartsWith / testWhenDoesntStartWith
            expect(
                Str.of('tony stark')
                    .whenStartsWith(
                        'ton',
                        (target) => target.title(),
                        (target) => target.studly(),
                    )
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('tony stark')
                    .whenStartsWith(['xxx'], (target) => target.title())
                    .toString(),
            ).to.equal('tony stark');

            expect(
                Str.of('tony stark')
                    .whenDoesntStartWith(
                        'ton',
                        (target) => target.studly(),
                        (target) => target.title(),
                    )
                    .toString(),
            ).to.equal('Tony Stark');

            expect(
                Str.of('tony stark')
                    .whenDoesntStartWith(['xxx'], (target) => target)
                    .toString(),
            ).to.equal('tony stark');
        });

        it('whenEmpty()/whenNotEmpty() branch on emptiness', () => {
            // PHP: SupportStringableTest::testWhenEmpty / testWhenNotEmpty
            const untouched = Str.of('');

            expect(untouched.whenEmpty<Stringable>(() => undefined)).to.equal(untouched);

            expect(Str.of('').whenEmpty(() => 'empty')).to.equal('empty');
            expect((Str.of('not-empty').whenEmpty(() => 'empty') as Stringable).toString()).to.equal('not-empty');

            const untouchedNotEmpty = Str.of('');

            expect(untouchedNotEmpty.whenNotEmpty<Stringable>(() => undefined)).to.equal(untouchedNotEmpty);

            expect(
                Str.of('Not empty')
                    .whenNotEmpty((target) => target.append('.'))
                    .toString(),
            ).to.equal('Not empty.');
        });
    });
};
