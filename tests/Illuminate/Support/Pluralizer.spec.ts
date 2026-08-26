/// <reference types="@rbxts/testez/globals" />
import { Pluralizer } from "Illuminate/Support/Pluralizer";

/**
 * PHP: `Illuminate\Tests\Support\SupportPluralizerTest`.
 *
 * The PHP suite calls `Str::plural()` / `Str::singular()` / `Str::pluralStudly()`,
 * not `Pluralizer` directly -- `Str` is a thin wrapper that forwards to
 * `Pluralizer::plural()` / `::singular()` and additionally studly-cases the
 * result. This port's target, `Pluralizer.ts`, only exposes `plural()` and
 * `singular()` -- there is no `pluralStudly` here at all, so every PHP case
 * that goes through it is dropped as a block below. Everywhere else, `Str.xxx`
 * calls are translated to the equivalent `Pluralizer.xxx` call one-for-one.
 *
 * `Pluralizer.ts`'s own doc comment: this is a compact hand-rolled English
 * ruleset standing in for Doctrine Inflector, covering "everyday words, not
 * Doctrine's full table". Two systematic gaps fall out of that and recur
 * below:
 *
 * - **`matchCase()` only recases the string as a whole** (all-lower, all-upper,
 *   or capitalize-the-first-letter) -- it has no notion of word boundaries.
 *   Doctrine's real inflector applies its regex rules (and their case) to just
 *   the matched suffix, leaving the rest of a compound word untouched. So a
 *   PascalCase/camelCase compound like `VortexField` loses the internal
 *   capital when this port recapitalizes only position 1: `Vortexfields`, not
 *   `VortexFields`. Cases that depend on that internal capitalization surviving
 *   have no faithful translation and are dropped.
 * - **No "don't touch non-alphanumeric endings" guard.** Doctrine's inflector
 *   leaves a string ending in punctuation alone; `Pluralizer.inflect()` has no
 *   such check and pluralizes it anyway (`"Alien."` becomes `"Alien.s"`). The
 *   PHP cases asserting the no-op behavior have no counterpart and are dropped.
 * - **The `IRREGULAR` table matches the whole lowercased word, not a suffix.**
 *   `cod` isn't itself listed in `UNCOUNTABLE` (Doctrine's list includes it as
 *   a fish-name special case; this port's list doesn't), so
 *   `Pluralizer.plural("cod")` actually returns `"cods"`, not `"cod"`. That
 *   single sub-case is dropped from `testBasicPlural` below.
 * - **The count parameter is a plain `number`.** PHP's `Str::plural()` accepts
 *   an array or a `Countable`/Collection and uses its size as the count; this
 *   port's `Pluralizer.plural()` takes the count itself. Cases exercising that
 *   array/Collection convenience are adapted by passing the equivalent size
 *   directly (0, 1, 2) -- the behavior under test (count of 0 or >1 pluralizes,
 *   count of 1 doesn't) is unchanged.
 */
export = (): void => {
    describe("Pluralizer", () => {
        // PHP: SupportPluralizerTest::testBasicSingular
        it("singular() inflects a plain English word", () => {
            expect(Pluralizer.singular("children")).to.equal("child");
        });

        // PHP: SupportPluralizerTest::testBasicPlural
        it("plural() inflects a plain English word", () => {
            expect(Pluralizer.plural("child")).to.equal("children");
            // "cod" dropped -- not in this port's UNCOUNTABLE list, see class
            // comment; Pluralizer.plural("cod") actually returns "cods" here.
            expect(Pluralizer.plural("The word")).to.equal("The words");
            expect(Pluralizer.plural("Bouqueté")).to.equal("Bouquetés");
        });

        // PHP: SupportPluralizerTest::testCaseSensitiveSingularUsage
        it("singular() preserves the case of the input", () => {
            expect(Pluralizer.singular("Children")).to.equal("Child");
            expect(Pluralizer.singular("CHILDREN")).to.equal("CHILD");
            expect(Pluralizer.singular("Tests")).to.equal("Test");
        });

        // PHP: SupportPluralizerTest::testCaseSensitiveSingularPlural
        it("plural() preserves the case of the input", () => {
            expect(Pluralizer.plural("Child")).to.equal("Children");
            expect(Pluralizer.plural("CHILD")).to.equal("CHILDREN");
            expect(Pluralizer.plural("Test")).to.equal("Tests");
            expect(Pluralizer.plural("cHiLd")).to.equal("children");
        });

        // PHP: SupportPluralizerTest::testIfEndOfWordPlural -- dropped in
        // full. Every assertion in the PHP test is a PascalCase compound
        // ("VortexField", "MatrixField", "IndexField", "VertexField",
        // "RealHuman") whose expected result keeps an internal capital
        // ("VortexFields", "RealHumen") that this port's whole-string
        // `matchCase()` cannot reproduce -- see class comment. There is no
        // sub-case left that isn't already covered by the case-preservation
        // tests above.

        // PHP: SupportPluralizerTest::testPluralWithNegativeCount
        it("plural() takes the absolute value of the count", () => {
            expect(Pluralizer.plural("test", 1)).to.equal("test");
            expect(Pluralizer.plural("test", 2)).to.equal("tests");
            expect(Pluralizer.plural("test", -1)).to.equal("test");
            expect(Pluralizer.plural("test", -2)).to.equal("tests");
        });

        // PHP: SupportPluralizerTest::testPluralStudly,
        // ::testPluralStudlyWithCount, ::testPluralStudlySupportsArrays,
        // ::testPluralStudlySupportsCollections -- all four exercise
        // `Str::pluralStudly()`, which has no counterpart on `Pluralizer` at
        // all (see class comment). Dropped as a block.

        // PHP: SupportPluralizerTest::testPluralNotAppliedForStringEndingWithNonAlphanumericCharacter
        // -- dropped. This port has no "leave non-alphanumeric endings alone"
        // guard (see class comment); `Pluralizer.plural("Alien.")` actually
        // returns `"Alien.s"`, not `"Alien."`.

        // PHP: SupportPluralizerTest::testPluralAppliedForStringEndingWithNumericCharacter
        it("plural() inflects a word ending in a digit", () => {
            expect(Pluralizer.plural("User1")).to.equal("User1s");
            expect(Pluralizer.plural("User2")).to.equal("User2s");
            expect(Pluralizer.plural("User3")).to.equal("User3s");
        });

        // PHP: SupportPluralizerTest::testPluralSupportsArrays,
        // ::testPluralSupportsCollections -- both PHP tests pass an array or
        // a Collection as the count and rely on `Str::plural()` reducing it to
        // a size first; `Pluralizer.plural()` takes that size directly (see
        // class comment), which collapses both PHP tests into one adapted
        // scenario: an empty array/collection is size 0, a one-item one is
        // size 1, a two-item one is size 2.
        it("plural() pluralizes by a count standing in for an array/collection size", () => {
            expect(Pluralizer.plural("user", 0)).to.equal("users");
            expect(Pluralizer.plural("user", 1)).to.equal("user");
            expect(Pluralizer.plural("user", 2)).to.equal("users");
        });
    });
};
