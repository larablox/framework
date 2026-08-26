import { Collection } from "Illuminate/Support/Collection";
import { Conditionable } from "Illuminate/Support/Traits/Conditionable";
import { Pluralizer } from "Illuminate/Support/Pluralizer";
import { Tappable } from "Illuminate/Support/Traits/Tappable";
import * as Unicode from "Illuminate/Support/Unicode";
import { Util } from "Illuminate/Container/Util";
import type { JsonSerializable } from "Illuminate/Contracts/Support/JsonSerializable";

/** Characters Luau's pattern matcher treats as magic. */
const MAGIC = "([%^%$%(%)%%%.%[%]%*%+%-%?])";

/**
 * `tonumber()`, but only for spellings PHP also reads as numeric.
 *
 * Luau accepts `"nan"` and `"inf"` as numeric literals and returns the
 * matching float. PHP's numeric casts recognise neither, so `(int) 'nan'` is
 * `0` -- and letting the float through instead poisons every arithmetic
 * downstream of it.
 */
function parseFinite(value: string, base?: number): number | undefined {
    const parsed = base === undefined ? tonumber(value) : tonumber(value, base);

    if (parsed === undefined) {
        return undefined;
    }

    // `parsed !== parsed` is the NaN test -- NaN is the one value not equal
    // to itself.
    if (parsed !== parsed || parsed === math.huge || parsed === -math.huge) {
        return undefined;
    }

    return parsed;
}

/**
 * PHP: `Str::INVISIBLE_CHARACTERS`, plus the `" \n\r\t\v\0"` upstream appends
 * to it in `trim()`/`ltrim()`/`rtrim()`.
 *
 * Upstream builds these into a PCRE character class. A Luau character class
 * matches *bytes*, so a class holding U+3000 would match its three UTF-8 bytes
 * separately and corrupt neighbouring characters; the trimmers below compare
 * codepoints against this set instead.
 */
const INVISIBLE_CODEPOINTS = new Set<number>([
    0x0000, 0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x00ad,
    0x034f, 0x061c, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x180e, 0x2000, 0x2001,
    0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202f, 0x205f, 0x2060, 0x2061,
    0x2062, 0x2063, 0x2064, 0x2065, 0x206a, 0x206b, 0x206c, 0x206d, 0x206e,
    0x206f, 0x2800, 0x3000, 0x3164, 0xfeff, 0xffa0, 0x1d159, 0x1d173, 0x1d174,
    0x1d175, 0x1d176, 0x1d177, 0x1d178, 0x1d179, 0x1d17a, 0xe0020,
]);

const LOWER_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const UPPER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "~!#$%^&*()-_.,<>?/\\{}[]|:;";
const BASE64_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Crockford's base32, as ULID uses. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A reduced transliteration table.
 *
 * PHP hands `ascii()` to voku/portable-ascii, whose tables cover most scripts.
 * This carries Latin-1 and Cyrillic, which is what a Roblox place normally
 * meets; anything else is dropped by `slug()` rather than transliterated.
 */
const ASCII_TABLE: Array<[string, string]> = [
    ["à", "a"],
    ["á", "a"],
    ["â", "a"],
    ["ã", "a"],
    ["ä", "a"],
    ["å", "a"],
    ["è", "e"],
    ["é", "e"],
    ["ê", "e"],
    ["ë", "e"],
    ["ì", "i"],
    ["í", "i"],
    ["î", "i"],
    ["ï", "i"],
    ["ò", "o"],
    ["ó", "o"],
    ["ô", "o"],
    ["õ", "o"],
    ["ö", "o"],
    ["ø", "o"],
    ["ù", "u"],
    ["ú", "u"],
    ["û", "u"],
    ["ü", "u"],
    ["ý", "y"],
    ["ÿ", "y"],
    ["ñ", "n"],
    ["ç", "c"],
    ["ß", "ss"],
    ["æ", "ae"],
    ["а", "a"],
    ["б", "b"],
    ["в", "v"],
    ["г", "g"],
    ["д", "d"],
    ["е", "e"],
    ["ё", "e"],
    ["ж", "zh"],
    ["з", "z"],
    ["и", "i"],
    ["й", "i"],
    ["к", "k"],
    ["л", "l"],
    ["м", "m"],
    ["н", "n"],
    ["о", "o"],
    ["п", "p"],
    ["р", "r"],
    ["с", "s"],
    ["т", "t"],
    ["у", "u"],
    ["ф", "f"],
    ["х", "h"],
    ["ц", "ts"],
    ["ч", "ch"],
    ["ш", "sh"],
    ["щ", "sch"],
    ["ъ", ""],
    ["ы", "y"],
    ["ь", ""],
    ["э", "e"],
    ["ю", "yu"],
    ["я", "ya"],
];

/**
 * PHP: `Illuminate\Support\Str`.
 *
 * Two platform limits shape this port:
 *
 * - **Patterns, not regex.** PHP uses PCRE; Luau has its own pattern syntax
 *   with no alternation, no non-capturing groups and no lookaround. Every
 *   method that takes a pattern from the caller -- `match`, `isMatch`,
 *   `matchAll`, `replaceMatches` -- takes a Luau pattern.
 * - **Case conversion is ASCII.** `string.lower` and `string.upper` leave
 *   non-ASCII bytes alone, so `lower()`, `upper()` and everything built on them
 *   do not fold Cyrillic or accented Latin. Length and substring operations
 *   *are* codepoint-aware, through the `utf8` library.
 *
 * Not ported: `markdown` / `inlineMarkdown` (no CommonMark), `transliterate`
 * (no intl), and the test factories (`createUuidsUsing`, `freezeUuids`,
 * `createRandomStringsUsing` and friends).
 *
 * `Stringable`, which `of()` returns, is at the bottom of this file rather
 * than in one of its own -- the two classes call each other, and a cyclic
 * value import is fatal here. Its own doc block has the detail.
 */
export class Str {
    protected static snakeCache = new Map<string, string>();

    protected static camelCache = new Map<string, string>();

    protected static studlyCache = new Map<string, string>();

    /** Get a new `Stringable` object from the given string. */
    public static of(value: string | number | Stringable = ""): Stringable {
        return new Stringable(value);
    }

    // -----------------------------------------------------------------
    // Slicing
    // -----------------------------------------------------------------

    /** Return the length of the given string, in codepoints. */
    public static length(value: string): number {
        const [count] = utf8.len(value);

        return typeIs(count, "number") ? count : value.size();
    }

    /** Returns the portion of the string specified by the start and length. */
    public static substr(
        value: string,
        start: number,
        length?: number,
    ): string {
        const total = Str.length(value);
        const from =
            start < 0 ? math.max(total + start, 0) : math.min(start, total);
        const take =
            length === undefined
                ? total - from
                : length < 0
                  ? math.max(total - from + length, 0)
                  : math.min(length, total - from);

        if (take <= 0) {
            return "";
        }

        const startByte = utf8.offset(value, from + 1);
        const endByte = utf8.offset(value, from + take + 1);

        if (startByte === undefined) {
            return "";
        }

        return value.sub(startByte, (endByte ?? value.size() + 1) - 1);
    }

    /** Get the character at the specified index. */
    public static charAt(value: string, index: number): string | undefined {
        const total = Str.length(value);

        if (index < 0 ? index < -total : index > total - 1) {
            return undefined;
        }

        return Str.substr(value, index, 1);
    }

    /** Take the first or last given number of characters. */
    public static take(value: string, limit: number): string {
        return limit < 0
            ? Str.substr(value, limit)
            : Str.substr(value, 0, limit);
    }

    /** Reverse the given string. */
    public static reverse(value: string): string {
        const characters = new Array<string>();

        for (const [, code] of utf8.codes(value)) {
            characters.unshift(utf8.char(code));
        }

        return characters.join("");
    }

    // -----------------------------------------------------------------
    // Searching
    // -----------------------------------------------------------------

    /**
     * Find the position of the first occurrence, or undefined.
     *
     * PHP: `mb_strpos()`, which counts characters -- in the offset it takes
     * as well as in the position it answers. Luau's `string.find()` counts
     * bytes, so both ends are converted; the two only agree on ASCII.
     */
    public static position(
        haystack: string,
        needle: string,
        offset = 0,
    ): number | undefined {
        const total = Str.length(haystack);
        const from = offset < 0 ? math.max(total + offset, 0) : offset;

        if (from > total) {
            return undefined;
        }

        const init = utf8.offset(haystack, from + 1) ?? haystack.size() + 1;
        const [found] = haystack.find(needle, init, true);

        if (found === undefined) {
            return undefined;
        }

        if (found === 1) {
            return 0;
        }

        const [characters] = utf8.len(haystack, 1, found - 1);

        return typeIs(characters, "number") ? characters : found - 1;
    }

    /** Determine if a given string contains a given substring. */
    public static contains(
        haystack: string,
        needles: string | Array<string>,
        ignoreCase = false,
    ): boolean {
        // PHP folds case with `mb_strtolower()`, not with the byte-wise
        // `strtolower()`, so `Str.lower()` is the one to use here.
        const subject = ignoreCase ? Str.lower(haystack) : haystack;

        for (const needle of Util.arrayWrap(needles)) {
            const search = ignoreCase ? Str.lower(needle) : needle;
            const [found] = subject.find(search, 1, true);

            if (search !== "" && found !== undefined) {
                return true;
            }
        }

        return false;
    }

    /** Determine if a given string contains all array values. */
    public static containsAll(
        haystack: string,
        needles: Array<string>,
        ignoreCase = false,
    ): boolean {
        // PHP returns the `$any` flag, so an empty needle list is `false` --
        // "contains all of nothing" is not vacuously true here.
        let any = false;

        for (const needle of needles) {
            any = true;

            if (!Str.contains(haystack, needle, ignoreCase)) {
                return false;
            }
        }

        return any;
    }

    /** Determine if a given string doesn't contain a given substring. */
    public static doesntContain(
        haystack: string,
        needles: string | Array<string>,
        ignoreCase = false,
    ): boolean {
        return !Str.contains(haystack, needles, ignoreCase);
    }

