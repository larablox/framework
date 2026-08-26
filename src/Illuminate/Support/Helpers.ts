import { Arr } from "Illuminate/Support/Arr";
import { Collection } from "Illuminate/Support/Collection";
import {
    InvalidArgumentException,
    RuntimeException,
} from "Illuminate/Exception";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { Reflector } from "Illuminate/Support/Reflector";
import { Str } from "Illuminate/Support/Str";
import { Stringable } from "Illuminate/Support/Stringable";
import { Util } from "Illuminate/Container/Util";
import type { Constructor } from "Illuminate/Support/Traits/Trait";
import type { Exception } from "Illuminate/Exception";

/**
 * PHP's global helpers, from `Illuminate/Support/helpers.php` and
 * `Illuminate/Collections/helpers.php`.
 *
 * PHP declares these in the global namespace; there is no global namespace
 * here, so they are ordinary module exports and keep PHP's `snake_case` names
 * -- these are functions, not methods, and that is what the sources call them.
 * `with` is a reserved word in TypeScript and follows the project's convention
 * for those: `_with`.
 *
 * **This module sits at the top of the Support import graph.** It imports the
 * classes it builds on, so nothing under `Illuminate/Support` may import it
 * back -- a cyclic *value* import does not fail at that line, it kills the
 * whole module (see `agent_docs/roblox-ts-constraints.md`). `Tappable` inlines
 * its two lines rather than call `tap()` for exactly this reason.
 *
 * Not ported, and why:
 *
 * - `collect` -- already lives next to `Collection`, as it does in PHP;
 * - `e`, `preg_replace_array` -- no HTML, no PCRE;
 * - `env`, `windows_os`, `laravel_cloud` -- no environment to read;
 * - `object_get` -- an object is a table here, `data_get` already covers it;
 * - `literal` -- no named arguments and no `stdClass`;
 * - `append_config`, `class_uses_recursive`, `trait_uses_recursive` -- traits
 *   leave no runtime trace to walk;
 * - `once` -- hashes the call site out of a backtrace;
 * - `fluent` -- its class is not ported yet.
 */

/**
 * What `data_get` and its neighbours can address: any table.
 *
 * A dotted key walks through levels of unrelated types, which is why
 * `data_get` answers `unknown`; naming the four shapes a "PHP array" takes
 * here -- `Collection`, `OrderedMap`, a list, a plain table -- would only fix
 * their type parameters and turn `Collection<string, string>` into an error.
 */
export type DataTarget = object;

// ---------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------

/** PHP: `value($value, ...$args)`. */
export function value<TValue extends defined>(
    value: TValue | ((...args: Array<never>) => TValue),
    ...args: Array<unknown>
): TValue {
    return Util.unwrapIfClosure(value, ...args) as TValue;
}

/**
 * PHP: `with($value, $callback)`.
 *
 * `with` is reserved in TypeScript; the project spells reserved identifiers
 * with a leading underscore, as `_next` does in middleware.
 */
export function _with<TValue extends defined, TReturn>(
    value: TValue,
    callback?: (value: TValue) => TReturn,
): TValue | TReturn {
    return callback === undefined ? value : callback(value);
}

/**
 * PHP: `tap($value, $callback)`.
 *
 * With no callback PHP returns a `HigherOrderTapProxy`, which forwards one
 * method call to the target and hands the target back through `__call`. There
 * is no `__call`, so the callback is required.
 */
export function tap<TValue extends defined>(
    value: TValue,
    callback: (value: TValue) => unknown,
): TValue {
    callback(value);

    return value;
}

/** PHP: `transform($value, $callback, $default)`. */
export function transform<TValue extends defined, TReturn, TDefault>(
    value: TValue | undefined,
    callback: (value: TValue) => TReturn,
    defaultValue?: TDefault | ((value: TValue | undefined) => TDefault),
): TReturn | TDefault | undefined {
    if (filled(value)) {
        return callback(value as TValue);
    }

    if (typeIs(defaultValue, "function")) {
        return (defaultValue as (value: TValue | undefined) => TDefault)(value);
    }

    return defaultValue;
}

/**
 * PHP: `optional($value, $callback)`.
 *
 * Without a callback PHP returns an `Optional`, which answers every property
 * read and method call on a null value with null, through `__get` / `__call`.
 * A proxy like that types as nothing at all here, so only the callback form is
 * ported.
 */
