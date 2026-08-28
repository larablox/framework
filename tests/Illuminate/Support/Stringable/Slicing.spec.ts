/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (slicing methods:
 * `take`, `charAt`, `substr`, `reverse`, `length`, `substrReplace`).
 *
 * `Stringable::length()`'s PHP `$encoding` argument (`->length('UTF-8')`) has
 * no counterpart -- this port's `length()` always works codepoint-aware
 * through `utf8`, see `Str/Slicing.spec.ts`'s class comment.
 */
export = (): void => {
    describe("Stringable slicing", () => {
        it("take() takes the first or last N characters", () => {
            // PHP: SupportStringableTest::testTake
            expect(Str.of("abcdef").take(2).toString()).to.equal("ab");
            expect(Str.of("abcdef").take(-2).toString()).to.equal("ef");
        });

        it("charAt() returns the codepoint at an index, undefined out of range", () => {
            // PHP: SupportStringableTest::testCharAt
            expect(Str.of("Привет, мир!").charAt(1)).to.equal("р");
            expect(Str.of("「こんにちは世界」").charAt(4)).to.equal("ち");
            expect(Str.of("Привет, world!").charAt(8)).to.equal("w");
            expect(Str.of("「こんにちは世界」").charAt(-2)).to.equal("界");
            expect(Str.of("「こんにちは世界」").charAt(-200)).to.equal(undefined);
            expect(Str.of("Привет, мир!").charAt(100)).to.equal(undefined);
        });

        it("substr() slices by codepoint, PHP mb_substr semantics", () => {
            // PHP: SupportStringableTest::testSubstr
            expect(Str.of("БГДЖИЛЁ").substr(-1).toString()).to.equal("Ё");
            expect(Str.of("БГДЖИЛЁ").substr(-2).toString()).to.equal("ЛЁ");
            expect(Str.of("БГДЖИЛЁ").substr(-3, 1).toString()).to.equal("И");
            expect(Str.of("БГДЖИЛЁ").substr(2, -1).toString()).to.equal("ДЖИЛ");
            expect(Str.of("БГДЖИЛЁ").substr(4, -4).toString()).to.equal("");
            expect(Str.of("БГДЖИЛЁ").substr(-3, -1).toString()).to.equal("ИЛ");
            expect(Str.of("БГДЖИЛЁ").substr(1).toString()).to.equal("ГДЖИЛЁ");
            expect(Str.of("БГДЖИЛЁ").substr(1, 3).toString()).to.equal("ГДЖ");
            expect(Str.of("БГДЖИЛЁ").substr(0, 4).toString()).to.equal("БГДЖ");
            expect(Str.of("БГДЖИЛЁ").substr(-1, 1).toString()).to.equal("Ё");
            expect(Str.of("Б").substr(2).toString()).to.equal("");
        });

        it("reverse() reverses by codepoint", () => {
            // PHP: SupportStringableTest::testReverse
            expect(Str.of("raBooF").reverse().toString()).to.equal("FooBar");
            expect(Str.of("őtüzsineT").reverse().toString()).to.equal("Teniszütő");
            expect(Str.of("☆etyBitluM❤").reverse().toString()).to.equal("❤MultiByte☆");
        });

        it("length() counts codepoints", () => {
            // PHP: SupportStringableTest::testLength (encoding argument
            // dropped, see class comment)
            expect(Str.of("foo bar baz").length()).to.equal(11);
        });

        it("substrReplace() replaces text within a portion of the string", () => {
            // PHP: SupportStringableTest::testSubstrReplace
            expect(Str.of("1200").substrReplace(":", 2, 0).toString()).to.equal("12:00");
            expect(Str.of("The Framework").substrReplace("Laravel ", 4, 0).toString()).to.equal(
                "The Laravel Framework",
            );
            expect(
                Str.of("Laravel Framework").substrReplace("– The PHP Framework for Web Artisans", 8).toString(),
            ).to.equal("Laravel – The PHP Framework for Web Artisans");
        });
    });
};
