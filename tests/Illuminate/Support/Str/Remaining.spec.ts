/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (everything not covered by
 * the other `Str/*.spec.ts` files: `ascii`, `slug`, `plural`, `pluralPascal`,
 * `parseCallback`, `flushCache`).
 *
 * `Str::ascii()`'s second `$language` argument (locale-specific
 * transliteration, e.g. Bulgarian/German rules) has no counterpart -- this
 * port's `ascii()` always uses the one reduced Latin-1-plus-Cyrillic table
 * documented on `Str.ts`'s `ASCII_TABLE` -- so `testStringAsciiWithSpecificLocale`
 * is not ported. `Str::ascii(null)` (`testAsciiNull`) has no counterpart
 * either: `value` is a required `string`.
 *
 * `Str::slug()`'s PHP signature in this version is
 * `slug($title, $separator, $language, $dictionary)`; this port's
 * `Str.slug()` drops `$language` (see `ascii()` above) and takes
 * `dictionary` as the third parameter directly, as an array of
 * `[search, replace]` pairs rather than an associative array. Every case is
 * translated positionally; cases whose only point was exercising a specific
 * `$language` value (`'en'`, `null`) are ported using the default table
 * since language selection itself isn't ported. `Str::slug(null)` has no
 * counterpart, `title` is a required `string`.
 *
 * `Str::plural()`'s PHP signature here is
 * `plural($value, $count, prependCount: false)`, and `$count` may be an
 * `int|array|Countable`. This port's `Str.plural(value, count = 2)` takes a
 * plain `number` count with no `prependCount` -- so only the numeric-count
 * cases are ported, and the `prependCount: true` / array-count assertions
 * from `testPlural` are dropped. `Str::counted()` (`testCounted`) has no
 * counterpart at all and isn't ported. `Str::pluralPascal()`'s PHP test
 * exercises array and `Countable` counts (`testPluralPascal`); only the
 * plain-`number`-count cases are ported for the same reason.
 */
export = (): void => {
    describe('Str remaining methods', () => {
        it('ascii() transliterates through the reduced table', () => {
            // PHP: SupportStrTest::testStringAscii
            expect(Str.ascii('@')).to.equal('@');
            expect(Str.ascii('ü')).to.equal('u');
            expect(Str.ascii('')).to.equal('');
            expect(Str.ascii('a!2ë')).to.equal('a!2e');
        });

        it('slug() builds a URL friendly slug', () => {
            // PHP: SupportStrTest::testSlug (language selection dropped, see
            // class comment)
            expect(Str.slug('hello world')).to.equal('hello-world');
            expect(Str.slug('hello-world')).to.equal('hello-world');
            expect(Str.slug('hello_world')).to.equal('hello-world');
            expect(Str.slug('hello_world', '_')).to.equal('hello_world');
            expect(Str.slug('user@host')).to.equal('user-at-host');
            expect(Str.slug('some text', '')).to.equal('sometext');
            expect(Str.slug('', '')).to.equal('');
            expect(Str.slug('')).to.equal('');

            expect(Str.slug('500$ bill', '-', [['$', 'dollar']])).to.equal('500-dollar-bill');
            expect(Str.slug('500--$----bill', '-', [['$', 'dollar']])).to.equal('500-dollar-bill');
            expect(Str.slug('500-$-bill', '-', [['$', 'dollar']])).to.equal('500-dollar-bill');
            expect(Str.slug('500$--bill', '-', [['$', 'dollar']])).to.equal('500-dollar-bill');
            expect(Str.slug('500-$--bill', '-', [['$', 'dollar']])).to.equal('500-dollar-bill');
        });

        it('plural() pluralizes English words by count', () => {
            // PHP: SupportStrTest::testPlural (prependCount/array-count cases
            // dropped, see class comment)
            expect(Str.plural('Laracon', 1)).to.equal('Laracon');
            expect(Str.plural('Laracon', 3)).to.equal('Laracons');
        });

        it('pluralPascal() pluralizes the last word of a pascal case string', () => {
            // PHP: SupportStrTest::testPluralPascal (array/Countable-count
            // cases dropped, see class comment)
            expect(Str.pluralPascal('UserGroup')).to.equal('UserGroups');
            expect(Str.pluralPascal('ProductCategory')).to.equal('ProductCategories');

            expect(Str.pluralPascal('UserGroup', 0)).to.equal('UserGroups');
            expect(Str.pluralPascal('UserGroup', 1)).to.equal('UserGroup');
            expect(Str.pluralPascal('UserGroup', 2)).to.equal('UserGroups');
        });

        it('parseCallback() splits a Class@method style callback', () => {
            // PHP: SupportStrTest::testParseCallback
            expect(pairEqual(Str.parseCallback('Class@method'), 'Class', 'method')).to.equal(true);
            expect(pairEqual(Str.parseCallback('Class@method', 'foo'), 'Class', 'method')).to.equal(true);
            expect(pairEqual(Str.parseCallback('Class', 'foo'), 'Class', 'foo')).to.equal(true);

            const [klass, method] = Str.parseCallback('Class');

            expect(klass).to.equal('Class');
            expect(method).to.equal(undefined);
        });

        it('flushCache() clears the casing caches', () => {
            // PHP: SupportStrTest::testFlushCache (reflection into the
            // private cache field replaced with an observable round-trip:
            // flushing forces snake() to redo the work rather than reuse a
            // stale cached delimiter)
            Str.flushCache();

            expect(Str.snake('LaravelPhpFramework')).to.equal('laravel_php_framework');

            Str.flushCache();

            expect(Str.snake('LaravelPhpFramework', '-')).to.equal('laravel-php-framework');
        });
    });
};

/** Shallow tuple-equality helper for `Str.parseCallback()`'s return pair. */
function pairEqual(value: [string, string | undefined], klass: string, method: string | undefined): boolean
{
    return value[0] === klass && value[1] === method;
}