    /** Determine if a given string starts with a given substring. */
    public static startsWith(
        haystack: string,
        needles: string | Array<string>,
    ): boolean {
        for (const needle of Util.arrayWrap(needles)) {
            if (needle !== "" && haystack.sub(1, needle.size()) === needle) {
                return true;
            }
        }

        return false;
    }

    /** Determine if a given string doesn't start with a given substring. */
    public static doesntStartWith(
        haystack: string,
        needles: string | Array<string>,
    ): boolean {
        return !Str.startsWith(haystack, needles);
    }

    /** Determine if a given string ends with a given substring. */
    public static endsWith(
        haystack: string,
        needles: string | Array<string>,
    ): boolean {
        for (const needle of Util.arrayWrap(needles)) {
            if (
                needle !== "" &&
                needle.size() <= haystack.size() &&
                haystack.sub(-needle.size()) === needle
            ) {
                return true;
            }
        }

        return false;
    }

    /** Determine if a given string doesn't end with a given substring. */
    public static doesntEndWith(
        haystack: string,
        needles: string | Array<string>,
    ): boolean {
        return !Str.endsWith(haystack, needles);
    }

    /** Count the number of substring occurrences. */
    public static substrCount(haystack: string, needle: string): number {
        if (needle === "") {
            return 0;
        }

        let count = 0;
        let position = 1;

        while (true) {
            const [found, last] = haystack.find(needle, position, true);

            if (found === undefined) {
                break;
            }

            count += 1;
            position = (last as number) + 1;
        }

        return count;
    }

    // -----------------------------------------------------------------
    // Extracting
    // -----------------------------------------------------------------

    /** Return the remainder of a string after the first occurrence. */
    public static after(subject: string, search: string): string {
        if (search === "") {
            return subject;
        }

        const [, last] = subject.find(search, 1, true);

        return last === undefined ? subject : subject.sub(last + 1);
    }

    /** Return the remainder of a string after the last occurrence. */
    public static afterLast(subject: string, search: string): string {
        if (search === "") {
            return subject;
        }

        const position = Str.lastIndexOf(subject, search);

        return position === undefined
            ? subject
            : subject.sub(position + search.size());
    }

    /** Get the portion of a string before the first occurrence. */
    public static before(subject: string, search: string): string {
        if (search === "") {
            return subject;
        }

        const [found] = subject.find(search, 1, true);

        return found === undefined ? subject : subject.sub(1, found - 1);
    }

    /** Get the portion of a string before the last occurrence. */
    public static beforeLast(subject: string, search: string): string {
        if (search === "") {
            return subject;
        }

        const position = Str.lastIndexOf(subject, search);

        return position === undefined ? subject : subject.sub(1, position - 1);
    }

    /** Get the portion of a string between two values. */
    public static between(subject: string, from: string, to: string): string {
        if (from === "" || to === "") {
            return subject;
        }

        return Str.beforeLast(Str.after(subject, from), to);
    }

    /** Get the smallest possible portion of a string between two values. */
    public static betweenFirst(
        subject: string,
        from: string,
        to: string,
    ): string {
        if (from === "" || to === "") {
            return subject;
        }

        return Str.before(Str.after(subject, from), to);
    }

    /** Extract an excerpt from text that matches the first instance of a phrase. */
    public static excerpt(
        text: string,
        phrase = "",
        radius = 100,
        omission = "...",
    ): string | undefined {
        const position =
            phrase === ""
                ? 0
                : // PHP matches with `/iu`, so the fold is the Unicode one.
                  // Simple case mapping is 1:1 on codepoints, which keeps the
                  // position of the match the same in the folded string as in
                  // `text` itself.
                  Str.position(Str.lower(text), Str.lower(phrase));

        if (position === undefined) {
            return undefined;
        }

        const matched = Str.substr(text, position, Str.length(phrase));

        // The whitespace next to the phrase is kept; only the outer edges are
        // trimmed, and the omission marks whichever side was actually cut.
        const startText = Str.ltrim(Str.substr(text, 0, position));
        const endText = Str.rtrim(
            Str.substr(text, position + Str.length(phrase)),
        );

        const startLength = Str.length(startText);
        const start = Str.ltrim(
            Str.substr(startText, math.max(startLength - radius, 0), radius),
        );
        const tail = Str.rtrim(Str.substr(endText, 0, radius));

        return `${start === startText ? "" : omission}${start}${matched}${tail}${tail === endText ? "" : omission}`;
    }

    // -----------------------------------------------------------------
    // Replacing
    // -----------------------------------------------------------------

    /** Replace all occurrences of the search string with the replacement. */
    public static replace(
        search: string | Array<string>,
        replace: string | Array<string>,
        subject: string,
    ): string {
        const searches = Util.arrayWrap(search);
        const replacements = Util.arrayWrap(replace);
        let result = subject;

        for (let index = 0; index < searches.size(); index++) {
            const replacement = typeIs(replace, "string")
                ? (replace as string)
                : (replacements[index] ?? "");

            result = Str.replaceAllPlain(result, searches[index], replacement);
        }

        return result;
    }

    /** Replace a given value in the string sequentially with an array. */
    public static replaceArray(
        search: string,
        replace: Array<string>,
        subject: string,
    ): string {
        const segments = subject.split(search);
        let result = segments[0];

        for (let index = 1; index < segments.size(); index++) {
            result = `${result}${replace[index - 1] ?? search}${segments[index]}`;
        }

        return result;
    }

    /** Replace the first occurrence of a given value in the string. */
    public static replaceFirst(
        search: string,
        replace: string,
        subject: string,
    ): string {
        if (search === "") {
            return subject;
        }

        const [found, last] = subject.find(search, 1, true);

        if (found === undefined) {
            return subject;
        }

        return `${subject.sub(1, found - 1)}${replace}${subject.sub((last as number) + 1)}`;
    }

    /** Replace the first occurrence of the given value if it starts the string. */
    public static replaceStart(
        search: string,
        replace: string,
        subject: string,
    ): string {
        if (search === "" || !Str.startsWith(subject, search)) {
            return subject;
        }

        return Str.replaceFirst(search, replace, subject);
    }

    /** Replace the last occurrence of a given value in the string. */
    public static replaceLast(
        search: string,
        replace: string,
        subject: string,
    ): string {
        if (search === "") {
            return subject;
        }

        const position = Str.lastIndexOf(subject, search);

        if (position === undefined) {
            return subject;
        }

        return `${subject.sub(1, position - 1)}${replace}${subject.sub(position + search.size())}`;
    }

    /** Replace the last occurrence of the given value if it ends the string. */
    public static replaceEnd(
        search: string,
        replace: string,
        subject: string,
    ): string {
        if (search === "" || !Str.endsWith(subject, search)) {
            return subject;
        }

        return Str.replaceLast(search, replace, subject);
    }

    /** Replace the patterns matching the given Luau pattern. */
    public static replaceMatches(
        pattern: string,
        replace: string | ((match: string) => string),
        subject: string,
        limit?: number,
    ): string {
        const [result] = typeIs(replace, "function")
            ? subject.gsub(
                  pattern,
                  (match: string) =>
                      (replace as (match: string) => string)(match),
                  limit,
              )
            : subject.gsub(pattern, replace as string, limit);

        return result;
    }

    /** Remove any occurrence of the given string in the subject. */
    public static remove(
        search: string | Array<string>,
        subject: string,
    ): string {
        return Str.replace(search, "", subject);
    }

    /** Swap keys with their values within the given string. */
    public static swap(map: Array<[string, string]>, subject: string): string {
        let result = subject;

        for (const [search, replace] of map) {
            result = Str.replaceAllPlain(result, search, replace);
        }

        return result;
    }

    /** Replace consecutive instances of a given character with a single one. */
    public static deduplicate(
        value: string,
        characters: string | Array<string> = " ",
    ): string {
        let result = value;

        for (const character of Util.arrayWrap(characters)) {
            if (character !== "") {
                result = Str.collapseRuns(result, character);
            }
        }

        return result;
    }

    /**
     * Collapse the runs one `deduplicate()` needle produces into a single
     * instance of it.
     *
     * PHP builds `/preg_quote($character)+/u` and lets the regex engine do
     * this. Two details of that pattern carry over: `+` quantifies only the
     * needle's *last character* (PHP never groups it), and under `/u` that is
     * a whole codepoint rather than a byte. A Luau pattern class cannot hold
     * a multi-byte character at all, so the run is walked by hand instead.
     */
    private static collapseRuns(value: string, character: string): string {
        const lastOffset = utf8.offset(character, -1) ?? character.size();
        const prefix = character.sub(1, lastOffset - 1);
        const last = character.sub(lastOffset);
        const pieces = new Array<string>();

        let index = 1;

        while (index <= value.size()) {
            let cursor = index + prefix.size();
            let repeats = 0;

            if (prefix === "" || value.sub(index, cursor - 1) === prefix) {
                while (value.sub(cursor, cursor + last.size() - 1) === last) {
                    repeats += 1;
                    cursor += last.size();
                }
            }

            if (repeats > 0) {
                pieces.push(character);
                index = cursor;
            } else {
                pieces.push(value.sub(index, index));
                index += 1;
            }
        }

        return pieces.join("");
    }

    // -----------------------------------------------------------------
    // Wrapping and padding
    // -----------------------------------------------------------------

    /**
     * Begin a string with a single instance of a given value.
     *
     * PHP strips the repeated prefix with `(?:...)+`; a Luau pattern cannot
     * quantify a group, so the repetition is peeled off in a loop.
     */
    public static start(value: string, prefix: string): string {
        if (prefix === "") {
            return value;
        }

        let result = value;

        while (Str.startsWith(result, prefix)) {
            result = Str.substr(result, Str.length(prefix));
        }

        return `${prefix}${result}`;
    }

    /** Cap a string with a single instance of a given value. */
    public static finish(value: string, cap: string): string {
        if (cap === "") {
            return value;
        }

        let result = value;

        while (Str.endsWith(result, cap)) {
            result = Str.substr(
                result,
                0,
                Str.length(result) - Str.length(cap),
            );
        }

        return `${result}${cap}`;
    }

