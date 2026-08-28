/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (searching methods:
 * `position`, `contains`, `containsAll`, `doesntContain`, `startsWith`,
 * `doesntStartWith`, `endsWith`, `doesntEndWith`, `substrCount`).
 *
 * Two systematic adaptations apply throughout this file, both a consequence
 * of this port's methods being typed `string | Array<string>` rather than
 * PHP's untyped parameters:
 *
 * - PHP's implicit int/float-to-string casting (`Str::startsWith('7a', 7)`)
 *   is not reproduced; such cases use the literal string the cast would have
 *   produced (`Str.startsWith("7a", "7")`) -- the scenario under test
 *   (numeric-looking substrings) survives, only the cast itself is gone.
 * - `null` needles/haystacks and `collect([...])` needle arrays have no
 *   counterpart (no `null`, no implicit `Collection`-to-array unwrap) and are
 *   dropped; a `collect([...])` case never exercised anything beyond the
 *   plain-array case already covered.
 */
export = (): void => {
    describe("Str searching", () => {
        it("position() finds the first character offset of a substring", () => {
            // PHP: SupportStrTest::testPosition (encoding argument dropped, see Slicing.spec.ts)
            expect(Str.position("Hello, World!", "W")).to.equal(7);
            expect(Str.position("This is a test string.", "test")).to.equal(10);
            expect(Str.position("This is a test string, test again.", "test", 15)).to.equal(23);
            expect(Str.position("Hello, World!", "Hello")).to.equal(0);
            expect(Str.position("Hello, World!", "World!")).to.equal(7);
            expect(Str.position("Hello, World!", "W", -6)).to.equal(7);
            expect(Str.position('@%€/=!"][$', "$", 0)).to.equal(9);
            expect(Str.position("Hello, World!", "w", 0)).to.equal(undefined);
            expect(Str.position("Hello, World!", "X", 0)).to.equal(undefined);
            expect(Str.position("", "test")).to.equal(undefined);
            expect(Str.position("Hello, World!", "X")).to.equal(undefined);
        });

        it("startsWith() checks a haystack for one or more prefixes", () => {
            // PHP: SupportStrTest::testStartsWith
            expect(Str.startsWith("jason", "jas")).to.equal(true);
            expect(Str.startsWith("jason", "jason")).to.equal(true);
            expect(Str.startsWith("jason", ["jas"])).to.equal(true);
            expect(Str.startsWith("jason", ["day", "jas"])).to.equal(true);
            expect(Str.startsWith("jason", "day")).to.equal(false);
            expect(Str.startsWith("jason", ["day"])).to.equal(false);
            expect(Str.startsWith("0123", "0")).to.equal(true);
            expect(Str.startsWith("jason", "J")).to.equal(false);
            expect(Str.startsWith("jason", "")).to.equal(false);
            expect(Str.startsWith("", "")).to.equal(false);
            expect(Str.startsWith("7", " 7")).to.equal(false);
            expect(Str.startsWith("7a", "7")).to.equal(true);
            expect(Str.startsWith("7.12a", "7.12")).to.equal(true);
            expect(Str.startsWith("7.12a", "7.13")).to.equal(false);
            expect(Str.startsWith("7.123", "7")).to.equal(true);
            expect(Str.startsWith("7.123", "7.12")).to.equal(true);
            expect(Str.startsWith("7.123", "7.13")).to.equal(false);
            // Multibyte string support
            expect(Str.startsWith("Jönköping", "Jö")).to.equal(true);
            expect(Str.startsWith("Malmö", "Malmö")).to.equal(true);
            expect(Str.startsWith("Jönköping", "Jonko")).to.equal(false);
            expect(Str.startsWith("Malmö", "Malmo")).to.equal(false);
            expect(Str.startsWith("你好", "你")).to.equal(true);
            expect(Str.startsWith("你好", "好")).to.equal(false);
            expect(Str.startsWith("你好", "a")).to.equal(false);
        });

        it("doesntStartWith() is the negation of startsWith()", () => {
            // PHP: SupportStrTest::testDoesntStartWith
            expect(Str.doesntStartWith("jason", "jas")).to.equal(false);
            expect(Str.doesntStartWith("jason", "jason")).to.equal(false);
            expect(Str.doesntStartWith("jason", ["jas"])).to.equal(false);
            expect(Str.doesntStartWith("jason", ["day", "jas"])).to.equal(false);
            expect(Str.doesntStartWith("jason", "day")).to.equal(true);
            expect(Str.doesntStartWith("jason", ["day"])).to.equal(true);
            expect(Str.doesntStartWith("0123", "0")).to.equal(false);
            expect(Str.doesntStartWith("jason", "J")).to.equal(true);
            expect(Str.doesntStartWith("jason", "")).to.equal(true);
            expect(Str.doesntStartWith("", "")).to.equal(true);
            expect(Str.doesntStartWith("7", " 7")).to.equal(true);
            expect(Str.doesntStartWith("7a", "7")).to.equal(false);
            expect(Str.doesntStartWith("7.12a", "7.12")).to.equal(false);
            expect(Str.doesntStartWith("7.12a", "7.13")).to.equal(true);
            expect(Str.doesntStartWith("7.123", "7")).to.equal(false);
            expect(Str.doesntStartWith("7.123", "7.12")).to.equal(false);
            expect(Str.doesntStartWith("7.123", "7.13")).to.equal(true);
            // Multibyte string support
            expect(Str.doesntStartWith("Jönköping", "Jö")).to.equal(false);
            expect(Str.doesntStartWith("Malmö", "Malmö")).to.equal(false);
            expect(Str.doesntStartWith("Jönköping", "Jonko")).to.equal(true);
            expect(Str.doesntStartWith("Malmö", "Malmo")).to.equal(true);
            expect(Str.doesntStartWith("你好", "你")).to.equal(false);
            expect(Str.doesntStartWith("你好", "好")).to.equal(true);
            expect(Str.doesntStartWith("你好", "a")).to.equal(true);
        });

        it("endsWith() checks a haystack for one or more suffixes", () => {
            // PHP: SupportStrTest::testEndsWith
            expect(Str.endsWith("jason", "on")).to.equal(true);
            expect(Str.endsWith("jason", "jason")).to.equal(true);
            expect(Str.endsWith("jason", ["on"])).to.equal(true);
            expect(Str.endsWith("jason", ["no", "on"])).to.equal(true);
            expect(Str.endsWith("jason", "no")).to.equal(false);
            expect(Str.endsWith("jason", ["no"])).to.equal(false);
            expect(Str.endsWith("jason", "")).to.equal(false);
            expect(Str.endsWith("", "")).to.equal(false);
            expect(Str.endsWith("jason", "N")).to.equal(false);
            expect(Str.endsWith("7", " 7")).to.equal(false);
            expect(Str.endsWith("a7", "7")).to.equal(true);
            expect(Str.endsWith("a7.12", "7.12")).to.equal(true);
            expect(Str.endsWith("a7.12", "7.13")).to.equal(false);
            expect(Str.endsWith("0.27", "7")).to.equal(true);
            expect(Str.endsWith("0.27", "0.27")).to.equal(true);
            expect(Str.endsWith("0.27", "8")).to.equal(false);
            // Multibyte string support
            expect(Str.endsWith("Jönköping", "öping")).to.equal(true);
            expect(Str.endsWith("Malmö", "mö")).to.equal(true);
            expect(Str.endsWith("Jönköping", "oping")).to.equal(false);
            expect(Str.endsWith("Malmö", "mo")).to.equal(false);
            expect(Str.endsWith("你好", "好")).to.equal(true);
            expect(Str.endsWith("你好", "你")).to.equal(false);
            expect(Str.endsWith("你好", "a")).to.equal(false);
        });

        it("doesntEndWith() is the negation of endsWith()", () => {
            // PHP: SupportStrTest::testDoesntEndWith
            expect(Str.doesntEndWith("jason", "on")).to.equal(false);
            expect(Str.doesntEndWith("jason", "jason")).to.equal(false);
            expect(Str.doesntEndWith("jason", ["on"])).to.equal(false);
            expect(Str.doesntEndWith("jason", ["no", "on"])).to.equal(false);
            expect(Str.doesntEndWith("jason", "no")).to.equal(true);
            expect(Str.doesntEndWith("jason", ["no"])).to.equal(true);
            expect(Str.doesntEndWith("jason", "")).to.equal(true);
            expect(Str.doesntEndWith("", "")).to.equal(true);
            expect(Str.doesntEndWith("jason", "N")).to.equal(true);
            expect(Str.doesntEndWith("7", " 7")).to.equal(true);
            expect(Str.doesntEndWith("a7", "7")).to.equal(false);
            expect(Str.doesntEndWith("a7.12", "7.12")).to.equal(false);
            expect(Str.doesntEndWith("a7.12", "7.13")).to.equal(true);
            expect(Str.doesntEndWith("0.27", "7")).to.equal(false);
            expect(Str.doesntEndWith("0.27", "0.27")).to.equal(false);
            expect(Str.doesntEndWith("0.27", "8")).to.equal(true);
            // Multibyte string support
            expect(Str.doesntEndWith("Jönköping", "öping")).to.equal(false);
            expect(Str.doesntEndWith("Malmö", "mö")).to.equal(false);
            expect(Str.doesntEndWith("Jönköping", "oping")).to.equal(true);
            expect(Str.doesntEndWith("Malmö", "mo")).to.equal(true);
            expect(Str.doesntEndWith("你好", "好")).to.equal(false);
            expect(Str.doesntEndWith("你好", "你")).to.equal(true);
            expect(Str.doesntEndWith("你好", "a")).to.equal(true);
        });

        it("contains() checks a haystack for one or more needles", () => {
            // PHP: SupportStrTest::testStrContains / strContainsProvider
            const cases: Array<[string, string | Array<string>, boolean, boolean?]> = [
                ["Taylor", "ylo", true, true],
                ["Taylor", "ylo", true, false],
                ["Taylor", "taylor", true, true],
                ["Taylor", "taylor", false, false],
                ["Taylor", ["ylo"], true, true],
                ["Taylor", ["ylo"], true, false],
                ["Taylor", ["xxx", "ylo"], true, true],
                ["Taylor", ["xxx", "ylo"], true, false],
                ["Taylor", "xxx", false],
                ["Taylor", ["xxx"], false],
                ["Taylor", "", false],
                ["", "", false],
            ];

            for (const [haystack, needles, expected, ignoreCase] of cases) {
                expect(Str.contains(haystack, needles, ignoreCase ?? false)).to.equal(expected);
            }
        });

        it("containsAll() checks a haystack for every needle", () => {
            // PHP: SupportStrTest::testStrContainsAll / strContainsAllProvider
            const cases: Array<[string, Array<string>, boolean, boolean]> = [
                ["Taylor Otwell", ["taylor", "otwell"], false, false],
                ["Taylor Otwell", ["taylor", "otwell"], true, true],
                ["Taylor Otwell", ["taylor"], false, false],
                ["Taylor Otwell", ["taylor"], true, true],
                ["Taylor Otwell", ["taylor", "xxx"], false, false],
                ["Taylor Otwell", ["taylor", "xxx"], false, true],
                ["Taylor Otwell", [], false, false],
            ];

            for (const [haystack, needles, expected, ignoreCase] of cases) {
                expect(Str.containsAll(haystack, needles, ignoreCase)).to.equal(expected);
            }
        });

        it("doesntContain() is the negation of contains()", () => {
            // PHP: SupportStrTest::testStrDoesntContain / strDoesntContainProvider
            expect(Str.doesntContain("Tar", "ylo", true)).to.equal(true);
        });

        it("substrCount() counts substring occurrences", () => {
            // PHP: SupportStrTest::testSubstrCount (offset/length arguments not
            // ported -- Str.substrCount() takes only haystack and needle, see
            // class comment)
            expect(Str.substrCount("laravelPHPFramework", "a")).to.equal(3);
            expect(Str.substrCount("laravelPHPFramework", "z")).to.equal(0);
        });
    });
};
