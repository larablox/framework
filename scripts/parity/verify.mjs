// The verbatim verifier: normalizes a PHP member and its TS counterpart into
// comparable token streams and diffs them. An empty residue is strong evidence
// for the `Verbatim.` tag; a non-empty one is the list of spots the reviewer
// must justify against conventions.json (structural entries) or escalate to
// `decision`. Advisory by design -- it aligns tokens, it does not prove
// behavior.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

function tokenizePhp(scriptDir, file, lines)
{
    const result = spawnSync('php', [
        `${scriptDir}/tokenize-php.php`,
        file,
        String(lines[0]),
        String(lines[1]),
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`tokenize-php failed: ${result.stderr}`);
    }
    return JSON.parse(result.stdout);
}

// A small JS lexer, enough for transpiled member bodies.
const JS_TOKEN =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d[\w.]*|===|!==|\?\?|\*\*=?|=>|\.\.\.|&&|\|\||\+\+|--|[+\-*/%<>=!&|^]=|<=|>=|[{}()[\].,;:?<>+\-*/%=!&|^~]/g;

function tokenizeJs(text)
{
    const tokens = [];
    for (const match of text.matchAll(JS_TOKEN)) {
        const token = match[0];
        if (token.startsWith('//') || token.startsWith('/*')) continue;
        tokens.push(token);
    }
    return tokens;
}