    /** Wrap the string with the given strings. */
    public static wrap(value: string, before: string, after?: string): string {
        return `${before}${value}${after ?? before}`;
    }

    /** Unwrap the string with the given strings. */
    public static unwrap(
        value: string,
        before: string,
        after?: string,
    ): string {
        let result = value;
        const suffix = after ?? before;

        if (Str.startsWith(result, before)) {
            result = Str.substr(result, Str.length(before));
        }

        if (Str.endsWith(result, suffix)) {
            result = Str.substr(
                result,
                0,
                Str.length(result) - Str.length(suffix),
            );
        }

        return result;
    }

    /** Remove the given string(s) from the start of the subject. */
    public static chopStart(
        subject: string,
        needle: string | Array<string>,
    ): string {
        for (const candidate of Util.arrayWrap(needle)) {
            if (candidate !== "" && Str.startsWith(subject, candidate)) {
                return Str.substr(subject, Str.length(candidate));
            }
        }

        return subject;
    }

    /** Remove the given string(s) from the end of the subject. */
    public static chopEnd(
        subject: string,
        needle: string | Array<string>,
    ): string {
        for (const candidate of Util.arrayWrap(needle)) {
            if (candidate !== "" && Str.endsWith(subject, candidate)) {
                return Str.substr(
                    subject,
                    0,
                    Str.length(subject) - Str.length(candidate),
                );
            }
        }

        return subject;
    }

    /** Pad both sides of a string with another. */
    public static padBoth(value: string, length: number, pad = " "): string {
        const short = math.max(0, length - Str.length(value));
        const left = math.floor(short / 2);

        return `${Str.buildPad(pad, left)}${value}${Str.buildPad(pad, short - left)}`;
    }

    /** Pad the left side of a string with another. */
    public static padLeft(value: string, length: number, pad = " "): string {
        return `${Str.buildPad(pad, math.max(0, length - Str.length(value)))}${value}`;
    }

    /** Pad the right side of a string with another. */
    public static padRight(value: string, length: number, pad = " "): string {
        return `${value}${Str.buildPad(pad, math.max(0, length - Str.length(value)))}`;
    }

    /** Repeat the given string. */
    public static repeat(value: string, times: number): string {
        return value.rep(times);
    }

    /** Masks a portion of a string with a repeated character. */
    public static mask(
        value: string,
        character: string,
        index: number,
        length?: number,
    ): string {
        if (character === "") {
            return value;
        }

        const total = Str.length(value);
        const startIndex =
            index < 0 ? (index < -total ? 0 : total + index) : index;
        const segment = Str.substr(value, startIndex, length);

        if (segment === "") {
            return value;
        }

        const segmentLength = Str.length(segment);

        return `${Str.substr(value, 0, startIndex)}${Str.substr(character, 0, 1).rep(segmentLength)}${Str.substr(value, startIndex + segmentLength)}`;
    }

    /** Replace text within a portion of a string. */
    public static substrReplace(
        value: string,
        replace: string,
        offset = 0,
        length?: number,
    ): string {
        const total = Str.length(value);
        const take = length ?? total;

        return `${Str.substr(value, 0, offset)}${replace}${Str.substr(Str.substr(value, offset), take)}`;
    }

    // -----------------------------------------------------------------
    // Trimming
    // -----------------------------------------------------------------

    /** Remove all whitespace, or the given characters, from both ends. */
    public static trim(value: string, characters?: string): string {
        return Str.rtrim(Str.ltrim(value, characters), characters);
    }

    /** Remove all whitespace, or the given characters, from the beginning. */
    public static ltrim(value: string, characters?: string): string {
        if (characters === undefined) {
            return Str.trimInvisible(value, true, false);
        }

        // PHP: `ltrim($value, '')` strips nothing. Letting an empty list reach
        // the pattern would build `^[]+`, which Luau rejects outright.
        if (characters === "") {
            return value;
        }

        const [result] = value.gsub(
            `^[${Str.characterClass(characters)}]+`,
            "",
        );

        return result;
    }

    /** Remove all whitespace, or the given characters, from the end. */
    public static rtrim(value: string, characters?: string): string {
        if (characters === undefined) {
            return Str.trimInvisible(value, false, true);
        }

        if (characters === "") {
            return value;
        }

        const [result] = value.gsub(
            `[${Str.characterClass(characters)}]+$`,
            "",
        );

        return result;
    }

    /**
     * Strip leading and/or trailing invisible characters.
     *
     * PHP: the `preg_replace('~^[\s...]+|[\s...]+$~u', '', $value)` branch
     * `trim()`/`ltrim()`/`rtrim()` take when no character list is given, where
     * `...` is `Str::INVISIBLE_CHARACTERS` plus `" \n\r\t\v\0"`.
     */
    private static trimInvisible(
        value: string,
        fromStart: boolean,
        fromEnd: boolean,
    ): string {
        const offsets = new Array<number>();
        const codepoints = new Array<number>();

        for (const [offset, code] of utf8.codes(value)) {
            offsets.push(offset);
            codepoints.push(code);
        }

        let first = 0;
        let last = codepoints.size() - 1;

        if (fromStart) {
            while (
                first <= last &&
                INVISIBLE_CODEPOINTS.has(codepoints[first])
            ) {
                first++;
            }
        }

        if (fromEnd) {
            while (
                last >= first &&
                INVISIBLE_CODEPOINTS.has(codepoints[last])
            ) {
                last--;
            }
        }

        if (first > last) {
            return "";
        }

        const from = offsets[first];
        const to =
            last + 1 < offsets.size() ? offsets[last + 1] - 1 : value.size();

        return value.sub(from, to);
    }

    /** Remove all extraneous whitespace, collapsing runs into one space. */
    public static squish(value: string): string {
        // PHP collapses the same invisible set `trim()` strips, not just
        // `%s` -- `laravel\u{3164}\u{3164}php` has to squish to `laravel php`.
        const parts = new Array<string>();
        let inRun = false;

        for (const [, code] of utf8.codes(Str.trim(value))) {
            if (INVISIBLE_CODEPOINTS.has(code)) {
                if (!inRun) {
                    parts.push(" ");
                    inRun = true;
                }

                continue;
            }

            parts.push(utf8.char(code));
            inRun = false;
        }

        return parts.join("");
    }

    // -----------------------------------------------------------------
    // Case
    // -----------------------------------------------------------------

    /** Convert the given string to lower case. */
    public static lower(value: string): string {
        return Unicode.lower(value);
    }

    /** Convert the given string to upper case. */
    public static upper(value: string): string {
        return Unicode.upper(value);
    }

    /** Convert the given string to the given case. */
    public static convertCase(
        value: string,
        mode: "lower" | "upper" | "title" = "lower",
    ): string {
        if (mode === "upper") {
            return Str.upper(value);
        }

        if (mode === "title") {
            return Str.title(value);
        }

        return Str.lower(value);
    }

    /** Convert the given string to title case. */
    public static title(value: string): string {
        // PHP: `mb_convert_case($value, MB_CASE_TITLE, 'UTF-8')`, which upper
        // cases the first *cased letter* of each word and lower cases the
        // rest. `ucwords(lower($value))` is not the same thing: it only looks
        // at the character right after a separator, so a word opening with
        // punctuation or a symbol (`❤laravel`) would never be capitalised.
        const parts = new Array<string>();
        let seenLetter = false;

        for (const [, code] of utf8.codes(value)) {
            const isCased =
                Unicode.isUpperCodepoint(code) ||
                Unicode.isLowerCodepoint(code);

            if (!isCased) {
                // A separator ends the word; any other uncased character
                // (punctuation, a symbol) simply carries through.
                if (utf8.char(code).match("^[%s_-]$")[0] !== undefined) {
                    seenLetter = false;
                }

                parts.push(utf8.char(code));

                continue;
            }

            parts.push(
                utf8.char(
                    seenLetter
                        ? Unicode.toLowerCodepoint(code)
                        : Unicode.toUpperCodepoint(code),
                ),
            );
            seenLetter = true;
        }

        return parts.join("");
    }

    /** Make a string's first character lower case. */
    public static lcfirst(value: string): string {
        return `${Str.lower(Str.substr(value, 0, 1))}${Str.substr(value, 1)}`;
    }

    /** Make a string's first character upper case. */
    public static ucfirst(value: string): string {
        return `${Str.upper(Str.substr(value, 0, 1))}${Str.substr(value, 1)}`;
    }

    /** Upper case the first character of each word. */
    public static ucwords(value: string, separators = " \t\r\n\f\v"): string {
        const set = Str.characterClass(separators);
        const characters = new Array<string>();
        let atBoundary = true;

        for (const [, code] of utf8.codes(value)) {
            const character = utf8.char(code);

            characters.push(
                atBoundary
                    ? utf8.char(Unicode.toUpperCodepoint(code))
                    : character,
            );
            atBoundary = character.match(`[${set}]`)[0] !== undefined;
        }

        return characters.join("");
    }

    /** Split a string into pieces by upper case characters. */
    public static ucsplit(value: string): Array<string> {
        const parts = new Array<string>();
        let current = "";

        for (const [, code] of utf8.codes(value)) {
            const character = utf8.char(code);

            if (Unicode.isUpperCodepoint(code) && current !== "") {
                parts.push(current);
                current = "";
            }

            current = `${current}${character}`;
        }

        if (current !== "") {
            parts.push(current);
        }

        return parts;
    }

    /** Convert a value to camel case. */
    public static camel(value: string): string {
        const cached = Str.camelCache.get(value);

        if (cached !== undefined) {
            return cached;
        }

        const result = Str.lcfirst(Str.studly(value));

        Str.camelCache.set(value, result);

        return result;
    }

    /** Convert a value to studly caps case. */
    public static studly(value: string): string {
        const cached = Str.studlyCache.get(value);

        if (cached !== undefined) {
            return cached;
        }

        const words = new Array<string>();

        for (const [word] of Str.replace(["-", "_"], " ", value).gmatch(
            "%S+",
        )) {
            words.push(Str.ucfirst(word as string));
        }

        const result = words.join("");

        Str.studlyCache.set(value, result);

        return result;
    }

