/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (extracting methods:
 * `after`, `afterLast`, `before`, `beforeLast`, `between`, `betweenFirst`,
 * `excerpt`).
 *
 * As in `Searching.spec.ts`, PHP's implicit int-to-string casts
 * (`Str::after('han2nah', 2)`) are replaced by the literal string equivalent
 * (`Str.after("han2nah", "2")`); a case that only duplicates an
 * already-present string-literal case (`Str::before('han0nah', 0)` next to
 * the already-tested `'0'`) is dropped rather than repeated.
 *
 * `Str::excerpt()`'s PHP signature takes an `$options` array
 * (`['radius' => ..., 'omission' => ...]`); this port's `Str.excerpt()` takes
 * `radius` and `omission` as positional arguments instead (see
 * `agent_docs/laravel-parity.md`), so every case below is translated
 * positionally. `Str::excerpt(null)`/`Str::excerpt(null, '')` are not ported:
 * `text` is a required `string` here, there is no null overload. The
 * `strip_tags()` case is adapted by inlining the already-stripped literal,
 * since `strip_tags` itself is not what `excerpt()` tests.
 */
export = (): void => {
    describe("Str extracting", () => {
        it("after() returns the remainder after the first occurrence", () => {
            // PHP: SupportStrTest::testStrAfter
            expect(Str.after("hannah", "han")).to.equal("nah");
            expect(Str.after("hannah", "n")).to.equal("nah");
            expect(Str.after("ééé hannah", "han")).to.equal("nah");
            expect(Str.after("hannah", "xxxx")).to.equal("hannah");
            expect(Str.after("hannah", "")).to.equal("hannah");
            expect(Str.after("han0nah", "0")).to.equal("nah");
            expect(Str.after("han2nah", "2")).to.equal("nah");
        });

        it("afterLast() returns the remainder after the last occurrence", () => {
            // PHP: SupportStrTest::testStrAfterLast
            expect(Str.afterLast("yvette", "yve")).to.equal("tte");
            expect(Str.afterLast("yvette", "t")).to.equal("e");
            expect(Str.afterLast("ééé yvette", "t")).to.equal("e");
            expect(Str.afterLast("yvette", "tte")).to.equal("");
            expect(Str.afterLast("yvette", "xxxx")).to.equal("yvette");
            expect(Str.afterLast("yvette", "")).to.equal("yvette");
            expect(Str.afterLast("yv0et0te", "0")).to.equal("te");
            expect(Str.afterLast("yv2et2te", "2")).to.equal("te");
            expect(Str.afterLast("----foo", "---")).to.equal("foo");
            // Multibyte needle
            expect(Str.afterLast("café au café", "café")).to.equal("");
            expect(Str.afterLast("こんにちは世界こんにちは", "こんにちは")).to.equal("");
        });

        it("before() returns the portion before the first occurrence", () => {
            // PHP: SupportStrTest::testStrBefore
            expect(Str.before("hannah", "nah")).to.equal("han");
            expect(Str.before("hannah", "n")).to.equal("ha");
            expect(Str.before("ééé hannah", "han")).to.equal("ééé ");
            expect(Str.before("hannah", "xxxx")).to.equal("hannah");
            expect(Str.before("hannah", "")).to.equal("hannah");
            expect(Str.before("han0nah", "0")).to.equal("han");
            expect(Str.before("han2nah", "2")).to.equal("han");
            expect(Str.before("", "")).to.equal("");
            expect(Str.before("", "a")).to.equal("");
            expect(Str.before("a", "a")).to.equal("");
            expect(Str.before("foo@bar.com", "@")).to.equal("foo");
            expect(Str.before("foo@@bar.com", "@")).to.equal("foo");
            expect(Str.before("@foo@bar.com", "@")).to.equal("");
        });

        it("beforeLast() returns the portion before the last occurrence", () => {
            // PHP: SupportStrTest::testStrBeforeLast
            expect(Str.beforeLast("yvette", "tte")).to.equal("yve");
            expect(Str.beforeLast("yvette", "t")).to.equal("yvet");
            expect(Str.beforeLast("ééé yvette", "yve")).to.equal("ééé ");
            expect(Str.beforeLast("yvette", "yve")).to.equal("");
            expect(Str.beforeLast("yvette", "xxxx")).to.equal("yvette");
            expect(Str.beforeLast("yvette", "")).to.equal("yvette");
            expect(Str.beforeLast("yv0et0te", "0")).to.equal("yv0et");
            expect(Str.beforeLast("yv2et2te", "2")).to.equal("yv2et");
            expect(Str.beforeLast("", "test")).to.equal("");
            expect(Str.beforeLast("yvette", "yvette")).to.equal("");
            expect(Str.beforeLast("laravel framework", " ")).to.equal("laravel");
            expect(Str.beforeLast("yvette\tyv0et0te", "\t")).to.equal("yvette");
        });

        it("between() returns the portion between two values", () => {
            // PHP: SupportStrTest::testStrBetween
            expect(Str.between("abc", "", "c")).to.equal("abc");
            expect(Str.between("abc", "a", "")).to.equal("abc");
            expect(Str.between("abc", "", "")).to.equal("abc");
            expect(Str.between("abc", "a", "c")).to.equal("b");
            expect(Str.between("dddabc", "a", "c")).to.equal("b");
            expect(Str.between("abcddd", "a", "c")).to.equal("b");
            expect(Str.between("dddabcddd", "a", "c")).to.equal("b");
            expect(Str.between("hannah", "ha", "ah")).to.equal("nn");
            expect(Str.between("[a]ab[b]", "[", "]")).to.equal("a]ab[b");
            expect(Str.between("foofoobar", "foo", "bar")).to.equal("foo");
            expect(Str.between("foobarbar", "foo", "bar")).to.equal("bar");
            expect(Str.between("12345", "1", "5")).to.equal("234");
            expect(Str.between("123456789", "123", "6789")).to.equal("45");
            expect(Str.between("nothing", "foo", "bar")).to.equal("nothing");
        });

        it("betweenFirst() returns the smallest portion between two values", () => {
            // PHP: SupportStrTest::testStrBetweenFirst
            expect(Str.betweenFirst("abc", "", "c")).to.equal("abc");
            expect(Str.betweenFirst("abc", "a", "")).to.equal("abc");
            expect(Str.betweenFirst("abc", "", "")).to.equal("abc");
            expect(Str.betweenFirst("abc", "a", "c")).to.equal("b");
            expect(Str.betweenFirst("dddabc", "a", "c")).to.equal("b");
            expect(Str.betweenFirst("abcddd", "a", "c")).to.equal("b");
            expect(Str.betweenFirst("dddabcddd", "a", "c")).to.equal("b");
            expect(Str.betweenFirst("hannah", "ha", "ah")).to.equal("nn");
            expect(Str.betweenFirst("[a]ab[b]", "[", "]")).to.equal("a");
            expect(Str.betweenFirst("foofoobar", "foo", "bar")).to.equal("foo");
            expect(Str.betweenFirst("foobarbar", "foo", "bar")).to.equal("");
        });

        it("excerpt() extracts a snippet around the first match of a phrase", () => {
            // PHP: SupportStrTest::testStrExcerpt (options array -> positional
            // radius/omission arguments, see class comment)
            expect(Str.excerpt("This is a beautiful morning", "beautiful", 5)).to.equal("...is a beautiful morn...");
            expect(Str.excerpt("This is a beautiful morning", "this", 5)).to.equal("This is a...");
            expect(Str.excerpt("This is a beautiful morning", "morning", 5)).to.equal("...iful morning");
            expect(Str.excerpt("This is a beautiful morning", "day")).to.equal(undefined);
            expect(Str.excerpt("This is a beautiful! morning", "Beautiful", 5)).to.equal("...is a beautiful! mor...");
            expect(Str.excerpt("This is a beautiful? morning", "beautiful", 5)).to.equal("...is a beautiful? mor...");
            expect(Str.excerpt("", "", 0)).to.equal("");
            expect(Str.excerpt("a", "a", 0)).to.equal("a");
            expect(Str.excerpt("abc", "B", 0)).to.equal("...b...");
            expect(Str.excerpt("abc", "b", 1)).to.equal("abc");
            expect(Str.excerpt("abcd", "b", 1)).to.equal("abc...");
            expect(Str.excerpt("zabc", "b", 1)).to.equal("...abc");
            expect(Str.excerpt("zabcd", "b", 1)).to.equal("...abc...");
            expect(Str.excerpt("zabcd", "b", 2)).to.equal("zabcd");
            expect(Str.excerpt("  zabcd  ", "b", 4)).to.equal("zabcd");
            expect(Str.excerpt("z  abc  d", "b", 1)).to.equal("...abc...");
            expect(Str.excerpt("This is a beautiful morning", "beautiful", 5, "[...]")).to.equal(
                "[...]is a beautiful morn[...]",
            );
            expect(
                Str.excerpt(
                    "This is the ultimate supercalifragilisticexpialidocious very looooooooooooooooooong looooooooooooong beautiful morning with amazing sunshine and awesome temperatures. So what are you gonna do about it?",
                    "very",
                    100,
                    "[...]",
                ),
            ).to.equal(
                "This is the ultimate supercalifragilisticexpialidocious very looooooooooooooooooong looooooooooooong beautiful morning with amazing sunshine and awesome tempera[...]",
            );
            expect(Str.excerpt("taylor", "y", 0)).to.equal("...y...");
            expect(Str.excerpt("taylor", "Y", 1)).to.equal("...ayl...");
            expect(Str.excerpt("<div> The article description </div>", "article")).to.equal(
                "<div> The article description </div>",
            );
            expect(Str.excerpt("<div> The article description </div>", "article", 5)).to.equal(
                "...The article desc...",
            );
            // `strip_tags('<div> The article description </div>')` inlined --
            // strip_tags itself isn't under test here.
            expect(Str.excerpt("The article description", "article")).to.equal("The article description");
            expect(Str.excerpt("")).to.equal("");
            expect(Str.excerpt("The article description", "", 1)).to.equal("T...");
            expect(Str.excerpt("The article description", "", 8)).to.equal("The arti...");
            expect(Str.excerpt(" ")).to.equal("");
            expect(Str.excerpt("The article description", " ", 4)).to.equal("The arti...");
            expect(Str.excerpt("The article description", "description", 4)).to.equal("...cle description");
            expect(Str.excerpt("The article description", "T", 0)).to.equal("T...");
            expect(Str.excerpt("What is the article?", "What", 2, "?")).to.equal("What i?");

            expect(Str.excerpt("åèö - 二 sān 大åèö", "二 sān", 4)).to.equal("...ö - 二 sān 大åè...");
            expect(Str.excerpt("åèö - 二 sān 大åèö", "åèö", 4)).to.equal("åèö - 二...");
            expect(Str.excerpt("åèö - 二 sān 大åèö", "åèö - 二 sān 大åèö", 4)).to.equal("åèö - 二 sān 大åèö");
            expect(Str.excerpt("㏗༼㏗", "༼", 0)).to.equal("...༼...");
            expect(Str.excerpt("Como você está", "ê", 2)).to.equal("...ocê e...");
            expect(Str.excerpt("Como você está", "Ê", 2)).to.equal("...ocê e...");
            expect(Str.excerpt("João Antônio ", "jo", 2)).to.equal("João...");
            expect(Str.excerpt("João Antônio", "JOÃO", 5)).to.equal("João Antô...");
            expect(Str.excerpt("", "/")).to.equal(undefined);
        });
    });
};