export function optional<TValue extends defined, TReturn>(
    value: TValue | undefined,
    callback: (value: TValue) => TReturn,
): TReturn | undefined {
    return value !== undefined ? callback(value) : undefined;
}

/** PHP: `when($condition, $value, $default)`. */
export function when<TValue extends defined, TDefault extends defined>(
    condition: unknown,
    value: TValue | ((condition: unknown) => TValue),
    defaultValue?: TDefault | ((condition: unknown) => TDefault),
): TValue | TDefault | undefined {
    const resolved = typeIs(condition, "function")
        ? (condition as Callback)()
        : condition;

    if (Util.truthy(resolved)) {
        return Util.unwrapIfClosure(value, resolved) as TValue;
    }

    return Util.unwrapIfClosure(defaultValue, resolved) as TDefault | undefined;
}

// ---------------------------------------------------------------------
// Emptiness
// ---------------------------------------------------------------------

/**
 * PHP: `blank($value)`.
 *
 * PHP tests its `Stringable` interface, which is every object with
 * `__toString()`; roblox-ts compiles `toString()` onto the `__tostring`
 * metamethod, and every compiled class carries one, so the test would answer
 * for all of them. The class itself is asked for instead.
 */
export function blank(value: unknown): boolean {
    if (value === undefined) {
        return true;
    }

    if (typeIs(value, "string")) {
        return Str.trim(value) === "";
    }

    if (typeIs(value, "number") || typeIs(value, "boolean")) {
        return false;
    }

    if (value instanceof Collection) {
        return (value as Collection<defined, defined>).count() === 0;
    }

    if (value instanceof OrderedMap) {
        return (value as OrderedMap<defined, defined>).isEmpty();
    }

    if (value instanceof Stringable) {
        return Str.trim((value as Stringable).toString()) === "";
    }

    // PHP falls through to `empty($value)`, and an object is never empty --
    // only an array is. An instance and an array are both tables, so the two
    // are told apart the way `Reflector` tells them apart.
    if (Reflector.isInstance(value)) {
        return false;
    }

    if (typeIs(value, "table")) {
        const [key] = next(value);

        return key === undefined;
    }

    return false;
}

/** PHP: `filled($value)`. */
export function filled(value: unknown): boolean {
    return !blank(value);
}

// ---------------------------------------------------------------------
// Throwing
// ---------------------------------------------------------------------

/**
 * What stands in for PHP's exception-or-class-string.
 *
 * PHP's default is the string `'RuntimeException'`, which `class_exists()`
 * then turns back into a class. There are no class-name strings here -- an
 * identifier is a string or the class itself -- so a string is always taken
 * for a message and the default is the class.
 */
export type Throwable =
    | string
    | Exception
    | Constructor<Exception>
    | ((...args: Array<never>) => string | Exception | Constructor<Exception>);

/** PHP: `throw_if($condition, $exception, ...$parameters)`. */
export function throw_if<TValue>(
    condition: TValue,
    exception: Throwable = RuntimeException,
    ...parameters: Array<unknown>
): TValue {
    if (!Util.truthy(condition)) {
        return condition;
    }

    const thrown = typeIs(exception, "function")
        ? (exception as Callback)(...parameters)
        : exception;

    if (typeIs(thrown, "string")) {
        throw new RuntimeException(thrown);
    }

    // A class and an instance of it are both tables; only an instance carries
    // its class as its metatable.
    if (Reflector.isInstance(thrown)) {
        throw thrown;
    }

    throw new (thrown as Constructor<Exception>)(
        ...(parameters as Array<never>),
    );
}

/** PHP: `throw_unless($condition, $exception, ...$parameters)`. */
export function throw_unless<TValue>(
    condition: TValue,
    exception: Throwable = RuntimeException,
    ...parameters: Array<unknown>
): TValue {
    throw_if(!Util.truthy(condition), exception, ...parameters);

    return condition;
}

/**
 * PHP: `retry($times, $callback, $sleepMilliseconds = 0, $when = null)`.
 *
 * PHP sleeps through `Illuminate\Support\Sleep`, which exists to be faked in
 * tests; here the scheduler is the clock and `task.wait` is the sleep. An
 * array of `$times` is a per-attempt backoff, exactly as in PHP: its length
 * plus one is the number of attempts.
 *
 * PHP jumps back with `goto beginning`; a loop says the same thing.
 */