    /** Convert a value to pascal case. */
    public static pascal(value: string): string {
        return Str.studly(value);
    }

    /**
     * Insert `delimiter` before every ASCII upper case character that follows
     * another character.
     *
     * PHP: `preg_replace('/(.)(?=[A-Z])/u', '$1'.$delimiter, $value)`, the
     * second step of `Str::snake()`. Luau patterns cannot look ahead, so the
     * walk is spelled out.
     *
     * Two details that look like bugs and are not:
     *
     * - it matches *any* preceding character, not just a lower case one --
     *   that is what turns `LaravelPHPFramework` into
     *   `laravel_p_h_p_framework` rather than `laravel_phpframework`;
     * - the class is literally `[A-Z]`, so it is ASCII even in PHP. `Ł` is
     *   not a boundary upstream and must not be one here, which is why this
     *   walk does not go through `Unicode.isUpperCodepoint()` the way
     *   `ucsplit()` does.
     */
    private static delimitBeforeUpperAscii(
        value: string,
        delimiter: string,
    ): string {
        const parts = new Array<string>();
        let previous: string | undefined;

        for (const [, code] of utf8.codes(value)) {
            const character = utf8.char(code);

            if (
                previous !== undefined &&
                character.match("^[A-Z]$")[0] !== undefined
            ) {
                parts.push(delimiter);
            }

            previous = character;
            parts.push(character);
        }

        return parts.join("");
    }

    /**
     * Upper case the first character of each whitespace-delimited word, ASCII
     * only.
     *
     * PHP: the *global* `ucwords()`, which `Str::snake()` calls -- not
     * `Str::ucwords()`, which is Unicode-aware. Keeping them apart matters:
     * routing `snake()` through the Unicode version would make `żółtaŁódka`
     * snake into `żółta_łódka`, where upstream leaves it `żółtałódka`.
     */
    private static asciiUcwords(value: string): string {
        const parts = new Array<string>();
        let atBoundary = true;

        for (const [, code] of utf8.codes(value)) {
            const character = utf8.char(code);

            parts.push(atBoundary ? character.upper() : character);
            atBoundary = character.match("^[ \t\r\n\f\v]$")[0] !== undefined;
        }

        return parts.join("");
    }

    /** Convert a string to snake case. */
    public static snake(value: string, delimiter = "_"): string {
        const key = `${value} ${delimiter}`;
        const cached = Str.snakeCache.get(key);

        if (cached !== undefined) {
            return cached;
        }

        let result = value;

        // PHP: `! ctype_lower($value)` -- false for an empty string, and for
        // anything holding a character that is not an ASCII lower case letter.
        if (value.match("^[a-z]+$")[0] === undefined) {
            const [collapsed] = Str.asciiUcwords(value).gsub("%s+", "");

            result = Str.lower(
                Str.delimitBeforeUpperAscii(collapsed, delimiter),
            );
        }

        Str.snakeCache.set(key, result);

        return result;
    }

    /** Convert a string to kebab case. */
    public static kebab(value: string): string {
        return Str.snake(value, "-");
    }

    /** Convert the given string to a headline. */
    public static headline(value: string): string {
        const words = new Array<string>();

        for (const [word] of value.gmatch("%S+")) {
            words.push(word as string);
        }

        const parts = words.size() > 1 ? words : Str.ucsplit(words[0] ?? "");
        const titled = new Array<string>();

        for (const part of parts) {
            for (const [piece] of Str.replace(["-", "_"], " ", part).gmatch(
                "%S+",
            )) {
                titled.push(Str.title(piece as string));
            }
        }

        return titled.join(" ");
    }

    /** Get the initials of the words in the given string. */
    public static initials(value: string, capitalize = false): string {
        const parts = new Array<string>();

        for (const [word] of value.gmatch("%S+")) {
            parts.push(Str.substr(word as string, 0, 1));
        }

        const initials = parts.join("");

        return capitalize ? Str.upper(initials) : initials;
    }

    /** Convert the given string to APA-style title case. */
    public static apa(value: string): string {
        if (Str.trim(value) === "") {
            return value;
        }

        const minorWords = [
            "and",
            "as",
            "but",
            "for",
            "if",
            "nor",
            "or",
            "so",
            "yet",
            "a",
            "an",
            "the",
            "at",
            "by",
            "in",
            "of",
            "off",
            "on",
            "per",
            "to",
            "up",
            "via",
        ];
        const endPunctuation = [".", "!", "?", ":", "—", ","];
        const words = new Array<string>();

        for (const [word] of value.gmatch("%S+")) {
            words.push(word as string);
        }

        for (let index = 0; index < words.size(); index++) {
            const lowered = Str.lower(words[index]);

            if (Str.contains(lowered, "-")) {
                const pieces = new Array<string>();

                for (const piece of lowered.split("-")) {
                    pieces.push(
                        minorWords.includes(piece) && Str.length(piece) <= 3
                            ? piece
                            : Str.ucfirst(piece),
                    );
                }

                words[index] = pieces.join("-");

                continue;
            }

            const previous = index > 0 ? Str.substr(words[index - 1], -1) : "";

            words[index] =
                minorWords.includes(lowered) &&
                Str.length(lowered) <= 3 &&
                !(index === 0 || endPunctuation.includes(previous))
                    ? lowered
                    : Str.ucfirst(lowered);
        }

        return words.join(" ");
    }

    // -----------------------------------------------------------------
    // Words and limits
    // -----------------------------------------------------------------

    /**
     * Limit the number of characters in a string.
     *
     * PHP measures with `mb_strwidth()`/`mb_strimwidth()`, not with
     * `mb_strlen()`: the budget is display *width*, so a full-width CJK
     * character spends two of it. `Str::limit('这是一段中文', 6)` therefore cuts
     * after three characters, not six.
     *
     * `strip_tags()` off the front of the `$preserveWords` branch is not
     * ported -- there is no HTML on this runtime -- but the newline collapsing
     * and the outer trim beside it are.
     */
    public static limit(
        value: string,
        limit = 100,
        last = "...",
        preserveWords = false,
    ): string {
        if (Str.width(value) <= limit) {
            return value;
        }

        if (!preserveWords) {
            return `${Str.rtrim(Str.strimwidth(value, limit))}${last}`;
        }

        const [collapsed] = value.gsub("[\n\r]+", " ");
        const subject = Str.trim(collapsed);
        const trimmed = Str.rtrim(Str.strimwidth(subject, limit));

        // PHP indexes with `mb_substr()` here even though the cut above was by
        // width, so this reads a character offset, not a width offset.
        if (Str.substr(subject, limit, 1) === " ") {
            return `${trimmed}${last}`;
        }

        // PHP: `preg_replace("/(.*)\s.*/", '$1', $trimmed)` -- everything
        // before the last whitespace, or the string untouched when it holds
        // none, since then the pattern simply does not match.
        let cut: number | undefined;
        let from = 1;

        while (true) {
            const [found] = trimmed.find("%s", from);

            if (found === undefined) {
                break;
            }

            cut = found;
            from = found + 1;
        }

        return `${cut === undefined ? trimmed : trimmed.sub(1, cut - 1)}${last}`;
    }

    /**
     * The display width of a string.
     *
     * PHP: `mb_strwidth()`. The wide ranges are the ones `mbfl_charwidth()`
     * lists; everything else counts as one.
     */
    private static width(value: string): number {
        let total = 0;

        for (const [, code] of utf8.codes(value)) {
            total += Str.isWideCodepoint(code) ? 2 : 1;
        }

        return total;
    }

    /** Whether a codepoint spends two columns of `mb_strwidth()`'s budget. */
    private static isWideCodepoint(code: number): boolean {
        return (
            (code >= 0x1100 && code <= 0x115f) ||
            code === 0x2329 ||
            code === 0x232a ||
            (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xfe30 && code <= 0xfe6f) ||
            (code >= 0xff00 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6) ||
            (code >= 0x20000 && code <= 0x2fffd) ||
            (code >= 0x30000 && code <= 0x3fffd)
        );
    }

    /**
     * Take the leading characters of a string that fit in a width budget.
     *
     * PHP: `mb_strimwidth($value, 0, $width, '', 'UTF-8')`. A character that
     * would overrun the budget is left out whole.
     */
    private static strimwidth(value: string, width: number): string {
        let taken = 0;

        for (const [offset, code] of utf8.codes(value)) {
            const cost = Str.isWideCodepoint(code) ? 2 : 1;

            if (taken + cost > width) {
                return value.sub(1, offset - 1);
            }

            taken += cost;
        }

        return value;
    }

    /**
     * Limit the number of words in a string.
     *
     * PHP matches `/^\s*+(?:\S++\s*+){1,$words}/u` and hands back the subject
     * untouched whenever that fails to match -- which covers a string with no
     * words in it at all, and also a `$words` below one, where `{1,0}` and
     * `{1,-1}` are not quantifiers PCRE will run. The leading whitespace the
     * match keeps is why `words(' Taylor Otwell ', 1)` answers `' Taylor...'`
     * rather than trimming both ends.
     */
    public static words(value: string, words = 100, last = "..."): string {
        if (words < 1) {
            return value;
        }

        // `^\s*+`
        const [, leading] = value.find("^%s*");
        let cursor = (leading as number) + 1;
        let taken = 0;

        // `(?:\S++\s*+){1,$words}`
        while (taken < words) {
            const [wordStart, wordEnd] = value.find("^%S+", cursor);

            if (wordStart === undefined) {
                break;
            }

            const [, spaceEnd] = value.find("^%s*", (wordEnd as number) + 1);

            cursor = (spaceEnd as number) + 1;
            taken += 1;
        }

        // The quantifier's lower bound is one, so no word at all is no match.
        if (taken === 0) {
            return value;
        }

        const matched = value.sub(1, cursor - 1);

        if (Str.length(value) === Str.length(matched)) {
            return value;
        }

        return `${Str.rtrim(matched)}${last}`;
    }

    /** Get the number of words a string contains. */
    public static wordCount(value: string): number {
        let count = 0;

        for (const [] of value.gmatch("%S+")) {
            count += 1;
        }

        return count;
    }

