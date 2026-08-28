/// <reference types="@rbxts/testez/globals" />
import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Tests\Support\SupportStringableTest` (words-and-limits and
 * trimming methods: `words`, `limit`, `wordCount`, `numbers`, `squish`,
 * `trim`, `ltrim`, `rtrim`).
 */
export = (): void => {
    describe("Stringable words, limits and trimming", () => {
        it("words() limits the number of words", () => {
            // PHP: SupportStringableTest::testCanBeLimitedByWords /
            // testTrimmedOnlyWhereNecessary / testWithoutWordsDoesntProduceError
            expect(Str.of("Taylor Otwell").words(1).toString()).to.equal("Taylor...");
            expect(Str.of("Taylor Otwell").words(1, "___").toString()).to.equal("Taylor___");
            expect(Str.of("Taylor Otwell").words(3).toString()).to.equal("Taylor Otwell");

            expect(Str.of(" Taylor Otwell ").words(3).toString()).to.equal(" Taylor Otwell ");
            expect(Str.of(" Taylor Otwell ").words(1).toString()).to.equal(" Taylor...");

            const nbsp = "\u{C2}\u{A0}";

            expect(Str.of(" ").words().toString()).to.equal(" ");
            expect(Str.of(nbsp).words().toString()).to.equal(nbsp);
        });

        it("limit() truncates a string to a character length", () => {
            // PHP: SupportStringableTest::testLimit
            expect(
                Str.of("Laravel is a free, open source PHP web application framework.").limit(10).toString(),
            ).to.equal("Laravel is...");
            expect(Str.of("这是一段中文").limit(6).toString()).to.equal("这是一...");

            const value = "The PHP framework for web artisans.";

            expect(Str.of(value).limit(7).toString()).to.equal("The PHP...");
            expect(Str.of(value).limit(7, "").toString()).to.equal("The PHP");
            expect(Str.of(value).limit(100).toString()).to.equal("The PHP framework for web artisans.");

            expect(Str.of("这是一段中文").limit(6, "").toString()).to.equal("这是一");
        });

        it("wordCount() counts the words in the string", () => {
            // PHP: SupportStringableTest::testWordCount
            expect(Str.of("Hello, world!").wordCount()).to.equal(2);
            expect(Str.of("Hi, this is my first contribution to the Laravel framework.").wordCount()).to.equal(10);
        });

        it("numbers() strips everything but the digits", () => {
            // PHP: SupportStringableTest::testNumbers
            expect(Str.of("(555) 123-4567").numbers().toString()).to.equal("5551234567");
        });

        it("squish() collapses runs of whitespace", () => {
            // PHP: SupportStringableTest::testSquish
            expect(Str.of(" words  with   spaces ").squish().toString()).to.equal("words with spaces");
            expect(Str.of("words\t\twith\n\nspaces").squish().toString()).to.equal("words with spaces");
            expect(Str.of("   laravel   php   framework   ").squish().toString()).to.equal("laravel php framework");
            expect(Str.of("   123    ").squish().toString()).to.equal("123");
            expect(Str.of("だ").squish().toString()).to.equal("だ");
            expect(Str.of("ム").squish().toString()).to.equal("ム");
            expect(Str.of("   だ    ").squish().toString()).to.equal("だ");
            expect(Str.of("   ム    ").squish().toString()).to.equal("ム");
        });

        it("trim()/ltrim()/rtrim() remove whitespace from the ends", () => {
            // PHP: SupportStringableTest::testTrim / testLtrim / testRtrim
            expect(Str.of(" foo ").trim().toString()).to.equal("foo");
            expect(Str.of(" foo ").ltrim().toString()).to.equal("foo ");
            expect(Str.of(" foo ").rtrim().toString()).to.equal(" foo");
        });
    });
};