function isStringToken(token)
{
    return /^['"`]/.test(token) || /^<<</.test(token);
}

// One canonical spelling for a string literal, PHP or TS: quotes off,
// interpolation braces normalized ("{$x}" and `${x}` both read as {x}).
function canonicalString(token)
{
    const body = token.replace(/^['"`]|['"`]$/g, '');
    return 'str:' + body
        .replaceAll('${', '{')
        .replaceAll('{$', '{')
        .replaceAll('$', '');
}

// PHP-side noise with no JS counterpart: visibility (verified by its own CSV
// columns), parameter/catch type hints (types are erased in the transpiled
// JS), and the `fn` keyword (an arrow spells itself with `=>` alone).
const PHP_DROPPED = new Set([
    'public',
    'protected',
    'private',
    'fn',
    'Closure',
    'Throwable',
    '?',
    'mixed',
    'callable',
    'string',
    'array',
    'bool',
    'int',
    'float',
    'iterable',
    'object',
]);

// Two more things `ts.transpileModule` erases completely, so nothing on the
// TS side can ever line up with either: conventions.json's `nullable-default`
// rule (a PHP `= null` parameter default spells as TS `?` optionality --
// `concrete?: Concrete` emits a bare `concrete`, no initializer at all) and a
// PHP return-type declaration (`: bool`, `: void`, `: static`, ...), which
// TS erases the same way regardless of what the type is -- PHP_DROPPED only
// covers the handful of primitive names, so a return type it does not list
// (`void`, a class name, a union) would otherwise sit in the residue as a
// phantom the port never had a chance to mirror. Both are scoped to the
// member's own signature -- the first top-level paren group and whatever
// sits between its close and the body's `{` -- not a same-shaped `= null`
// sitting in an ordinary statement further down, which is a real assignment
// and stays a real diff if the TS side dropped it.
function stripSignatureNoise(tokens)
{
    const openIndex = tokens.indexOf('(');
    if (openIndex === -1) return tokens;
    let depth = 0;
    let closeIndex = -1;
    for (let i = openIndex; i < tokens.length; i++) {
        if (tokens[i] === '(') depth++;
        else if (tokens[i] === ')') {
            depth--;
            if (depth === 0) {
                closeIndex = i;
                break;
            }
        }
    }
    if (closeIndex === -1) return tokens;

    // The return-type annotation, if any: the `:` right after the closing
    // paren through to (not including) the body's `{`.
    let bodyIndex = closeIndex + 1;
    if (tokens[bodyIndex] === ':') {
        while (bodyIndex < tokens.length && tokens[bodyIndex] !== '{') bodyIndex++;
    }

    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        if (i > openIndex && i < closeIndex && tokens[i] === '=' && tokens[i + 1] === 'null') {
            i++;
            continue;
        }
        if (i > closeIndex && i < bodyIndex) continue;
        out.push(tokens[i]);
    }
    return out;
}

// collection-ops: `unset -> .delete()`. PHP's unset() takes any number of
// comma-separated targets in one call; the port has no such form and spells
// each target as its own `.delete()` statement. Splits the (bracket-depth
// aware) comma list and rewrites each `RECEIVER [ KEY ]` group into
// `RECEIVER . delete ( KEY )`, matching the shape TS already reads in.
// Bails out untouched (rather than guess) on anything that does not look
// like a plain `X[Y]` target, so a real divergence there still shows.
function expandUnset(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === 'unset' && tokens[i + 1] === '(') {
            const openIndex = i + 1;
            let depth = 0;
            let closeIndex = -1;
            for (let j = openIndex; j < tokens.length; j++) {
                if (tokens[j] === '(') depth++;
                else if (tokens[j] === ')') {
                    depth--;
                    if (depth === 0) {
                        closeIndex = j;
                        break;
                    }
                }
            }
            if (closeIndex !== -1) {
                const inner = tokens.slice(openIndex + 1, closeIndex);
                const groups = [];
                let current = [];
                let innerDepth = 0;
                for (const t of inner) {
                    if (t === ',' && innerDepth === 0) {
                        groups.push(current);
                        current = [];
                        continue;
                    }
                    if (t === '(' || t === '[') innerDepth++;
                    else if (t === ')' || t === ']') innerDepth--;
                    current.push(t);
                }
                if (current.length > 0) groups.push(current);

                const rewritten = [];
                let ok = groups.length > 0;
                for (const group of groups) {
                    if (!ok || group[group.length - 1] !== ']') {
                        ok = false;
                        break;
                    }
                    let bracketDepth = 0;
                    let openBracket = -1;
                    for (let k = group.length - 1; k >= 0; k--) {
                        if (group[k] === ']') bracketDepth++;
                        else if (group[k] === '[') {
                            bracketDepth--;
                            if (bracketDepth === 0) {
                                openBracket = k;
                                break;
                            }
                        }
                    }
                    if (openBracket <= 0) {
                        ok = false;
                        break;
                    }
                    const receiver = group.slice(0, openBracket);
                    const key = group.slice(openBracket + 1, group.length - 1);
                    rewritten.push(...receiver, '.', 'delete', '(', ...key, ')');
                }
                if (ok) {
                    out.push(...rewritten);
                    i = closeIndex + 1;
                    continue;
                }
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

// collection-ops: `end()/array_last() -> [size() - 1]`. Both PHP builtins
// return the last element of a list; the port has no such call and indexes
// the receiver directly, which duplicates the receiver's own tokens (once
// to index into, once inside `.size()`). Only the bare form folds --
// `array_last($x) ?: null` / `end($x)` alone -- a ternary or `??` wrapped
// around one (getLastParameterOverride's `count($x) ? array_last($x) : []`)
// reshapes the whole expression, not just this call, and is left as the
// real residue it is.
function foldArrayLast(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if ((tokens[i] === 'array_last' || tokens[i] === 'end') && tokens[i + 1] === '(') {
            const openIndex = i + 1;
            let depth = 0;
            let closeIndex = -1;
            for (let j = openIndex; j < tokens.length; j++) {
                if (tokens[j] === '(') depth++;
                else if (tokens[j] === ')') {
                    depth--;
                    if (depth === 0) {
                        closeIndex = j;
                        break;
                    }
                }
            }
            if (closeIndex !== -1) {
                const expr = tokens.slice(openIndex + 1, closeIndex);
                out.push(...expr, '[', ...expr, '.', 'size', '(', ')', '-', '1', ']');
                i = closeIndex + 1;
                // PHP's own null-safety on a possibly-empty list, redundant
                // once indexing already returns undefined for one. The `?`
                // half of `?:` is already gone by the time this runs --
                // PHP_DROPPED strips it too, doubling as the `?Type`
                // nullable-hint marker.
                if (tokens[i] === ':' && tokens[i + 1] === 'null') i += 2;
                continue;
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

// `foreach ($list as $item)` and `for (const item of list)` hold the same
// tokens in reversed order -- PHP names the collection first, TS/Luau name
// the loop variable first, since there is no `foreach` there. Only the
// simple single-variable form reorders: `as $key => $value` carries a second
// binding TS spells a different way entirely (destructuring a Map entry),
// and stays untouched here so it shows as the real residue it is.
function reorderForeach(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === 'foreach' && tokens[i + 1] === '(') {
            const openIndex = i + 1;
            let depth = 0;
            let closeIndex = -1;
            for (let j = openIndex; j < tokens.length; j++) {
                if (tokens[j] === '(') depth++;
                else if (tokens[j] === ')') {
                    depth--;
                    if (depth === 0) {
                        closeIndex = j;
                        break;
                    }
                }
            }
            if (closeIndex !== -1) {
                const inner = tokens.slice(openIndex + 1, closeIndex);
                let asIndex = -1;
                let innerDepth = 0;
                for (let k = 0; k < inner.length; k++) {
                    if (inner[k] === '(' || inner[k] === '[') innerDepth++;
                    else if (inner[k] === ')' || inner[k] === ']') innerDepth--;
                    else if (inner[k] === 'as' && innerDepth === 0) {
                        asIndex = k;
                        break;
                    }
                }
                const afterAs = asIndex === -1 ? [] : inner.slice(asIndex + 1);
                if (asIndex !== -1 && afterAs.length === 1) {
                    const exprTokens = inner.slice(0, asIndex);
                    out.push('for', '(', 'const', afterAs[0], 'of', ...exprTokens, ')');
                    i = closeIndex + 1;
                    continue;
                }
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

function canonicalizePhp(tokens)
{
    const out = [];
    for (let index = 0; index < tokens.length; index++) {
        let token = tokens[index];
        if (token === ';' || PHP_DROPPED.has(token)) continue;
        // A closure's `use ($a, $b)` capture list has no JS counterpart.
        if (token === 'use' && tokens[index - 1] === ')') {
            while (index < tokens.length && tokens[index] !== ')') index++;
            continue;
        }
        if (isStringToken(token) || /^"/.test(token)) {
            out.push(canonicalString(token));
            continue;
        }
        if (token.startsWith('$')) token = token.slice(1);
        if (token === '->' || token === '::') token = '.';
        if (token === '__construct') token = 'constructor';
        if (token === 'elseif') {
            out.push('else', 'if');
            continue;
        }
        out.push(token);
    }
    // A method declaration's `function` keyword; JS spells the name alone.
    if (out[0] === 'function') out.shift();
    else if (out[0] === 'static' && out[1] === 'function') out.splice(1, 1);
    return stripPropertyNullDefault(foldArrayLast(expandUnset(reorderForeach(stripSignatureNoise(out)))));
}

// The same erased-default problem stripSignatureNoise handles for a method
// parameter, but for a property: `protected $environmentResolver = null;`
// has no `(` at all for that function to anchor on, and TS spells it
// `environmentResolver?: EnvironmentResolver;` -- no initializer survives
// compiling that away. A body (any `{`) means this is a method, not a
// property declaration, and its `= null` statements are real assignments,
// never stripped.
function stripPropertyNullDefault(tokens)
{
    if (tokens.includes('{')) return tokens;
    if (tokens.length < 2 || tokens[tokens.length - 2] !== '=' || tokens[tokens.length - 1] !== 'null') return tokens;
    return tokens.slice(0, -2);
}

// conventions.json's collection-ops rule, last clause: a PHP `= []` property
// initializer spells as `new Map()`/`new Array()`/`new OrderedMap()` by the
// store's kind -- generics are type-only and never survive `transpileModule`,
// so a zero-argument construction of one of these three is indistinguishable
// from an empty PHP array to a caller. Only zero-argument: seeding a Map with
// entries is a real difference PHP's bare `[]` never had.
const EMPTY_COLLECTION_CTORS = new Set([
    'Map',
    'Array',
    'OrderedMap',
]);

function canonicalizeTs(tokens, renames)
{
    const tsToCanon = new Map();
    for (const [php, tsName] of Object.entries(renames)) {
        tsToCanon.set(tsName, php);
    }
    const out = [];
    for (let index = 0; index < tokens.length; index++) {
        let token = tokens[index];
        if (token === ';') continue;
        if (isStringToken(token)) {
            out.push(canonicalString(token));
            continue;
        }
        if (
            token === 'new' && EMPTY_COLLECTION_CTORS.has(tokens[index + 1]) && tokens[index + 2] === '('
            && tokens[index + 3] === ')'
        ) {
            out.push('[', ']');
            index += 3;
            continue;
        }
        // collection-ops, last clause: "a reset to [] spells .clear()" --
        // PHP's `$this->aliases = [];` re-assigns the property to a fresh
        // empty array; the port calls .clear() on the existing collection
        // instead of replacing it. Same receiver either way, so folding the
        // suffix down to `= [ ]` lines the two up without touching whatever
        // (however long) dotted path names the receiver.
        if (token === '.' && tokens[index + 1] === 'clear' && tokens[index + 2] === '(' && tokens[index + 3] === ')') {
            out.push('=', '[', ']');
            index += 3;
            continue;
        }
        // `A.b` may canonicalize as one dotted name (Arr.reverse -> array_reverse).
        const dotted = `${token}.${tokens[index + 2] ?? ''}`;
        if (tokens[index + 1] === '.' && tsToCanon.has(dotted)) {
            out.push(tsToCanon.get(dotted));
            index += 2;
            continue;
        }
        // A bare rename (no dot in its own value, unlike Arr.reverse above)
        // names a standalone helper -- `call`, `methodExists`, `isCallable`
        // are always called free. A dot-prefixed `call` is a method access
        // (`this.call`, `BoundMethod.call`) sharing the identifier by
        // coincidence, not the call_user_func stand-in, and token 0 is
        // always the member's own declared name (Container::call, here),
        // never a reference to anything -- neither must canonicalize into one.
        if (tsToCanon.has(token) && index !== 0 && tokens[index - 1] !== '.') {
            out.push(tsToCanon.get(token));
            continue;
        }
        if (/^_[A-Za-z]/.test(token)) token = token.slice(1);
        out.push(token);
    }
    return out;
}

// Longest common subsequence over two token arrays; returns the residue as
// aligned runs of tokens present on one side only.
function residueOf(phpTokens, tsTokens)
{
    const n = phpTokens.length;
    const m = tsTokens.length;
    const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i][j] = phpTokens[i] === tsTokens[j]
                ? lcs[i + 1][j + 1] + 1
                : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const residue = [];
    let i = 0;
    let j = 0;
    let current = null;
    const flush = () => {
        if (current) {
            residue.push(current);
            current = null;
        }
    };
    while (i < n && j < m) {
        if (phpTokens[i] === tsTokens[j]) {
            flush();
            i++;
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            current ??= { php: [], ts: [] };
            current.php.push(phpTokens[i++]);
        } else {
            current ??= { php: [], ts: [] };
            current.ts.push(tsTokens[j++]);
        }
    }
    if (i < n || j < m) {
        current ??= { php: [], ts: [] };
        current.php.push(...phpTokens.slice(i));
        current.ts.push(...tsTokens.slice(j));
    }
    flush();
    return residue;
}

/**
 * Verifies one member pair. Returns { residue, matched, total } where residue
 * is a list of { php: [...], ts: [...] } runs the streams disagree on.
 */
export function verifyMember({ scriptDir, phpFile, phpLines, tsFile, tsLines, conventions })
{
    const renames = conventions.renames ?? {};

    const phpTokens = canonicalizePhp(tokenizePhp(scriptDir, phpFile, phpLines));

    const tsSource = readFileSync(tsFile, 'utf8').split(/\r?\n/)
        .slice(tsLines[0] - 1, tsLines[1])
        .join('\n')
        // Parameter decorators are the port's spelling of reflection; they
        // transpile into emit helpers that would drown the diff.
        .replace(/@\w+\([^)]*\)\s*/g, '');
    const transpiled = ts.transpileModule(`class __V {\n${tsSource}\n}`, {
        compilerOptions: { target: ts.ScriptTarget.ESNext, removeComments: true },
    }).outputText;
    // Drop the `class __V { ... }` wrapper tokens before canonicalizing --
    // canonicalizeTs treats index 0 as the member's own declared name (never
    // a reference to a renamed helper), which is only true once the wrapper
    // is gone; canonicalizePhp's output already starts there natively.
    const rawTsTokens = tokenizeJs(transpiled);
    if (rawTsTokens[0] === 'class' && rawTsTokens[1] === '__V') {
        rawTsTokens.splice(0, 3);
        rawTsTokens.pop();
    }
    const tsTokens = canonicalizeTs(rawTsTokens, renames);

    const residue = residueOf(phpTokens, tsTokens);
    const disagreeing = residue.reduce((sum, run) => sum + run.php.length + run.ts.length, 0);
    return { residue, disagreeing, total: phpTokens.length + tsTokens.length };
}