    /** Wrap a string to a given number of characters. */
    public static wordWrap(
        value: string,
        characters = 75,
        brk = "\n",
        cutLongWords = false,
    ): string {
        const lines = new Array<string>();
        let current = "";

        for (const [rawWord] of value.gmatch("%S+")) {
            let word = rawWord as string;

            if (cutLongWords) {
                while (Str.length(word) > characters) {
                    if (current !== "") {
                        lines.push(current);
                        current = "";
                    }

                    lines.push(Str.substr(word, 0, characters));
                    word = Str.substr(word, characters);
                }
            }

            if (current === "") {
                current = word;
            } else if (
                Str.length(current) + 1 + Str.length(word) <=
                characters
            ) {
                current = `${current} ${word}`;
            } else {
                lines.push(current);
                current = word;
            }
        }

        if (current !== "") {
            lines.push(current);
        }

        return lines.join(brk);
    }

    /** Remove all non-numeric characters from a string. */
    public static numbers(value: string): string {
        const [result] = value.gsub("%D", "");

        return result;
    }

    // -----------------------------------------------------------------
    // Matching
    // -----------------------------------------------------------------

    /** Determine if a given string matches a given pattern, with `*` wildcards. */
    public static is(
        patterns: string | Array<string>,
        value: string,
        ignoreCase = false,
    ): boolean {
        const subject = ignoreCase ? value.lower() : value;

        // Not `Util.arrayWrap()`: it leans on `Util.isArray()`, which treats an
        // empty table as a single value because Luau cannot tell an empty array
        // from an empty object. That turns `is([], $value)` into a search for
        // one pattern that is itself a table. The parameter type already says
        // which of the two shapes this is, so ask it instead.
        const list = typeIs(patterns, "string") ? [patterns] : patterns;

        for (const raw of list) {
            const pattern = ignoreCase ? raw.lower() : raw;

            // If the given value is an exact match we can of course return true right
            // from the beginning. Otherwise, we will translate asterisks and do an
            // actual pattern match against the two strings to see if they match.
            if (pattern === "*" || pattern === subject) {
                return true;
            }

            const [quoted] = pattern.gsub(MAGIC, "%%%1");
            const [expression] = quoted.gsub("%%%*", ".*");
            const [matched] = subject.match(`^${expression}$`);

            if (matched !== undefined) {
                return true;
            }
        }

        return false;
    }

    /** Get the string matching the given Luau pattern. */
    public static match(pattern: string, subject: string): string {
        const [matched] = subject.match(pattern);

        return matched !== undefined ? tostring(matched) : "";
    }

    /** Determine if a given string matches a given Luau pattern. */
    public static isMatch(
        patterns: string | Array<string>,
        value: string,
    ): boolean {
        for (const pattern of Util.arrayWrap(patterns)) {
            const [matched] = value.match(pattern);

            if (matched !== undefined) {
                return true;
            }
        }

        return false;
    }

    /** Get all strings matching the given Luau pattern. */
    public static matchAll(
        pattern: string,
        subject: string,
    ): Collection<number, string> {
        const matches = new Array<string>();

        for (const [matched] of subject.gmatch(pattern)) {
            matches.push(tostring(matched));
        }

        return new Collection(matches);
    }

    /** Determine if the given string is 7-bit ASCII. */
    public static isAscii(value: string): boolean {
        return value.match("^[\x00-\x7F]*$")[0] !== undefined;
    }

    /** Determine if the given string is valid JSON. */
    public static isJson(value: string): boolean {
        const [ok] = pcall(() =>
            game.GetService("HttpService").JSONDecode(value),
        );

        return ok;
    }

    /** Determine if the given string looks like a URL. */
    public static isUrl(value: string, protocols: Array<string> = []): boolean {
        const [scheme, rest] = value.match("^(%a[%w+.-]*)://(.+)$");

        if (scheme === undefined || rest === undefined) {
            return false;
        }

        if (
            !protocols.isEmpty() &&
            !protocols.includes(tostring(scheme).lower())
        ) {
            return false;
        }

        return (
            tostring(rest).size() > 0 &&
            Str.contains(tostring(rest), " ") === false
        );
    }

    /** Determine if the given string is a valid UUID. */
    public static isUuid(value: string): boolean {
        return (
            value.match(
                "^%x%x%x%x%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x$",
            )[0] !== undefined
        );
    }

    /** Determine if the given string is a valid ULID. */
    public static isUlid(value: string): boolean {
        if (value.size() !== 26) {
            return false;
        }

        return value.upper().match("^[0-9A-HJKMNP-TV-Z]+$")[0] !== undefined;
    }

    // -----------------------------------------------------------------
    // Generating
    // -----------------------------------------------------------------

    /** Generate a more truly "random" alpha-numeric string. */
    public static random(length = 16): string {
        const alphabet = `${LOWER_ALPHABET}${UPPER_ALPHABET}${DIGITS}`;
        const characters = new Array<string>();

        for (let index = 0; index < length; index++) {
            const at = math.random(1, alphabet.size());

            characters.push(alphabet.sub(at, at));
        }

        return characters.join("");
    }

    /** Generate a random, secure password. */
    public static password(
        length = 32,
        letters = true,
        numbers = true,
        symbols = true,
        spaces = false,
    ): string {
        const pools = new Array<string>();

        if (letters) {
            pools.push(`${LOWER_ALPHABET}${UPPER_ALPHABET}`);
        }

        if (numbers) {
            pools.push(DIGITS);
        }

        if (symbols) {
            pools.push(SYMBOLS);
        }

        if (spaces) {
            pools.push(" ");
        }

        if (pools.isEmpty()) {
            return "";
        }

        const characters = new Array<string>();

        // One character from each requested pool, so every pool is represented.
        for (const pool of pools) {
            const at = math.random(1, pool.size());

            characters.push(pool.sub(at, at));
        }

        const combined = pools.join("");

        while (characters.size() < length) {
            const at = math.random(1, combined.size());

            characters.push(combined.sub(at, at));
        }

        for (let index = characters.size() - 1; index > 0; index--) {
            const swap = math.random(0, index);
            const held = characters[index];

            characters[index] = characters[swap];
            characters[swap] = held;
        }

        return characters.join("");
    }

    /** Generate a UUID (version 4). */
    public static uuid(): string {
        return Str.lower(game.GetService("HttpService").GenerateGUID(false));
    }

    /**
     * Generate a time-ordered UUID.
     *
     * PHP uses a COMB codec over a proper v4; this replaces the leading bytes
     * with a millisecond timestamp, which sorts the same way.
     */
    public static orderedUuid(): string {
        const milliseconds = math.floor(os.clock() * 1000) % 0xffffffffff;
        const prefix = string.format("%012x", milliseconds);
        const random = Str.remove("-", Str.uuid());

        return `${prefix.sub(1, 8)}-${prefix.sub(9, 12)}-${random.sub(13, 16)}-${random.sub(17, 20)}-${random.sub(21, 32)}`;
    }

    /** Generate a ULID. */
    public static ulid(): string {
        const characters = new Array<string>();
        let timestamp = math.floor(os.time() * 1000);

        for (let index = 0; index < 10; index++) {
            const remainder = timestamp % 32;

            characters.unshift(CROCKFORD.sub(remainder + 1, remainder + 1));
            timestamp = math.floor(timestamp / 32);
        }

        for (let index = 0; index < 16; index++) {
            const at = math.random(1, 32);

            characters.push(CROCKFORD.sub(at, at));
        }

        return characters.join("");
    }

    // -----------------------------------------------------------------
    // Encoding
    // -----------------------------------------------------------------

    /** Convert the given string to base64. */
    public static toBase64(value: string): string {
        const output = new Array<string>();

        for (let index = 0; index < value.size(); index += 3) {
            const first = value.byte(index + 1)[0] as number;
            const second = value.byte(index + 2)[0];
            const third = value.byte(index + 3)[0];

            const bits = bit32.bor(
                bit32.lshift(first, 16),
                bit32.lshift(second ?? 0, 8),
                third ?? 0,
            );

            output.push(
                BASE64_ALPHABET.sub(
                    bit32.extract(bits, 18, 6) + 1,
                    bit32.extract(bits, 18, 6) + 1,
                ),
            );
            output.push(
                BASE64_ALPHABET.sub(
                    bit32.extract(bits, 12, 6) + 1,
                    bit32.extract(bits, 12, 6) + 1,
                ),
            );
            output.push(
                second === undefined
                    ? "="
                    : BASE64_ALPHABET.sub(
                          bit32.extract(bits, 6, 6) + 1,
                          bit32.extract(bits, 6, 6) + 1,
                      ),
            );
            output.push(
                third === undefined
                    ? "="
                    : BASE64_ALPHABET.sub(
                          bit32.extract(bits, 0, 6) + 1,
                          bit32.extract(bits, 0, 6) + 1,
                      ),
            );
        }

        return output.join("");
    }

    /** Decode the given base64 encoded string. */
    public static fromBase64(value: string): string {
        const [cleaned] = value.gsub("[^%w+/=]", "");
        const output = new Array<string>();

        for (let index = 0; index < cleaned.size(); index += 4) {
            const chunk = cleaned.sub(index + 1, index + 4);
            let bits = 0;
            let padding = 0;

            for (let offset = 0; offset < 4; offset++) {
                const character = chunk.sub(offset + 1, offset + 1);

                if (character === "=" || character === "") {
                    padding += 1;
                    bits = bit32.lshift(bits, 6);

                    continue;
                }

                const [position] = BASE64_ALPHABET.find(character, 1, true);

                bits = bit32.bor(
                    bit32.lshift(bits, 6),
                    (position as number) - 1,
                );
            }

            const bytes = [
                bit32.extract(bits, 16, 8),
                bit32.extract(bits, 8, 8),
                bit32.extract(bits, 0, 8),
            ];

            for (let offset = 0; offset < 3 - padding; offset++) {
                output.push(string.char(bytes[offset]));
            }
        }

        return output.join("");
    }

    // -----------------------------------------------------------------
    // Transliteration and slugs
    // -----------------------------------------------------------------

