/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (wrapping and
 * padding methods: `start`, `finish`, `wrap`, `unwrap`, `padBoth`,
 * `padLeft`, `padRight`, `mask`, `repeat`).
 *
 * `Stringable::mask()`'s PHP `$encoding` argument has no counterpart, same
 * as `Str::mask()` (see `Str/WrappingAndPadding.spec.ts`'s class comment).
 */
export = (): void => {
    describe("Stringable wrapping and padding", () => {
        it("start()/finish() ensure a single leading/trailing instance", () => {
            // PHP: SupportStringableTest::testStart / testFinish
            expect(Str.of("test/string").start("/").toString()).to.equal(
                "/test/string",
            );
            expect(Str.of("/test/string").start("/").toString()).to.equal(
                "/test/string",
            );
            expect(Str.of("//test/string").start("/").toString()).to.equal(
                "/test/string",
            );

            expect(Str.of("ab").finish("bc").toString()).to.equal("abbc");
            expect(Str.of("abbcbc").finish("bc").toString()).to.equal("abbc");
            expect(Str.of("abcbbcbc").finish("bc").toString()).to.equal(
                "abcbbc",
            );
        });

        it("wrap()/unwrap() wrap and unwrap a string with delimiters", () => {
            // PHP: SupportStringableTest::testWrap / testUnwrap
            expect(Str.of("is").wrap("This ", " me!").toString()).to.equal(
                "This is me!",
            );
            expect(Str.of("value").wrap('"').toString()).to.equal('"value"');

            expect(Str.of('"value"').unwrap('"').toString()).to.equal("value");
            expect(
                Str.of("foo-bar-baz").unwrap("foo-", "-baz").toString(),
            ).to.equal("bar");
            expect(
                Str.of('{some: "json"}').unwrap("{", "}").toString(),
            ).to.equal('some: "json"');
        });

        it("padBoth()/padLeft()/padRight() pad a string", () => {
            // PHP: SupportStringableTest::testPadBoth / testPadLeft /
            // testPadRight
            expect(Str.of("Alien").padBoth(10, "_").toString()).to.equal(
                "__Alien___",
            );
            expect(Str.of("Alien").padBoth(10).toString()).to.equal(
                "  Alien   ",
            );
            expect(Str.of("❤MultiByte☆").padBoth(16).toString()).to.equal(
                "  ❤MultiByte☆   ",
            );

            expect(Str.of("Alien").padLeft(10, "-=").toString()).to.equal(
                "-=-=-Alien",
            );
            expect(Str.of("Alien").padLeft(10).toString()).to.equal(
                "     Alien",
            );
            expect(Str.of("❤MultiByte☆").padLeft(16).toString()).to.equal(
                "     ❤MultiByte☆",
            );

            expect(Str.of("Alien").padRight(10, "-").toString()).to.equal(
                "Alien-----",
            );
            expect(Str.of("Alien").padRight(10).toString()).to.equal(
                "Alien     ",
            );
            expect(Str.of("❤MultiByte☆").padRight(16).toString()).to.equal(
                "❤MultiByte☆     ",
            );
        });

        it("mask() masks a portion of the string", () => {
            // PHP: SupportStringableTest::testMask
            expect(Str.of("taylor@email.com").mask("*", 3).toString()).to.equal(
                "tay*************",
            );
            expect(
                Str.of("taylor@email.com").mask("*", 0, 6).toString(),
            ).to.equal("******@email.com");
            expect(
                Str.of("taylor@email.com").mask("*", -13).toString(),
            ).to.equal("tay*************");
            expect(
                Str.of("taylor@email.com").mask("*", -13, 3).toString(),
            ).to.equal("tay***@email.com");
            expect(
                Str.of("taylor@email.com").mask("*", -17).toString(),
            ).to.equal("****************");
            expect(
                Str.of("taylor@email.com").mask("*", -99, 5).toString(),
            ).to.equal("*****r@email.com");
            expect(
                Str.of("taylor@email.com").mask("*", 16).toString(),
            ).to.equal("taylor@email.com");
            expect(
                Str.of("taylor@email.com").mask("*", 16, 99).toString(),
            ).to.equal("taylor@email.com");
            expect(Str.of("taylor@email.com").mask("", 3).toString()).to.equal(
                "taylor@email.com",
            );
            expect(
                Str.of("taylor@email.com").mask("something", 3).toString(),
            ).to.equal("taysssssssssssss");
            expect(Str.of("这是一段中文").mask("*", 3).toString()).to.equal(
                "这是一***",
            );
            expect(Str.of("这是一段中文").mask("*", 0, 2).toString()).to.equal(
                "**一段中文",
            );
        });

        it("repeat() repeats the string", () => {
            // PHP: SupportStringableTest::testRepeat
            expect(Str.of("a").repeat(5).toString()).to.equal("aaaaa");
            expect(Str.of("").repeat(5).toString()).to.equal("");
        });
    });
};