export function retry<TReturn>(
    times: number | Array<number>,
    callback: (attempts: number) => TReturn,
    sleepMilliseconds:
        number | ((attempts: number, exception: unknown) => number) = 0,
    when?: (exception: unknown) => boolean,
): TReturn {
    const backoff = typeIs(times, "table") ? times : new Array<number>();
    let remaining = typeIs(times, "table") ? times.size() + 1 : times;
    let attempts = 0;

    for (;;) {
        attempts += 1;
        remaining -= 1;

        try {
            return callback(attempts);
        } catch (exception) {
            if (remaining < 1 || (when !== undefined && !when(exception))) {
                // Level 0, and so not `throw`: that compiles to `error(x)`,
                // which stamps this line's position onto a string error --
                // and this line is not where it went wrong.
                error(exception, 0);
            }

            const configured = backoff[attempts - 1] ?? sleepMilliseconds;

            // `typeIs` narrows to Luau's `Callback`, whose return is `any`;
            // the cast keeps the delay a number.
            const milliseconds: number = typeIs(configured, "function")
                ? (configured as (attempts: number, e: unknown) => number)(
                      attempts,
                      exception,
                  )
                : configured;

            if (milliseconds > 0) {
                task.wait(milliseconds / 1000);
            }
        }
    }
}

// ---------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------

/**
 * PHP: `class_basename($class)`.
 *
 * PHP strips the namespace off the name; a compiled class never carried one,
 * so the name it reports is already the basename.
 */
export function class_basename(target: unknown): string {
    return Reflector.className(
        Reflector.isInstance(target)
            ? Reflector.classOf(target as object)
            : target,
    );
}

// ---------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------

/**
 * PHP: `str($string)`.
 *
 * Called with no arguments PHP answers an anonymous object that forwards
 * every call to `Str` through `__call`. There is no `__call`, so the string is
 * required here; call `Str` directly for what that form was for.
 */
export function str(value: string | number | Stringable): Stringable {
    return new Stringable(value);
}

// ---------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------

/**
 * PHP: `head($array)`.
 *
 * PHP answers `false` for an empty array. Nothing else in this port signals
 * absence with `false`, and a `T | false` return would poison every call site,
 * so this answers `undefined`, as `Arr::first()` does.
 */
export function head<T extends defined>(list: Array<T>): T | undefined {
    return Arr.first(list);
}

/** PHP: `last($array)`. Answers `undefined` rather than `false`; see `head`. */
export function last<T extends defined>(list: Array<T>): T | undefined {
    return Arr.last(list);
}

// ---------------------------------------------------------------------
// Dot-notation access
// ---------------------------------------------------------------------

/**
 * PHP: `data_get($target, $key, $default)`.
 *
 * This is `Arr::get()` plus the three things a plain array lookup cannot do:
 * `*` fans out over every item, `{first}` and `{last}` name the outer keys,
 * and a leading backslash escapes any of them back into a literal segment.
 *
 * Two things differ from PHP. A segment is a string, and a Luau table keyed by
 * a string is not the same table keyed by a number, so a segment that reads as
 * a number is retried as one -- that is what makes `items.0.name` work on a
 * list. And `*` drops the misses instead of collecting nulls: a Luau array
 * cannot hold a hole, and a hole would cut the array short.
 */
export function data_get(
    target: unknown,
    key: string | Array<string> | undefined,
    defaultValue?: unknown,
): unknown {
    if (key === undefined) {
        return target;
    }

    const parts = typeIs(key, "string") ? key.split(".") : key;
    let current = target;

    for (let index = 0; index < parts.size(); index++) {
        const segment = parts[index];

        if (segment === "*") {
            const items = itemsOf(current);

            if (items === undefined) {
                return Util.unwrapIfClosure(defaultValue);
            }

            const rest = remainingSegments(parts, index + 1);
            const result = new Array<defined>();

            for (const item of items) {
                const found = data_get(item, rest);

                if (found !== undefined) {
                    result.push(found as defined);
                }
            }

            return rest.includes("*") ? Arr.collapse(result) : result;
        }

        const found = resolveSegment(current, segment);

        if (found === undefined) {
            return Util.unwrapIfClosure(defaultValue);
        }

        current = found;
    }

    return current;
}

/**
 * PHP: `data_has($target, $key)`.
 *
 * Plain segments only -- PHP's `data_has` understands neither `*` nor
 * `{first}` either.
 */
