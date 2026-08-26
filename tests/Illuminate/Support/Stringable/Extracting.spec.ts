/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (extracting methods:
 * `before`, `beforeLast`, `between`, `betweenFirst`, `after`, `afterLast`,
 * `excerpt`).
 *
 * As in `Str/Extracting.spec.ts`, PHP's implicit int-to-string casts
 * (`->before(0)`, `->after(2)`) are replaced with the literal string
 * equivalent the cast would have produced.
 *
 * `Stringable::excerpt()`'s PHP signature takes an `$options` array
 * (`['radius' => ...]`); this port's `excerpt()` takes `radius` and
 * `omission` as positional arguments (see `agent_docs/laravel-parity.md`),
 * so the one case is translated positionally.
 */
export = (): void => {
    describe("Stringable extracting", () => {
        it("before()/beforeLast() extract the portion before a value", () => {
            // PHP: SupportStringableTest::testBefore / testBeforeLast
            expect(Str.of("hannah").before("nah").toString()).to.equal("han");
            expect(Str.of("hannah").before("n").toString()).to.equal("ha");
            expect(Str.of("ééé hannah").before("han").toString()).to.equal(
                "ééé ",
            );
            expect(Str.of("hannah").before("xxxx").toString()).to.equal(
                "hannah",
            );
            expect(Str.of("hannah").before("").toString()).to.equal("hannah");
            expect(Str.of("han0nah").before("0").toString()).to.equal("han");
            expect(Str.of("han2nah").before("2").toString()).to.equal("han");

            expect(Str.of("yvette").beforeLast("tte").toString()).to.equal(
                "yve",
            );
            expect(Str.of("yvette").beforeLast("t").toString()).to.equal(
                "yvet",
            );
            expect(Str.of("ééé yvette").beforeLast("yve").toString()).to.equal(
                "ééé ",
            );
            expect(Str.of("yvette").beforeLast("yve").toString()).to.equal("");
            expect(Str.of("yvette").beforeLast("xxxx").toString()).to.equal(
                "yvette",
            );
            expect(Str.of("yvette").beforeLast("").toString()).to.equal(
                "yvette",
            );
            expect(Str.of("yv0et0te").beforeLast("0").toString()).to.equal(
                "yv0et",
            );
            expect(Str.of("yv2et2te").beforeLast("2").toString()).to.equal(
                "yv2et",
            );
        });

        it("between()/betweenFirst() extract the portion between two values", () => {
            // PHP: SupportStringableTest::testBetween / testBetweenFirst
            expect(Str.of("abc").between("", "c").toString()).to.equal("abc");
            expect(Str.of("abc").between("a", "").toString()).to.equal("abc");
            expect(Str.of("abc").between("", "").toString()).to.equal("abc");
            expect(Str.of("abc").between("a", "c").toString()).to.equal("b");
            expect(Str.of("dddabc").between("a", "c").toString()).to.equal("b");
            expect(Str.of("abcddd").between("a", "c").toString()).to.equal("b");
            expect(Str.of("dddabcddd").between("a", "c").toString()).to.equal(
                "b",
            );
            expect(Str.of("hannah").between("ha", "ah").toString()).to.equal(
                "nn",
            );
            expect(Str.of("[a]ab[b]").between("[", "]").toString()).to.equal(
                "a]ab[b",
            );
            expect(
                Str.of("foofoobar").between("foo", "bar").toString(),
            ).to.equal("foo");
            expect(
                Str.of("foobarbar").between("foo", "bar").toString(),
            ).to.equal("bar");

            expect(Str.of("abc").betweenFirst("", "c").toString()).to.equal(
                "abc",
            );
            expect(Str.of("abc").betweenFirst("a", "").toString()).to.equal(
                "abc",
            );
            expect(Str.of("abc").betweenFirst("a", "c").toString()).to.equal(
                "b",
            );
            expect(
                Str.of("hannah").betweenFirst("ha", "ah").toString(),
            ).to.equal("nn");
            expect(
                Str.of("[a]ab[b]").betweenFirst("[", "]").toString(),
            ).to.equal("a");
            expect(
                Str.of("foofoobar").betweenFirst("foo", "bar").toString(),
            ).to.equal("foo");
            expect(
                Str.of("foobarbar").betweenFirst("foo", "bar").toString(),
            ).to.equal("");
        });

        it("after()/afterLast() extract the portion after a value", () => {
            // PHP: SupportStringableTest::testAfter / testAfterLast
            expect(Str.of("hannah").after("han").toString()).to.equal("nah");
            expect(Str.of("hannah").after("n").toString()).to.equal("nah");
            expect(Str.of("ééé hannah").after("han").toString()).to.equal(
                "nah",
            );
            expect(Str.of("hannah").after("xxxx").toString()).to.equal(
                "hannah",
            );
            expect(Str.of("hannah").after("").toString()).to.equal("hannah");
            expect(Str.of("han0nah").after("0").toString()).to.equal("nah");
            expect(Str.of("han2nah").after("2").toString()).to.equal("nah");

            expect(Str.of("yvette").afterLast("yve").toString()).to.equal(
                "tte",
            );
            expect(Str.of("yvette").afterLast("t").toString()).to.equal("e");
            expect(Str.of("ééé yvette").afterLast("t").toString()).to.equal(
                "e",
            );
            expect(Str.of("yvette").afterLast("tte").toString()).to.equal("");
            expect(Str.of("yvette").afterLast("xxxx").toString()).to.equal(
                "yvette",
            );
            expect(Str.of("yvette").afterLast("").toString()).to.equal(
                "yvette",
            );
            expect(Str.of("yv0et0te").afterLast("0").toString()).to.equal("te");
            expect(Str.of("yv2et2te").afterLast("2").toString()).to.equal("te");
            expect(Str.of("----foo").afterLast("---").toString()).to.equal(
                "foo",
            );
        });

        it("excerpt() extracts a snippet around a phrase", () => {
            // PHP: SupportStringableTest::testExcerpt (options array ->
            // positional radius/omission)
            expect(
                Str.of("This is a beautiful morning").excerpt("beautiful", 5),
            ).to.equal("...is a beautiful morn...");
        });
    });
};