    /** Transliterate a string to its closest ASCII representation. */
    public static ascii(value: string): string {
        let result = value;

        for (const [from, to] of ASCII_TABLE) {
            result = Str.replaceAllPlain(result, from, to);
        }

        const [stripped] = result.gsub("[\x80-\xFF]", "");

        return stripped;
    }

    /** Generate a URL friendly "slug" from a given string. */
    public static slug(
        title: string,
        separator = "-",
        dictionary: Array<[string, string]> = [["@", "at"]],
    ): string {
        let result = Str.ascii(title);

        // Convert all dashes/underscores into the separator.
        const flip = separator === "-" ? "_" : "-";
        const [quotedFlip] = flip.gsub(MAGIC, "%%%1");
        const [flipped] = result.gsub(`${quotedFlip}+`, separator);

        result = flipped;

        for (const [from, to] of dictionary) {
            result = Str.replaceAllPlain(
                result,
                from,
                `${separator}${to}${separator}`,
            );
        }

        const [quotedSeparator] = separator.gsub(MAGIC, "%%%1");
        const [cleaned] = Str.lower(result).gsub(
            `[^${quotedSeparator}%w%s]+`,
            "",
        );
        const [collapsed] = cleaned.gsub(`[${quotedSeparator}%s]+`, separator);

        return Str.trim(collapsed, separator);
    }

    // -----------------------------------------------------------------
    // Inflection
    // -----------------------------------------------------------------

    /** Get the plural form of an English word. */
    public static plural(value: string, count = 2): string {
        return Pluralizer.plural(value, count);
    }

    /** Get the singular form of an English word. */
    public static singular(value: string): string {
        return Pluralizer.singular(value);
    }

    /** Pluralize the last word of an English, studly caps case string. */
    public static pluralStudly(value: string, count = 2): string {
        const parts = Str.ucsplit(value);

        if (parts.isEmpty()) {
            return value;
        }

        const lastWord = parts.pop() as string;

        return `${parts.join("")}${Str.plural(lastWord, count)}`;
    }

    /** Pluralize the last word of an English, pascal case string. */
    public static pluralPascal(value: string, count = 2): string {
        return Str.pluralStudly(value, count);
    }

    // -----------------------------------------------------------------
    // Misc
    // -----------------------------------------------------------------

    /** Parse a Class@method style callback into class and method. */
    public static parseCallback(
        callback: string,
        defaultMethod?: string,
    ): [string, string | undefined] {
        if (!Str.contains(callback, "@")) {
            return [callback, defaultMethod];
        }

        const segments = callback.split("@");

        return [segments[0], segments[1]];
    }