export function data_has(
    target: unknown,
    key: string | Array<string> | undefined,
): boolean {
    if (key === undefined) {
        return false;
    }

    const parts = typeIs(key, "string") ? key.split(".") : key;

    if (parts.size() === 0) {
        return false;
    }

    let current = target;

    for (const segment of parts) {
        const found = readKey(current, segment);

        if (found === undefined) {
            return false;
        }

        current = found;
    }

    return true;
}

/**
 * PHP: `data_set(&$target, $key, $value, $overwrite)`.
 *
 * PHP takes the target by reference so it can replace a scalar with a fresh
 * array. A table is already passed by reference and a scalar cannot be
 * replaced through one, so a target that holds nothing addressable is an
 * error here rather than a silent overwrite. Missing levels are created as
 * string-keyed tables, exactly as `Arr::set()` creates them.
 */
export function data_set(
    target: DataTarget,
    key: string | Array<string>,
    value: unknown,
    overwrite = true,
): DataTarget {
    const rest = typeIs(key, "string") ? key.split(".") : [...key];
    const segment = rest.remove(0) as string;

    if (segment === "*") {
        const items = itemsOf(target);

        if (items === undefined) {
            throw new InvalidArgumentException(
                "A wildcard segment needs a target that holds items.",
            );
        }

        if (rest.size() > 0) {
            for (const item of items) {
                data_set(item as DataTarget, rest, value, overwrite);
            }
        } else if (overwrite) {
            for (const each of keysOf(target)) {
                writeKey(target, each, value);
            }
        }

        return target;
    }

    if (rest.size() > 0) {
        let child = readKey(target, segment);

        if (!typeIs(child, "table")) {
            child = {} as Record<string, unknown>;

            writeKey(target, keyFor(target, segment), child);
        }

        data_set(child as DataTarget, rest, value, overwrite);

        return target;
    }

    if (overwrite || readKey(target, segment) === undefined) {
        writeKey(target, keyFor(target, segment), value);
    }

    return target;
}

/** PHP: `data_fill(&$target, $key, $value)`. */
export function data_fill(
    target: DataTarget,
    key: string | Array<string>,
    value: unknown,
): DataTarget {
    return data_set(target, key, value, false);
}

/**
 * PHP: `data_forget(&$target, $key)`.
 *
 * Dropping a key from a list re-indexes it: `unset($list[1])` leaves a hole in
 * PHP, and a Luau array has no holes to leave.
 */
export function data_forget(
    target: DataTarget,
    key: string | Array<string>,
): DataTarget {
    const rest = typeIs(key, "string") ? key.split(".") : [...key];
    const segment = rest.remove(0) as string;

    if (segment === "*") {
        const items = rest.size() > 0 ? itemsOf(target) : undefined;

        if (items !== undefined) {
            for (const item of items) {
                data_forget(item as DataTarget, rest);
            }
        }

        return target;
    }

    const child = readKey(target, segment);

    if (rest.size() > 0 && child !== undefined) {
        data_forget(child as DataTarget, rest);

        return target;
    }

    deleteKey(target, keyFor(target, segment));

    return target;
}

// ---------------------------------------------------------------------
// Internals -- the four shapes a "PHP array" takes in this port
// ---------------------------------------------------------------------

/** The segments left after the one being handled. */
function remainingSegments(parts: Array<string>, from: number): Array<string> {
    const rest = new Array<string>();

    for (let index = from; index < parts.size(); index++) {
        rest.push(parts[index]);
    }

    return rest;
}

/** Read one key, exactly as given. */
function readRawKey(target: unknown, key: string | number): unknown {
    if (target instanceof Collection) {
        return (target as Collection<defined, defined>).get(key);
    }

    if (target instanceof OrderedMap) {
        return (target as OrderedMap<defined, defined>).get(key);
    }

    if (!typeIs(target, "table")) {
        return undefined;
    }

    return typeIs(key, "number")
        ? (target as Array<defined>)[key]
        : (target as Record<string, unknown>)[key];
}

/** A target that keeps its own keys, and can therefore hold numeric ones. */
function isKeyed(target: unknown): boolean {
    return target instanceof Collection || target instanceof OrderedMap;
}

/**
 * Read one segment, retrying it as a number when the string key misses.
 *
 * The retry only makes sense where a numeric key can actually live: a list
 * (`items.0.name`), or a `Collection` / `OrderedMap` built from one, whose
 * keys are the numbers `getArrayableItems()` gave them. In a plain table the
 * keys came from an object literal and are strings, so the string is final.
 */
