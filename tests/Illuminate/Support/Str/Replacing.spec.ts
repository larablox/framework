/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (replacing methods:
 * `replace`, `replaceArray`, `replaceFirst`, `replaceStart`, `replaceLast`,
 * `replaceEnd`, `replaceMatches`, `remove`, `swap`, `deduplicate`).
 *
 * `Str.replace()`/`Str.remove()` have no `$caseSensitive` parameter (see
 * `agent_docs/laravel-parity.md`); every PHP case that passes `false` for it
 * is dropped, since it exercises exactly the behavior this port doesn't have.
 * Their array-*subject* variants (`Str::replace(..., ['Žltý', 'kôň'], ...)`,
 * a `Collection` subject) are dropped too -- `subject` here is always a plain
 * `string`. `Str::replaceThrowsForScalarSearchAndArrayReplacement` isn't
 * ported: this port's `replace()` doesn't validate that combination and
 * doesn't throw for it, so there's no exception to assert.
 *
 * `Str.swap()` takes an array of `[search, replace]` pairs instead of PHP's
 * associative array (see class comment on `Str.swap` in `Str.ts`).
 *
 * `Str.replaceMatches()`'s pattern is a Luau pattern, not PCRE. Two of PHP's
 * cases use PCRE syntax with a direct, non-alternation/lookaround Luau
 * equivalent -- `\d` -> `%d`, backreference `$1` -> `%1` -- and are ported
 * with that literal translation. The array-of-patterns case
 * (`Str::replaceMatches(['/bar/', '/baz/'], ...)`) has no counterpart --
 * `Str.replaceMatches()`'s pattern is a single string -- so it's ported as
 * two sequential calls, reproducing PHP's own sequential-application
 * semantics for `preg_replace()` with array patterns.
 */