    /** Remove all strings from the casing caches. */
    public static flushCache(): void {
        Str.snakeCache.clear();
        Str.camelCache.clear();
        Str.studlyCache.clear();
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /** Find the byte position of the last occurrence, 1-based. */
    private static lastIndexOf(
        haystack: string,
        needle: string,
    ): number | undefined {
        let position: number | undefined;
        let from = 1;

        while (true) {
            const [found] = haystack.find(needle, from, true);

            if (found === undefined) {
                break;
            }

            position = found;

            // Step one byte, not past the whole match: PHP's `strrpos()`
            // counts overlapping occurrences, so `afterLast('----foo', '---')`
            // has to find the match at offset 2, not stop at the one at 1.
            from = found + 1;
        }

        return position;
    }

    /** Replace every plain (non-pattern) occurrence of a substring. */
    private static replaceAllPlain(
        subject: string,
        search: string,
        replace: string,
    ): string {
        if (search === "") {
            return subject;
        }

        const parts = subject.split(search);

        return parts.join(replace);
    }

    /** Build a pad of the given length out of the given filler. */
    private static buildPad(pad: string, length: number): string {
        if (length <= 0 || pad === "") {
            return "";
        }

        return Str.substr(
            pad.rep(math.ceil(length / Str.length(pad))),
            0,
            length,
        );
    }

    /** Escape the given characters for use inside a Luau character class. */
    private static characterClass(characters: string): string {
        const [escaped] = characters.gsub("([%%%]%^%-])", "%%%1");

        return escaped;
    }
}

/**
 * PHP: the `$callback` / `$default` pair every `Stringable::when*()` takes.
 *
 * `Conditionable` hands a callback the target and the condition that was
 * tested, and takes a callback returning nothing to mean "keep the instance".
 */
export type WhenCallback<TReturn extends defined> = (
    target: Stringable,
    value: boolean,
) => TReturn | undefined;

/**
 * PHP: `Illuminate\Support\Stringable`.
 *
 * A fluent wrapper over `Str`: nearly every method delegates to the static of
 * the same name and hands back a new instance, so what `Str` lives with --
 * Luau patterns instead of PCRE, ASCII-only case folding -- holds here too.
 *
 * **The class lives in `Str.ts` because the two need each other.** `Str::of()`
 * builds a `Stringable`, and every `Stringable` method calls `Str`; PHP closes
 * that circle with autoloading, Luau cannot -- a cyclic *value* import kills
 * the whole module (see `agent_docs/roblox-ts-constraints.md`). Splitting them
 * would mean `Str::of()` could not exist. `Illuminate/Support/Stringable`
 * re-exports the class, so the import path still matches the PHP one.
 *
 * Not ported: `markdown`, `inlineMarkdown`, `transliterate`, `stripTags` (no
 * HTML), `scan` (no `sscanf`), `hash`, `encrypt`/`decrypt`, `toDate` (no
 * `Date`), `toUri`, `toHtmlString`, `dump`, `basename`/`dirname` (no
 * filesystem), `classBasename` (a compiled class name carries no namespace,
 * and `class_basename` lives in `Helpers`, which imports this module), the
 * `ArrayAccess` methods and `__get` (no operator overloading), `Macroable`.
 */
export class Stringable
    extends Tappable(Conditionable())
    implements JsonSerializable
{
    /**
     * The underlying string value.
     *
     * PHP names it `$value`; a field and a method cannot share a name here --
     * both live in one table -- and `value()` is the public API. The same
     * trade produced `Container::sharedInstance`.
     */
    protected stringValue: string;

    /** Create a new instance of the class. */
    public constructor(value: string | number | Stringable = "") {
        super();

        this.stringValue = tostring(value);
    }

    // -----------------------------------------------------------------
    // Slicing
    // -----------------------------------------------------------------

    /** Return the remainder of the string after the first occurrence of a value. */
    public after(search: string): Stringable {
        return new Stringable(Str.after(this.stringValue, search));
    }

    /** Return the remainder of the string after the last occurrence of a value. */
    public afterLast(search: string): Stringable {
        return new Stringable(Str.afterLast(this.stringValue, search));
    }

    /** Get the portion of the string before the first occurrence of a value. */
    public before(search: string): Stringable {
        return new Stringable(Str.before(this.stringValue, search));
    }

    /** Get the portion of the string before the last occurrence of a value. */
    public beforeLast(search: string): Stringable {
        return new Stringable(Str.beforeLast(this.stringValue, search));
    }

    /** Get the portion of the string between two given values. */
    public between(from: string, to: string): Stringable {
        return new Stringable(Str.between(this.stringValue, from, to));
    }

    /** Get the smallest possible portion of the string between two values. */
    public betweenFirst(from: string, to: string): Stringable {
        return new Stringable(Str.betweenFirst(this.stringValue, from, to));
    }

    /** Get the character at the specified index. */
    public charAt(index: number): string | undefined {
        return Str.charAt(this.stringValue, index);
    }

    /** Returns the portion of the string specified by the start and length. */
    public substr(start: number, length?: number): Stringable {
        return new Stringable(Str.substr(this.stringValue, start, length));
    }

    /** Take the first or last given number of characters. */
    public take(limit: number): Stringable {
        if (limit < 0) {
            return this.substr(limit);
        }

        return this.substr(0, limit);
    }

    /** Reverse the string. */
    public reverse(): Stringable {
        return new Stringable(Str.reverse(this.stringValue));
    }

    /** Return the length of the string, in codepoints. */
    public length(): number {
        return Str.length(this.stringValue);
    }

    /** Find the position of the first occurrence of a substring. */
    public position(needle: string, offset = 0): number | undefined {
        return Str.position(this.stringValue, needle, offset);
    }

    // -----------------------------------------------------------------
    // Searching
    // -----------------------------------------------------------------

    /** Determine if the string contains a given substring. */
    public contains(
        needles: string | Array<string>,
        ignoreCase = false,
    ): boolean {
        return Str.contains(this.stringValue, needles, ignoreCase);
    }

    /** Determine if the string contains all of the given values. */
    public containsAll(needles: Array<string>, ignoreCase = false): boolean {
        return Str.containsAll(this.stringValue, needles, ignoreCase);
    }

    /** Determine if the string doesn't contain a given substring. */
    public doesntContain(
        needles: string | Array<string>,
        ignoreCase = false,
    ): boolean {
        return Str.doesntContain(this.stringValue, needles, ignoreCase);
    }

    /** Determine if the string starts with a given substring. */
    public startsWith(needles: string | Array<string>): boolean {
        return Str.startsWith(this.stringValue, needles);
    }

    /** Determine if the string doesn't start with a given substring. */
    public doesntStartWith(needles: string | Array<string>): boolean {
        return Str.doesntStartWith(this.stringValue, needles);
    }

    /** Determine if the string ends with a given substring. */
    public endsWith(needles: string | Array<string>): boolean {
        return Str.endsWith(this.stringValue, needles);
    }

    /** Determine if the string doesn't end with a given substring. */
    public doesntEndWith(needles: string | Array<string>): boolean {
        return Str.doesntEndWith(this.stringValue, needles);
    }

    /** Count the number of substring occurrences. */
    public substrCount(needle: string): number {
        return Str.substrCount(this.stringValue, needle);
    }

    /** Extract an excerpt matching the first instance of a phrase. */
    public excerpt(
        phrase = "",
        radius = 100,
        omission = "...",
    ): string | undefined {
        return Str.excerpt(this.stringValue, phrase, radius, omission);
    }

    /** Determine if the string is an exact match with the given value. */
    public exactly(value: string | Stringable): boolean {
        return this.stringValue === tostring(value);
    }

    /** Determine if the string matches a given pattern, with `*` wildcards. */
    public is(pattern: string | Array<string>, ignoreCase = false): boolean {
        return Str.is(pattern, this.stringValue, ignoreCase);
    }

    /** Determine if the string is empty. */
    public isEmpty(): boolean {
        return this.stringValue === "";
    }

    /** Determine if the string is not empty. */
    public isNotEmpty(): boolean {
        return !this.isEmpty();
    }

    /** Determine if the string is 7-bit ASCII. */
    public isAscii(): boolean {
        return Str.isAscii(this.stringValue);
    }

    /** Determine if the string is valid JSON. */
    public isJson(): boolean {
        return Str.isJson(this.stringValue);
    }

    /** Determine if the string is a valid URL. */
    public isUrl(protocols: Array<string> = []): boolean {
        return Str.isUrl(this.stringValue, protocols);
    }

    /** Determine if the string is a valid UUID. */
    public isUuid(): boolean {
        return Str.isUuid(this.stringValue);
    }

    /** Determine if the string is a valid ULID. */
    public isUlid(): boolean {
        return Str.isUlid(this.stringValue);
    }

    // -----------------------------------------------------------------
    // Replacing
    // -----------------------------------------------------------------

    /** Replace all occurrences of the search string with the replacement. */
    public replace(
        search: string | Array<string>,
        replace: string | Array<string>,
    ): Stringable {
        return new Stringable(Str.replace(search, replace, this.stringValue));
    }

    /** Replace a given value in the string sequentially with an array. */
    public replaceArray(search: string, replace: Array<string>): Stringable {
        return new Stringable(
            Str.replaceArray(search, replace, this.stringValue),
        );
    }

    /** Replace the first occurrence of a given value in the string. */
    public replaceFirst(search: string, replace: string): Stringable {
        return new Stringable(
            Str.replaceFirst(search, replace, this.stringValue),
        );
    }

    /** Replace the first occurrence of the given value if it starts the string. */
    public replaceStart(search: string, replace: string): Stringable {
        return new Stringable(
            Str.replaceStart(search, replace, this.stringValue),
        );
    }

    /** Replace the last occurrence of a given value in the string. */
    public replaceLast(search: string, replace: string): Stringable {
        return new Stringable(
            Str.replaceLast(search, replace, this.stringValue),
        );
    }

    /** Replace the last occurrence of the given value if it ends the string. */
    public replaceEnd(search: string, replace: string): Stringable {
        return new Stringable(
            Str.replaceEnd(search, replace, this.stringValue),
        );
    }

    /** Replace the patterns matching the given Luau pattern. */
    public replaceMatches(
        pattern: string,
        replace: string | ((match: string) => string),
        limit?: number,
    ): Stringable {
        return new Stringable(
            Str.replaceMatches(pattern, replace, this.stringValue, limit),
        );
    }

    /** Remove any occurrence of the given string. */
    public remove(search: string | Array<string>): Stringable {
        return new Stringable(Str.remove(search, this.stringValue));
    }

    /** Swap keys with their values within the string. */
    public swap(map: Array<[string, string]>): Stringable {
        return new Stringable(Str.swap(map, this.stringValue));
    }

    /** Replace consecutive instances of a given character with a single one. */
    public deduplicate(characters: string | Array<string> = " "): Stringable {
        return new Stringable(Str.deduplicate(this.stringValue, characters));
    }

    // -----------------------------------------------------------------
    // Wrapping and padding
    // -----------------------------------------------------------------

    /** Begin the string with a single instance of a given value. */
    public start(prefix: string): Stringable {
        return new Stringable(Str.start(this.stringValue, prefix));
    }

    /** Cap the string with a single instance of a given value. */
    public finish(cap: string): Stringable {
        return new Stringable(Str.finish(this.stringValue, cap));
    }

    /** Wrap the string with the given strings. */
    public wrap(before: string, after?: string): Stringable {
        return new Stringable(Str.wrap(this.stringValue, before, after));
    }

    /** Unwrap the string with the given strings. */
    public unwrap(before: string, after?: string): Stringable {
        return new Stringable(Str.unwrap(this.stringValue, before, after));
    }

    /** Remove the given string(s) from the start of the subject. */
    public chopStart(needle: string | Array<string>): Stringable {
        return new Stringable(Str.chopStart(this.stringValue, needle));
    }

    /** Remove the given string(s) from the end of the subject. */
    public chopEnd(needle: string | Array<string>): Stringable {
        return new Stringable(Str.chopEnd(this.stringValue, needle));
    }

    /** Pad both sides of the string with another. */
    public padBoth(length: number, pad = " "): Stringable {
        return new Stringable(Str.padBoth(this.stringValue, length, pad));
    }

    /** Pad the left side of the string with another. */
    public padLeft(length: number, pad = " "): Stringable {
        return new Stringable(Str.padLeft(this.stringValue, length, pad));
    }

    /** Pad the right side of the string with another. */
    public padRight(length: number, pad = " "): Stringable {
        return new Stringable(Str.padRight(this.stringValue, length, pad));
    }

    /** Repeat the string. */
    public repeat(times: number): Stringable {
        return new Stringable(this.stringValue.rep(times));
    }

    /** Mask a portion of the string with a repeated character. */
    public mask(character: string, index: number, length?: number): Stringable {
        return new Stringable(
            Str.mask(this.stringValue, character, index, length),
        );
    }

    /** Replace text within a portion of the string. */
    public substrReplace(
        replace: string,
        offset = 0,
        length?: number,
    ): Stringable {
        return new Stringable(
            Str.substrReplace(this.stringValue, replace, offset, length),
        );
    }

    /** Append the given values to the string. */
    public append(...values: Array<string>): Stringable {
        return new Stringable(`${this.stringValue}${values.join("")}`);
    }

    /** Prepend the given values to the string. */
    public prepend(...values: Array<string>): Stringable {
        return new Stringable(`${values.join("")}${this.stringValue}`);
    }

    /**
     * Append a new line to the string.
     *
     * PHP appends `PHP_EOL`, which is what the platform ends a line with;
     * Roblox has one platform, and it ends a line with `\n`.
     */
    public newLine(count = 1): Stringable {
        return this.append("\n".rep(count));
    }

    // -----------------------------------------------------------------
    // Trimming
    // -----------------------------------------------------------------

    /** Remove all whitespace, or the given characters, from both ends. */
    public trim(characters?: string): Stringable {
        return new Stringable(Str.trim(this.stringValue, characters));
    }

    /** Remove all whitespace, or the given characters, from the beginning. */
    public ltrim(characters?: string): Stringable {
        return new Stringable(Str.ltrim(this.stringValue, characters));
    }

    /** Remove all whitespace, or the given characters, from the end. */
    public rtrim(characters?: string): Stringable {
        return new Stringable(Str.rtrim(this.stringValue, characters));
    }

    /** Remove all extraneous whitespace from the string. */
    public squish(): Stringable {
        return new Stringable(Str.squish(this.stringValue));
    }

    // -----------------------------------------------------------------
    // Case
    // -----------------------------------------------------------------

    /** Convert the string to lower case. */
    public lower(): Stringable {
        return new Stringable(Str.lower(this.stringValue));
    }

    /** Convert the string to upper case. */
    public upper(): Stringable {
        return new Stringable(Str.upper(this.stringValue));
    }

    /** Convert the case of the string. */
    public convertCase(
        mode: "lower" | "upper" | "title" = "lower",
    ): Stringable {
        return new Stringable(Str.convertCase(this.stringValue, mode));
    }

    /** Convert the string to title case. */
    public title(): Stringable {
        return new Stringable(Str.title(this.stringValue));
    }

    /** Convert the string to title case for each word. */
    public headline(): Stringable {
        return new Stringable(Str.headline(this.stringValue));
    }

    /** Convert the string to APA-style title case. */
    public apa(): Stringable {
        return new Stringable(Str.apa(this.stringValue));
    }

    /** Get the initials of the words in the string. */
    public initials(capitalize = false): Stringable {
        return new Stringable(Str.initials(this.stringValue, capitalize));
    }

    /** Make the first character of the string lower case. */
    public lcfirst(): Stringable {
        return new Stringable(Str.lcfirst(this.stringValue));
    }

    /** Make the first character of the string upper case. */
    public ucfirst(): Stringable {
        return new Stringable(Str.ucfirst(this.stringValue));
    }

    /** Make the first character of each word upper case. */
    public ucwords(separators = " \t\r\n\f\v"): Stringable {
        return new Stringable(Str.ucwords(this.stringValue, separators));
    }

    /** Split the string into pieces by upper case characters. */
    public ucsplit(): Collection<number, string> {
        return new Collection(Str.ucsplit(this.stringValue));
    }

    /** Convert the string to camel case. */
    public camel(): Stringable {
        return new Stringable(Str.camel(this.stringValue));
    }

    /** Convert the string to studly caps case. */
    public studly(): Stringable {
        return new Stringable(Str.studly(this.stringValue));
    }

    /** Convert the string to pascal case. */
    public pascal(): Stringable {
        return new Stringable(Str.pascal(this.stringValue));
    }

    /** Convert the string to snake case. */
    public snake(delimiter = "_"): Stringable {
        return new Stringable(Str.snake(this.stringValue, delimiter));
    }

    /** Convert the string to kebab case. */
    public kebab(): Stringable {
        return new Stringable(Str.kebab(this.stringValue));
    }

    // -----------------------------------------------------------------
    // Words and limits
    // -----------------------------------------------------------------

    /** Limit the number of characters in the string. */
    public limit(limit = 100, last = "...", preserveWords = false): Stringable {
        return new Stringable(
            Str.limit(this.stringValue, limit, last, preserveWords),
        );
    }

    /** Limit the number of words in the string. */
    public words(words = 100, last = "..."): Stringable {
        return new Stringable(Str.words(this.stringValue, words, last));
    }

    /** Get the number of words the string contains. */
    public wordCount(): number {
        return Str.wordCount(this.stringValue);
    }

    /** Wrap the string to a given number of characters. */
    public wordWrap(
        characters = 75,
        brk = "\n",
        cutLongWords = false,
    ): Stringable {
        return new Stringable(
            Str.wordWrap(this.stringValue, characters, brk, cutLongWords),
        );
    }

    /** Remove all non-numeric characters from the string. */
    public numbers(): Stringable {
        return new Stringable(Str.numbers(this.stringValue));
    }

    // -----------------------------------------------------------------
    // Matching
    // -----------------------------------------------------------------

    /** Get the string matching the given Luau pattern. */
    public match(pattern: string): Stringable {
        return new Stringable(Str.match(pattern, this.stringValue));
    }

    /** Determine if the string matches the given Luau pattern. */
    public isMatch(pattern: string | Array<string>): boolean {
        return Str.isMatch(pattern, this.stringValue);
    }

    /** Get all strings matching the given Luau pattern. */
    public matchAll(pattern: string): Collection<number, string> {
        return Str.matchAll(pattern, this.stringValue);
    }

    /** Determine if the string matches the given Luau pattern. */
    public test(pattern: string): boolean {
        return this.isMatch(pattern);
    }

    // -----------------------------------------------------------------
    // Splitting
    // -----------------------------------------------------------------

    /**
     * Explode the string into a collection.
     *
     * PHP's `$limit` keeps all three of its meanings: a positive limit caps
     * the number of pieces and leaves the rest of the string in the last one,
     * a negative limit drops that many pieces off the end, and zero counts as
     * one. `PHP_INT_MAX` becomes `math.huge`.
     */
    public explode(
        delimiter: string,
        limit = math.huge,
    ): Collection<number, string> {
        const segments = this.stringValue.split(delimiter);

        if (limit === math.huge) {
            return new Collection(segments);
        }

        if (limit < 0) {
            const kept = new Array<string>();

            for (let index = 0; index < segments.size() + limit; index++) {
                kept.push(segments[index]);
            }

            return new Collection(kept);
        }

        const capped = math.max(limit, 1);

        if (segments.size() <= capped) {
            return new Collection(segments);
        }

        const kept = new Array<string>();

        for (let index = 0; index < capped - 1; index++) {
            kept.push(segments[index]);
        }

        const rest = new Array<string>();

        for (let index = capped - 1; index < segments.size(); index++) {
            rest.push(segments[index]);
        }

        kept.push(rest.join(delimiter));

        return new Collection(kept);
    }

    /**
     * Split the string using a Luau pattern, or into chunks of a given size.
     *
     * PHP sends an integer-like pattern to `mb_str_split` and everything else
     * to `preg_split`; the same fork is here, with a Luau pattern in place of
     * the expression. The flags of `preg_split` have no counterpart -- an
     * empty piece is always kept.
     */
    public split(
        pattern: string | number,
        limit = -1,
    ): Collection<number, string> {
        if (typeIs(pattern, "number")) {
            const chunks = new Array<string>();
            const size = math.max(pattern, 1);
            const total = Str.length(this.stringValue);

            for (let index = 0; index < total; index += size) {
                chunks.push(Str.substr(this.stringValue, index, size));
            }

            return new Collection(chunks);
        }

        const segments = new Array<string>();
        let start = 1;
        let cursor = 1;

        while (limit <= 0 || segments.size() < limit - 1) {
            const [from, to] = this.stringValue.find(pattern, cursor);

            if (from === undefined || to === undefined) {
                break;
            }

            // A zero-width match cuts between two characters, and would be
            // found in the same place forever if the cursor stayed put.
            if (to < from) {
                cursor = from + 1;

                if (from > start) {
                    segments.push(this.stringValue.sub(start, from - 1));
                    start = from;
                }

                continue;
            }

            segments.push(this.stringValue.sub(start, from - 1));
            start = to + 1;
            cursor = start;
        }

        segments.push(this.stringValue.sub(start));

        return new Collection(segments);
    }

    // -----------------------------------------------------------------
    // Encoding
    // -----------------------------------------------------------------

    /** Convert the string to base64. */
    public toBase64(): Stringable {
        return new Stringable(Str.toBase64(this.stringValue));
    }

    /** Decode the base64 encoded string. */
    public fromBase64(): Stringable {
        return new Stringable(Str.fromBase64(this.stringValue));
    }

    // -----------------------------------------------------------------
    // Inflection
    // -----------------------------------------------------------------

    /** Get the plural form of the English word. */
    public plural(count = 2): Stringable {
        return new Stringable(Str.plural(this.stringValue, count));
    }

    /** Get the singular form of the English word. */
    public singular(): Stringable {
        return new Stringable(Str.singular(this.stringValue));
    }

    /** Pluralize the last word of an English, studly caps case string. */
    public pluralStudly(count = 2): Stringable {
        return new Stringable(Str.pluralStudly(this.stringValue, count));
    }

    /** Pluralize the last word of an English, pascal case string. */
    public pluralPascal(count = 2): Stringable {
        return new Stringable(Str.pluralPascal(this.stringValue, count));
    }

    /** Transliterate the string to its closest ASCII representation. */
    public ascii(): Stringable {
        return new Stringable(Str.ascii(this.stringValue));
    }

    /** Generate a URL friendly "slug" from the string. */
    public slug(
        separator = "-",
        dictionary: Array<[string, string]> = [["@", "at"]],
    ): Stringable {
        return new Stringable(
            Str.slug(this.stringValue, separator, dictionary),
        );
    }

    // -----------------------------------------------------------------
    // Conditionals
    // -----------------------------------------------------------------

    /** Execute the given callback if the string contains a given substring. */
    public whenContains<TReturn extends defined>(
        needles: string | Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.contains(needles), callback, defaultCallback);
    }