function readKey(target: unknown, segment: string): unknown {
    const direct = readRawKey(target, segment);

    if (direct !== undefined) {
        return direct;
    }

    const numeric = tonumber(segment);

    if (numeric === undefined || !(isKeyed(target) || Util.isArray(target))) {
        return undefined;
    }

    return readRawKey(target, numeric);
}

/** PHP: the `match ($segment)` inside `data_get`. */
function resolveSegment(target: unknown, segment: string): unknown {
    if (segment === "\\*") {
        return readKey(target, "*");
    }

    if (segment === "\\{first}") {
        return readKey(target, "{first}");
    }

    if (segment === "\\{last}") {
        return readKey(target, "{last}");
    }

    if (segment === "{first}" || segment === "{last}") {
        const key = keyAt(target, segment === "{last}");

        return key === undefined ? undefined : readRawKey(target, key);
    }

    return readKey(target, segment);
}

/** Write one key, in whatever way the target takes writes. */
function writeKey(target: unknown, key: string | number, value: unknown): void {
    if (target instanceof Collection) {
        (target as Collection<defined, defined>).put(key, value as defined);

        return;
    }

    if (target instanceof OrderedMap) {
        (target as OrderedMap<defined, defined>).set(key, value as defined);

        return;
    }

    if (!typeIs(target, "table")) {
        return;
    }

    if (typeIs(key, "number")) {
        (target as Array<defined>)[key] = value as defined;

        return;
    }

    (target as Record<string, unknown>)[key] = value;
}

/** Drop one key. */
function deleteKey(target: unknown, key: string | number): void {
    if (target instanceof Collection) {
        (target as Collection<defined, defined>).forget(key);

        return;
    }

    if (target instanceof OrderedMap) {
        (target as OrderedMap<defined, defined>).delete(key);

        return;
    }

    if (!typeIs(target, "table")) {
        return;
    }

    if (typeIs(key, "number")) {
        (target as Array<defined>).remove(key);

        return;
    }

    delete (target as Record<string, unknown>)[key];
}

/** A list is keyed by number; everything else keeps the segment as written. */
function keyFor(target: unknown, segment: string): string | number {
    const numeric = tonumber(segment);

    if (numeric === undefined) {
        return segment;
    }

    if (Util.isArray(target)) {
        return numeric;
    }

    // A Collection or an OrderedMap keeps whatever key it was given, so an
    // existing numeric one wins; a plain table is string-keyed, and PHP's
    // habit of folding `'0'` into `0` would only invent keys nothing reads.
    return isKeyed(target) && readRawKey(target, numeric) !== undefined
        ? numeric
        : segment;
}

/** PHP: `is_iterable($target)`, answering the items to walk. */
function itemsOf(target: unknown): Array<defined> | undefined {
    if (target instanceof Collection) {
        return (target as Collection<defined, defined>).all();
    }

    if (target instanceof OrderedMap) {
        return (target as OrderedMap<defined, defined>).values();
    }

    if (Util.isArray(target)) {
        return target as Array<defined>;
    }

    if (!typeIs(target, "table")) {
        return undefined;
    }

    const values = new Array<defined>();

    for (const [, each] of pairs(target as Record<string, defined>)) {
        values.push(each as defined);
    }

    return values;
}

/** Every key of the target, in whatever order it can offer. */
function keysOf(target: unknown): Array<string | number> {
    if (target instanceof Collection) {
        return (target as Collection<defined, defined>).keys().all() as Array<
            string | number
        >;
    }

    if (target instanceof OrderedMap) {
        return (target as OrderedMap<defined, defined>).keys() as Array<
            string | number
        >;
    }

    if (Util.isArray(target)) {
        const indices = new Array<string | number>();

        for (
            let index = 0;
            index < (target as Array<defined>).size();
            index++
        ) {
            indices.push(index);
        }

        return indices;
    }

    const keys = new Array<string | number>();

    if (typeIs(target, "table")) {
        for (const [each] of pairs(target as Record<string, defined>)) {
            keys.push(each as string);
        }
    }

    return keys;
}

/**
 * PHP: `array_key_first()` / `array_key_last()`.
 *
 * A plain table has no first key -- `pairs` picks its own order -- which is
 * the whole reason `OrderedMap` exists. `{first}` over one is arbitrary.
 */
function keyAt(
    target: unknown,
    wantLast: boolean,
): string | number | undefined {
    const keys = keysOf(target);

    if (keys.size() === 0) {
        return undefined;
    }

    return wantLast ? keys[keys.size() - 1] : keys[0];
}
