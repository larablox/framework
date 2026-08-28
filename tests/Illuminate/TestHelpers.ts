/**
 * Shared assertions for the specs under `tests/`.
 *
 * Not a spec itself: TestEZ only discovers `ModuleScript`s whose name ends in
 * `.spec`, so this is inert to the runner and exists purely to be imported.
 *
 * The reason it exists: TestEZ's `expect(a).to.equal(b)` is Luau `==`. On a
 * table that is *reference* identity, so two structurally identical tables
 * never compare equal and the failure reads as the useless
 * `Expected value "table: 0x..." (table), got "table: 0x..." (table)`.
 * Chai/Jest's `.deep.equal` does not exist here (see any spec's header note),
 * so structural comparison has to be spelled out.
 */

/** Renders a value the way TestEZ's own failure messages do. */
function describeValue(value: unknown): string
{
    return `${tostring(value)} (${typeOf(value)})`;
}

/**
 * Guards the walk below. A `Collection` or a `Route` can hold a reference back
 * to something already on the path (or reach the same subtree by several
 * routes), and a naive recursion either never returns or re-walks shared
 * subtrees exponentially -- which on Luau starves the scheduler rather than
 * erroring, so the whole test run hangs with no output.
 */
const MAX_DEPTH = 64;

function compare(
    actual: unknown,
    expected: unknown,
    path: string,
    seen: Map<object, Set<object>>,
    depth: number,
): void
{
    if (typeIs(expected, 'table')) {
        if (!typeIs(actual, 'table')) {
            error(`${path}: expected a table, got ${describeValue(actual)}`, 0);
        }

        // Identical references are equal by definition, and stopping here is
        // what keeps a shared subtree from being walked once per path to it.
        if ((actual as unknown as object) === (expected as unknown as object)) {
            return;
        }

        if (depth > MAX_DEPTH) {
            error(`${path}: nested deeper than ${MAX_DEPTH} levels`, 0);
        }

        const actualKey = actual as unknown as object;
        const expectedKey = expected as unknown as object;
        let against = seen.get(actualKey);

        if (against === undefined) {
            against = new Set<object>();
            seen.set(actualKey, against);
        } else if (against.has(expectedKey)) {
            // Already compared this exact pair further up the walk; recursing
            // again would not learn anything and may not terminate.
            return;
        }

        against.add(expectedKey);

        const actualTable = actual as unknown as Record<string, unknown>;
        const expectedTable = expected as unknown as Record<string, unknown>;

        for (const [key, expectedValue] of pairs(expectedTable)) {
            compare(actualTable[key as string], expectedValue, `${path}[${tostring(key)}]`, seen, depth + 1);
        }

        // Both directions: a key present only in `actual` is just as wrong as
        // a missing one, and comparing one way would silently accept it.
        for (const [key] of pairs(actualTable)) {
            if (expectedTable[key as string] === undefined) {
                error(
                    `${path}[${tostring(key)}]: unexpected key, value ${describeValue(actualTable[key as string])}`,
                    0,
                );
            }
        }

        return;
    }

    if (actual !== expected) {
        error(`${path}: expected ${describeValue(expected)}, got ${describeValue(actual)}`, 0);
    }
}

/**
 * Asserts that `actual` matches `expected` structurally, to any depth.
 *
 * Failures name the path to the first mismatching leaf (`value[2][name]: ...`)
 * rather than printing two table addresses.
 */
export function expectDeepEqual(actual: unknown, expected: unknown): void
{
    compare(actual, expected, 'value', new Map<object, Set<object>>(), 0);
}

/** An `Illuminate/Exception` subclass, as passed to `expectThrows()`. */
type ExceptionClass = new(...args: Array<never>) => object;

/**
 * Asserts that `fn` throws -- optionally that the thrown value is an instance
 * of `expected`, or that its text contains `expected`.
 *
 * Replaces TestEZ's own `expect(fn).to.throw(message)`, which is unusable
 * here: it matches with `err:find(message)` (`Expectation.lua:277`), and this
 * framework throws `Illuminate/Exception` *objects* rather than strings, so
 * that call dies with "attempt to call missing method 'find' of table" before
 * it ever compares anything. `tostring()` on an exception yields
 * `ClassName: message` (`Exception.toString()` is mapped onto `__tostring`),
 * so a substring search covers both the class name and the message text.
 */
export function expectThrows(fn: () => unknown, expected?: string | ExceptionClass): void
{
    const [ok, thrown] = pcall(fn);

    if (ok) {
        error('expected the call to throw, but it returned normally', 0);
    }

    if (expected === undefined) {
        return;
    }

    if (typeIs(expected, 'string')) {
        const text = tostring(thrown);

        if (string.find(text, expected, 1, true)[0] === undefined) {
            error(`expected the thrown error to contain "${expected}", got: ${text}`, 0);
        }

        return;
    }

    if (!(thrown instanceof expected)) {
        error(`expected the call to throw ${tostring(expected)}, got: ${tostring(thrown)}`, 0);
    }
}