    /** Execute the given callback if the string contains all array values. */
    public whenContainsAll<TReturn extends defined>(
        needles: Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.containsAll(needles), callback, defaultCallback);
    }

    /** Execute the given callback if the string is empty. */
    public whenEmpty<TReturn extends defined>(
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.isEmpty(), callback, defaultCallback);
    }

    /** Execute the given callback if the string is not empty. */
    public whenNotEmpty<TReturn extends defined>(
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.isNotEmpty(), callback, defaultCallback);
    }

    /** Execute the given callback if the string ends with a given substring. */
    public whenEndsWith<TReturn extends defined>(
        needles: string | Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.endsWith(needles), callback, defaultCallback);
    }

    /** Execute the given callback if the string doesn't end with a given substring. */
    public whenDoesntEndWith<TReturn extends defined>(
        needles: string | Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(
            this.doesntEndWith(needles),
            callback,
            defaultCallback,
        );
    }

    /** Execute the given callback if the string is an exact match with the given value. */
    public whenExactly<TReturn extends defined>(
        value: string | Stringable,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.exactly(value), callback, defaultCallback);
    }

    /** Execute the given callback if the string is not an exact match with the given value. */
    public whenNotExactly<TReturn extends defined>(
        value: string | Stringable,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(!this.exactly(value), callback, defaultCallback);
    }

    /** Execute the given callback if the string matches a given pattern. */
    public whenIs<TReturn extends defined>(
        pattern: string | Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.is(pattern), callback, defaultCallback);
    }

    /** Execute the given callback if the string is 7-bit ASCII. */
    public whenIsAscii<TReturn extends defined>(
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.isAscii(), callback, defaultCallback);
    }

    /** Execute the given callback if the string is a valid UUID. */
    public whenIsUuid<TReturn extends defined>(
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.isUuid(), callback, defaultCallback);
    }

    /** Execute the given callback if the string is a valid ULID. */
    public whenIsUlid<TReturn extends defined>(
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.isUlid(), callback, defaultCallback);
    }

    /** Execute the given callback if the string starts with a given substring. */
    public whenStartsWith<TReturn extends defined>(
        needles: string | Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.startsWith(needles), callback, defaultCallback);
    }

    /** Execute the given callback if the string doesn't start with a given substring. */
    public whenDoesntStartWith<TReturn extends defined>(
        needles: string | Array<string>,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(
            this.doesntStartWith(needles),
            callback,
            defaultCallback,
        );
    }

    /** Execute the given callback if the string matches the given Luau pattern. */
    public whenTest<TReturn extends defined>(
        pattern: string,
        callback: WhenCallback<TReturn>,
        defaultCallback?: WhenCallback<TReturn>,
    ): this | TReturn {
        return this.when(this.test(pattern), callback, defaultCallback);
    }

    // -----------------------------------------------------------------
    // Conversion
    // -----------------------------------------------------------------

    /** Pass the string to the given callback and get a new instance back. */
    public pipe(
        callback: (target: Stringable) => string | number | Stringable,
    ): Stringable {
        return new Stringable(callback(this));
    }

    /** Parse a Class@method style callback into class and method. */
    public parseCallback(defaultMethod?: string): [string, string | undefined] {
        return Str.parseCallback(this.stringValue, defaultMethod);
    }

    /** Get the underlying string value. */
    public value(): string {
        return this.toString();
    }

    /** Get the underlying string value. */
    public toString(): string {
        return this.stringValue;
    }

    /**
     * Get the underlying string value as an integer.
     *
     * PHP reads the leading digits and answers `0` for anything else; Luau
     * wants the whole string to be a number, so `"12abc"` is `0` here where
     * PHP says `12`.
     */
    public toInteger(base = 10): number {
        const parsed = parseFinite(
            this.stringValue,
            base === 10 ? undefined : base,
        );

        if (parsed === undefined) {
            return 0;
        }

        return parsed < 0 ? math.ceil(parsed) : math.floor(parsed);
    }

    /** Get the underlying string value as a float. */
    public toFloat(): number {
        return parseFinite(this.stringValue) ?? 0;
    }

    /**
     * Get the underlying string value as a boolean.
     *
     * PHP: `filter_var($value, FILTER_VALIDATE_BOOLEAN)` -- true for `"1"`,
     * `"true"`, `"on"` and `"yes"`, false for anything else.
     */
    public toBoolean(): boolean {
        const normalized = Str.lower(Str.trim(this.stringValue));

        return (
            normalized === "1" ||
            normalized === "true" ||
            normalized === "on" ||
            normalized === "yes"
        );
    }

    /** Specify data which should be serialized to JSON. */
    public jsonSerialize(): string {
        return this.toString();
    }
}