export = (): void => {
    describe("Str replacing", () => {
        it("replace() replaces every occurrence", () => {
            // PHP: SupportStrTest::testReplace (case-insensitive and array-subject
            // cases dropped, see class comment)
            expect(Str.replace("baz", "laravel", "foo bar baz")).to.equal(
                "foo bar laravel",
            );
            expect(Str.replace("?", "8.x", "foo bar baz ?")).to.equal(
                "foo bar baz 8.x",
            );
            expect(Str.replace(" ", "/", "foo bar baz")).to.equal(
                "foo/bar/baz",
            );
            expect(
                Str.replace(
                    ["?1", "?2", "?3"],
                    ["foo", "bar", "baz"],
                    "?1 ?2 ?3",
                ),
            ).to.equal("foo bar baz");
        });

        it("replaceArray() replaces a placeholder sequentially with an array", () => {
            // PHP: SupportStrTest::testReplaceArray
            expect(
                Str.replaceArray("?", ["foo", "bar", "baz"], "?/?/?"),
            ).to.equal("foo/bar/baz");
            expect(
                Str.replaceArray("?", ["foo", "bar", "baz"], "?/?/?/?"),
            ).to.equal("foo/bar/baz/?");
            expect(
                Str.replaceArray("?", ["foo", "bar", "baz"], "?/?"),
            ).to.equal("foo/bar");
            expect(
                Str.replaceArray("x", ["foo", "bar", "baz"], "?/?/?"),
            ).to.equal("?/?/?");
            // Ensure recursive replacements are avoided
            expect(
                Str.replaceArray("?", ["foo?", "bar", "baz"], "?/?/?"),
            ).to.equal("foo?/bar/baz");
        });

        it("replaceFirst() replaces only the first occurrence", () => {
            // PHP: SupportStrTest::testReplaceFirst
            expect(Str.replaceFirst("bar", "qux", "foobar foobar")).to.equal(
                "fooqux foobar",
            );
            expect(
                Str.replaceFirst("bar?", "qux?", "foo/bar? foo/bar?"),
            ).to.equal("foo/qux? foo/bar?");
            expect(Str.replaceFirst("bar", "", "foobar foobar")).to.equal(
                "foo foobar",
            );
            expect(Str.replaceFirst("xxx", "yyy", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            expect(Str.replaceFirst("", "yyy", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            expect(Str.replaceFirst("0", "1", "0")).to.equal("1");
            // Multibyte string support
            expect(Str.replaceFirst("ö", "xxx", "Jönköping Malmö")).to.equal(
                "Jxxxnköping Malmö",
            );
            expect(Str.replaceFirst("", "yyy", "Jönköping Malmö")).to.equal(
                "Jönköping Malmö",
            );
        });

        it("replaceStart() replaces only when the value starts the string", () => {
            // PHP: SupportStrTest::testReplaceStart
            expect(Str.replaceStart("bar", "qux", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            expect(
                Str.replaceStart("bar?", "qux?", "foo/bar? foo/bar?"),
            ).to.equal("foo/bar? foo/bar?");
            expect(Str.replaceStart("foo", "qux", "foobar foobar")).to.equal(
                "quxbar foobar",
            );
            expect(
                Str.replaceStart("foo/bar?", "qux?", "foo/bar? foo/bar?"),
            ).to.equal("qux? foo/bar?");
            expect(Str.replaceStart("foo", "", "foobar foobar")).to.equal(
                "bar foobar",
            );
            expect(Str.replaceStart("0", "1", "0")).to.equal("1");
            // Multibyte string support
            expect(Str.replaceStart("Jö", "xxx", "Jönköping Malmö")).to.equal(
                "xxxnköping Malmö",
            );
            expect(Str.replaceStart("", "yyy", "Jönköping Malmö")).to.equal(
                "Jönköping Malmö",
            );
        });

        it("replaceLast() replaces only the last occurrence", () => {
            // PHP: SupportStrTest::testReplaceLast
            expect(Str.replaceLast("bar", "qux", "foobar foobar")).to.equal(
                "foobar fooqux",
            );
            expect(
                Str.replaceLast("bar?", "qux?", "foo/bar? foo/bar?"),
            ).to.equal("foo/bar? foo/qux?");
            expect(Str.replaceLast("bar", "", "foobar foobar")).to.equal(
                "foobar foo",
            );
            expect(Str.replaceLast("xxx", "yyy", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            expect(Str.replaceLast("", "yyy", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            // Multibyte string support
            expect(Str.replaceLast("ö", "xxx", "Malmö Jönköping")).to.equal(
                "Malmö Jönkxxxping",
            );
            expect(Str.replaceLast("", "yyy", "Malmö Jönköping")).to.equal(
                "Malmö Jönköping",
            );
        });

        it("replaceEnd() replaces only when the value ends the string", () => {
            // PHP: SupportStrTest::testReplaceEnd
            expect(Str.replaceEnd("bar", "qux", "foobar foobar")).to.equal(
                "foobar fooqux",
            );
            expect(
                Str.replaceEnd("bar?", "qux?", "foo/bar? foo/bar?"),
            ).to.equal("foo/bar? foo/qux?");
            expect(Str.replaceEnd("bar", "", "foobar foobar")).to.equal(
                "foobar foo",
            );
            expect(Str.replaceEnd("xxx", "yyy", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            expect(Str.replaceEnd("", "yyy", "foobar foobar")).to.equal(
                "foobar foobar",
            );
            expect(Str.replaceEnd("xxx", "yyy", "fooxxx foobar")).to.equal(
                "fooxxx foobar",
            );
            // Multibyte string support
            expect(Str.replaceEnd("ö", "xxx", "Malmö Jönköping")).to.equal(
                "Malmö Jönköping",
            );
            expect(Str.replaceEnd("öping", "yyy", "Malmö Jönköping")).to.equal(
                "Malmö Jönkyyy",
            );
        });

        it("remove() removes every occurrence", () => {
            // PHP: SupportStrTest::testRemove (case-insensitive cases dropped,
            // see class comment)
            expect(Str.remove("o", "Foobar")).to.equal("Fbar");
            expect(Str.remove("bar", "Foobar")).to.equal("Foo");
            expect(Str.remove("F", "Foobar")).to.equal("oobar");
            expect(Str.remove("f", "Foobar")).to.equal("Foobar");
            expect(Str.remove(["o", "a"], "Foobar")).to.equal("Fbr");
            expect(Str.remove(["f", "b"], "Foobar")).to.equal("Fooar");
            expect(Str.remove(["f", "|"], "Foo|bar")).to.equal("Foobar");
        });

        it("swap() replaces multiple keys with their values", () => {
            // PHP: SupportStrTest::testSwapKeywords (assoc array -> array of
            // pairs, see class comment)
            expect(
                Str.swap(
                    [
                        ["PHP", "PHP 8"],
                        ["awesome", "fantastic"],
                    ],
                    "PHP is awesome",
                ),
            ).to.equal("PHP 8 is fantastic");

            expect(Str.swap([["ⓐⓑ", "baz"]], "foo bar ⓐⓑ")).to.equal(
                "foo bar baz",
            );
        });

        it("deduplicate() collapses runs of a character into one", () => {
            // PHP: SupportStrTest::testDedup
            expect(Str.deduplicate(" laravel   php  framework ")).to.equal(
                " laravel php framework ",
            );
            expect(Str.deduplicate("whaaat", "a")).to.equal("what");
            expect(Str.deduplicate("/some//odd//path/", "/")).to.equal(
                "/some/odd/path/",
            );
            expect(Str.deduplicate("ムだだム", "だ")).to.equal("ムだム");
            expect(
                Str.deduplicate(" laravell    foreverrr  ", [" ", "l", "r"]),
            ).to.equal(" laravel forever ");
        });

        it("replaceMatches() replaces every Luau pattern match", () => {
            // PHP: SupportStrTest::testReplaceMatches (\\d -> %d, $1 -> %1, see
            // class comment)
            expect(Str.replaceMatches("baz", "bar", "foo baz bar")).to.equal(
                "foo bar bar",
            );
            expect(Str.replaceMatches("404", "found", "foo baz baz")).to.equal(
                "foo baz baz",
            );

            // Array-of-patterns applied sequentially, matching PHP's own
            // sequential preg_replace() semantics for array patterns.
            let arrayResult = Str.replaceMatches("bar", "XXX", "foo bar baz");
            arrayResult = Str.replaceMatches("baz", "YYY", arrayResult);
            expect(arrayResult).to.equal("foo XXX YYY");

            const callbackResult = Str.replaceMatches(
                "ba(.)",
                (match) => `ba${match.upper()}`,
                "foo baz bar",
            );
            expect(callbackResult).to.equal("foo baZ baR");

            const numericResult = Str.replaceMatches(
                "(%d+)",
                (match) => tostring((tonumber(match) as number) * 2),
                "foo 123 bar 456",
            );
            expect(numericResult).to.equal("foo 246 bar 912");

            const limitedResult = Str.replaceMatches(
                "ba(.)",
                "ba%1",
                "foo baz baz",
                1,
            );
            expect(limitedResult).to.equal("foo baz baz");

            const limitedCallbackResult = Str.replaceMatches(
                "ba(.)",
                (match) => `ba${match.upper()}`,
                "foo baz baz bar",
                1,
            );
            expect(limitedCallbackResult).to.equal("foo baZ baz bar");
        });
    });
};
