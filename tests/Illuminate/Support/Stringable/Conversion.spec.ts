/// <reference types="@rbxts/testez/globals" />
import { Str, Stringable } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (conversion,
 * inflection and encoding methods: `value`, `toString`, `toInteger`,
 * `toFloat`, `toBoolean`, `jsonSerialize`, `tap`, `pipe`, `parseCallback`,
 * `slug`, `ascii`, `newLine`, `toBase64`, `fromBase64`, `pluralStudly`,
 * `pluralPascal`).
 *
 * `Stringable::toInteger()`/`Stringable::toFloat()`'s PHP tests include
 * cases that only work because PHP's numeric cast reads leading digits and
 * stops (`'1ab'` -> `1`, `'2_000'` -> `2`, `'1.ab'` -> `1.0`); this port's
 * `toInteger()`/`toFloat()` use `tonumber()`, which requires the *whole*
 * string to be numeric and returns `undefined` (folded to `0`) otherwise --
 * documented as a deliberate divergence on `Stringable.toInteger()` in
 * `Str.ts`. Those specific cases are dropped; every case where the whole
 * string is numeric is portable and kept, including `'1e3'` and `'.6'`,
 * which `tonumber()` also parses.
 *
 * `Stringable(true)->toBoolean()`'s PHP case passes a raw `bool` to the
 * constructor; this port's constructor is typed `string | number |
 * Stringable`, so that one case is dropped -- every string-value case is
 * kept.
 *
 * `Stringable::slug()`'s PHP test exercises a `$language` parameter this
 * port doesn't have (see `Str/Remaining.spec.ts`'s class comment on
 * `Str::slug()`); the case built around it (`->slug('-', null)`) is dropped.
 * `Stringable::ascii('bg')`/`ascii('de')` (`testAsciiWithSpecificLocale`)
 * and `Stringable::transliterate()` (`testTransliterate`, no CommonMark-free
 * counterpart) aren't ported for the same reason `Str::ascii()` doesn't take
 * a locale.
 */
export = (): void => {
    describe("Stringable conversion, inflection and encoding", () => {
        it("value()/toString() return the underlying string", () => {
            // PHP: SupportStringableTest::testGet
            expect(Str.of("foo").value()).to.equal("foo");
            expect(Str.of("foo").toString()).to.equal("foo");
        });

        it("toInteger() parses a fully-numeric string", () => {
            // PHP: SupportStringableTest::testToInteger (partial-numeric
            // cases dropped, see class comment)
            expect(Str.of("123").toInteger()).to.equal(123);
            expect(Str.of(456).toInteger()).to.equal(456);
            expect(Str.of("078").toInteger()).to.equal(78);
            expect(Str.of(" 901").toInteger()).to.equal(901);
            expect(Str.of("nan").toInteger()).to.equal(0);
        });

        it("toFloat() parses a fully-numeric string", () => {
            // PHP: SupportStringableTest::testToFloat (partial-numeric cases
            // dropped, see class comment)
            expect(Str.of("1.23").toFloat()).to.equal(1.23);
            expect(Str.of(45.6).toFloat()).to.equal(45.6);
            expect(Str.of(".6").toFloat()).to.equal(0.6);
            expect(Str.of("0.78").toFloat()).to.equal(0.78);
            expect(Str.of(" 90.1").toFloat()).to.equal(90.1);
            expect(Str.of("nan").toFloat()).to.equal(0);
            expect(Str.of("1e3").toFloat()).to.equal(1e3);
        });

        it("toBoolean() reads PHP's FILTER_VALIDATE_BOOLEAN truthy strings", () => {
            // PHP: SupportStringableTest::testBooleanMethod (raw-`bool`
            // constructor case dropped, see class comment)
            expect(Str.of("true").toBoolean()).to.equal(true);
            expect(Str.of("false").toBoolean()).to.equal(false);
            expect(Str.of("1").toBoolean()).to.equal(true);
            expect(Str.of("0").toBoolean()).to.equal(false);
            expect(Str.of("on").toBoolean()).to.equal(true);
            expect(Str.of("off").toBoolean()).to.equal(false);
            expect(Str.of("yes").toBoolean()).to.equal(true);
            expect(Str.of("no").toBoolean()).to.equal(false);
        });

        it("jsonSerialize() serializes the underlying string", () => {
            // PHP: SupportStringableTest::testJsonSerialize (adapted --
            // `jsonSerialize()`'s contract, not a full `json_encode()` round
            // trip through Roblox's HttpService, is what's under test)
            expect(Str.of("foo").jsonSerialize()).to.equal("foo");
            expect(Str.of("LaravelPhpFramework").kebab().jsonSerialize()).to.equal("laravel-php-framework");
        });

        it("tap() passes the instance to a callback and returns it unchanged", () => {
            // PHP: SupportStringableTest::testTap
            let fromTheTap = "";

            const stringable = Str.of("foobarbaz").tap((value) => {
                fromTheTap = value.substr(0, 3).toString();
            });

            expect(fromTheTap).to.equal("foo");
            expect(stringable.toString()).to.equal("foobarbaz");
        });

        it("pipe() passes the instance to a callback and wraps the result", () => {
            // PHP: SupportStringableTest::testPipe
            const result = Str.of("foo").pipe(() => "bar");

            expect(result instanceof Stringable).to.equal(true);
            expect(result.toString()).to.equal("bar");
        });

        it("parseCallback() splits a Class@method style callback", () => {
            // PHP: SupportStringableTest::testParseCallback
            const [klass, method] = Str.of("Class@method").parseCallback("foo");

            expect(klass).to.equal("Class");
            expect(method).to.equal("method");

            const [klass2, method2] = Str.of("Class").parseCallback("foo");

            expect(klass2).to.equal("Class");
            expect(method2).to.equal("foo");

            const [klass3, method3] = Str.of("Class").parseCallback();

            expect(klass3).to.equal("Class");
            expect(method3).to.equal(undefined);
        });

        it("slug() builds a URL friendly slug", () => {
            // PHP: SupportStringableTest::testSlug (language parameter
            // dropped, see class comment)
            expect(Str.of("hello world").slug().toString()).to.equal("hello-world");
            expect(Str.of("hello-world").slug().toString()).to.equal("hello-world");
            expect(Str.of("hello_world").slug().toString()).to.equal("hello-world");
            expect(Str.of("hello_world").slug("_").toString()).to.equal("hello_world");
            expect(Str.of("user@host").slug().toString()).to.equal("user-at-host");
            expect(Str.of("some text").slug("").toString()).to.equal("sometext");
            expect(Str.of("").slug("").toString()).to.equal("");
            expect(Str.of("").slug().toString()).to.equal("");
        });

        it("ascii() transliterates through the reduced table", () => {
            // PHP: SupportStringableTest::testAscii
            expect(Str.of("@").ascii().toString()).to.equal("@");
            expect(Str.of("ü").ascii().toString()).to.equal("u");
        });

        it("newLine() appends a Roblox `\\n`", () => {
            // PHP: SupportStringableTest::testNewLine (PHP_EOL -> `\n`, see
            // `Stringable.newLine()`'s class comment)
            expect(Str.of("Laravel").newLine().toString()).to.equal("Laravel\n");
            expect(Str.of("foo").newLine(2).append("bar").toString()).to.equal("foo\n\nbar");
        });

        it("toBase64()/fromBase64() round-trip", () => {
            // PHP: SupportStringableTest::testToBase64 / testFromBase64
            expect(Str.of("foo").toBase64().toString()).to.equal("Zm9v");
            expect(Str.of("foobar").toBase64().toString()).to.equal("Zm9vYmFy");
            expect(Str.of("foobarbaz").toBase64().toString()).to.equal("Zm9vYmFyYmF6");

            expect(Str.of(Str.toBase64("foo")).fromBase64().toString()).to.equal("foo");
            expect(Str.of(Str.toBase64("foobar")).fromBase64().toString()).to.equal("foobar");
            expect(Str.of(Str.toBase64("foobarbaz")).fromBase64().toString()).to.equal("foobarbaz");
        });

        it("pluralStudly()/pluralPascal() pluralize the last word", () => {
            // PHP: SupportStringableTest::testPluralStudly / testPluralPascal
            expect(Str.of("LaraCon").pluralStudly(1).toString()).to.equal("LaraCon");
            expect(Str.of("LaraCon").pluralStudly(2).toString()).to.equal("LaraCons");
            expect(Str.of("LaraCon").pluralStudly(-1).toString()).to.equal("LaraCon");
            expect(Str.of("LaraCon").pluralStudly(-2).toString()).to.equal("LaraCons");

            expect(Str.of("LaraCon").pluralPascal(2).toString()).to.equal("LaraCons");
            expect(Str.of("LaraCon").pluralPascal(1).toString()).to.equal("LaraCon");
            expect(Str.of("LaraCon").pluralPascal(-2).toString()).to.equal("LaraCons");
            expect(Str.of("LaraCon").pluralPascal(-1).toString()).to.equal("LaraCon");
        });
    });
};
