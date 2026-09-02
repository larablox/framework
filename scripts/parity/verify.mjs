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
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d[\w.]*|===|!==|\?\?=|\?\?|\*\*=?|=>|\.\.\.|&&|\|\||\+\+|--|[+\-*/%<>=!&|^]=|<=|>=|[{}()[\].,;:?<>+\-*/%=!&|^~]/g;

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
        .replaceAll('$', '')
        // class-name-in-message: an Abstract interpolated into a message
        // spells as `Reflector.className(x)` -- a bare table would
        // interpolate as an address -- so the port always wraps it where
        // PHP just names the variable. NOT also stripping the braces
        // around it: tried that once and it regressed alias()/getAlias(),
        // whose PHP source writes `{$abstract}` (braced) for a plain
        // variable by simple author style, not because the expression
        // needs it -- PHP's braced-vs-bare choice for a one-token variable
        // is not something the compiled TS side can predict, so leaving
        // both sides' braces alone is the only sound default. Verified
        // safe in both directions before landing this, same as everywhere
        // else in this file -- the earlier attempt looked safe by the same
        // reasoning and was not.
        .replace(/Reflector\.className\(([^)]*)\)/g, '$1');
}

// PHP-side noise with no JS counterpart: visibility (verified by its own CSV
// columns), parameter/catch type hints (types are erased in the transpiled
// JS), and the `fn`/`function` keywords (an arrow spells itself with `=>`
// alone, whether standing in for a short closure or a full one -- the
// member's own top-level `function` is already gone by the time this set is
// consulted, dropped the same way).
const PHP_DROPPED = new Set([
    'public',
    'protected',
    'private',
    'fn',
    'function',
    'Closure',
    '\\Closure',
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

// Shared machinery for `unset`/`isset`: both take any number of
// comma-separated `RECEIVER [ KEY ]` targets in one PHP call, and the port
// has no such form -- each becomes its own `RECEIVER . method ( KEY )`
// expression, joined by `joiner` when there is more than one (unset's become
// separate statements, so joiner is empty; isset's "all must be set" reads
// as `&&`). Bails out (returns null) on anything that doesn't look like a
// plain `X[Y]` target in every comma group, so a real divergence still shows
// rather than being silently mangled.
function expandBracketCall(tokens, callName, method, joiner)
{
    const out = [];
    let i = 0;
    let changed = false;
    while (i < tokens.length) {
        if (tokens[i] === callName && tokens[i + 1] === '(') {
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
                    if (rewritten.length > 0) rewritten.push(...joiner);
                    rewritten.push(...receiver, '.', method, '(', ...key, ')');
                }
                if (ok) {
                    out.push(...rewritten);
                    i = closeIndex + 1;
                    changed = true;
                    continue;
                }
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return changed ? out : tokens;
}

// collection-ops: `unset -> .delete()`.
function expandUnset(tokens)
{
    return expandBracketCall(tokens, 'unset', 'delete', []);
}

// collection-ops: `isset -> .has()`. PHP's `isset($x[$k])` also becomes an
// `!== undefined`/`=== undefined` test elsewhere in this file (the plain
// `isset` structural rule) -- that shape is different from a bare
// truthiness read and is not folded here, only the direct `.has()` case.
function expandIsset(tokens)
{
    return expandBracketCall(tokens, 'isset', 'has', ['&&']);
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

// `is_null(x)` spells as `x === null` (undefined, canonicalized back to
// `null` by the renames table); `! is_null(x)` as `x !== null` -- a prefix
// `!` turns into a different operator entirely, not a wrapped negation, so
// it has to be consumed here rather than left for the general token stream
// to line up on its own. Bails out untouched when the argument itself holds
// a bare `=` (hoisted-assignment-in-condition, e.g.
// `is_null($binding = $this->find(...))`): that construct is its own
// unmechanized structural rule, reviewed case by case, never folded blindly.
function foldIsNull(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === 'is_null' && tokens[i + 1] === '(') {
            const matched = matchCallArgs(tokens, i + 1);
            if (matched && matched.args.length === 1 && !matched.args[0].includes('=')) {
                const negated = out[out.length - 1] === '!';
                if (negated) out.pop();
                out.push(...matched.args[0], negated ? '!==' : '===', 'null');
                i = matched.closeIndex + 1;
                continue;
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

// Shared machinery for a single-argument PHP builtin that spells as a
// zero-argument suffix method call on the port's side: `array_pop(x) ->
// x.pop()`, `count(x) -> x.size()`. Same single-argument function-call
// shape as array_last/is_null above; unlike them, the method takes no
// argument to duplicate or negate, so the fold is a plain suffix rewrite.
function foldToSuffixCall(tokens, callName, method)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === callName && tokens[i + 1] === '(') {
            const matched = matchCallArgs(tokens, i + 1);
            if (matched && matched.args.length === 1) {
                out.push(...matched.args[0], '.', method, '(', ')');
                i = matched.closeIndex + 1;
                continue;
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

function foldArrayPop(tokens)
{
    return foldToSuffixCall(tokens, 'array_pop', 'pop');
}

// collection-ops: `count() -> .size()`.
function foldCount(tokens)
{
    return foldToSuffixCall(tokens, 'count', 'size');
}

// `empty(x)` spells as `x.isEmpty()`; `! empty(x)` as `x.isEmpty() ===
// false` -- a suffix comparison rather than a leading `!`, specifically so
// the fold never needs to reach backward past however many tokens make up
// `x` (unlike is_null's bare `x`, `x` here is often a whole dotted path,
// e.g. `$this->abstractAliases[$abstract]`). The TS side reaches for two
// different spellings of the same negated check depending on the method
// (`!x.isEmpty()` in notInstantiable(), `x.size() > 0` in resolve()) --
// only the `.size() > 0` one folds to match here for the same reason: it is
// a suffix, so it needs no backward reach either. `!x.isEmpty()` still
// shows as residue; unified handling would need real expression-boundary
// tracking this tokenizer does not have.
function foldEmpty(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === 'empty' && tokens[i + 1] === '(') {
            const matched = matchCallArgs(tokens, i + 1);
            if (matched && matched.args.length === 1) {
                const negated = out[out.length - 1] === '!';
                if (negated) out.pop();
                out.push(...matched.args[0], '.', 'isEmpty', '(', ')');
                if (negated) out.push('===', 'false');
                i = matched.closeIndex + 1;
                continue;
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

// collection-ops: `array_key_exists(k, arr)` spells as `arr.has(k)` --
// same suffix-comparison reasoning as `empty()` above for the negated form
// (`! array_key_exists(...)` -> `arr.has(k) === false`), since `arr` is
// often a dotted receiver (`$this->checkedForSingletonOrScopedAttributes`)
// this fold must not reach backward past.
function foldArrayKeyExists(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === 'array_key_exists' && tokens[i + 1] === '(') {
            const matched = matchCallArgs(tokens, i + 1);
            if (matched && matched.args.length === 2) {
                const negated = out[out.length - 1] === '!';
                if (negated) out.pop();
                out.push(...matched.args[1], '.', 'has', '(', ...matched.args[0], ')');
                if (negated) out.push('===', 'false');
                i = matched.closeIndex + 1;
                continue;
            }
        }
        out.push(tokens[i]);
        i++;
    }
    return out;
}

// `is_string(x)` spells as `typeIs(x, 'string')` -- direct, same polarity,
// unlike `is_string($abstract)` elsewhere in Container.php, which spells as
// `!typeIs(abstract, 'function')` (a domain generalization over Abstract's
// closed string|class union, not this builtin's own meaning) and is left
// alone: applying this fold there would not create a false match (the
// negation and the target type both still differ), only reshape residue
// that was already real.
function foldIsString(tokens)
{
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === 'is_string' && tokens[i + 1] === '(') {
            const matched = matchCallArgs(tokens, i + 1);
            if (matched && matched.args.length === 1) {
                out.push('typeIs', '(', ...matched.args[0], ',', 'str:string', ')');
                i = matched.closeIndex + 1;
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

function canonicalizePhp(tokens, declName)
{
    const out = [];
    for (let index = 0; index < tokens.length; index++) {
        let token = tokens[index];
        if (token === ';' || PHP_DROPPED.has(token)) continue;
        // A class-name type hint -- a parameter's (`ReflectionParameter
        // $parameter`), a catch clause's (`catch (Exception $e)`) -- is
        // type-erased same as the primitive names PHP_DROPPED already
        // covers, but there are too many distinct class names to enumerate
        // there. PHP syntax has no legal construct where a bare identifier
        // directly precedes a `$variable` other than a type hint, so this is
        // unconditional: an identifier immediately followed by one is always
        // dropped, never a value read.
        if (/^[A-Z]/.test(token) && tokens[index + 1]?.startsWith('$')) continue;
        // Late static binding (`static::`, `new static`) and `self::` both
        // name this declaration -- the port has no such indirection and
        // just writes the class literally, so this only ever needs the
        // declaration's own name, never a subclass's. Positively matched
        // (followed by `::`, or directly after `new`) rather than excluding
        // known modifier positions one at a time: `static` is also a
        // method modifier (`static function`) *and* a property modifier
        // (`protected static $instance`), and excluding only the first one
        // once regressed the second. `new static;` also gains the `()`
        // PHP's optional-parens shorthand omits, since a same-shaped
        // `new X()` on the TS side always writes it.
        if (
            (token === 'static' || token === 'self') && declName
            && (tokens[index + 1] === '::' || out[out.length - 1] === 'new')
        ) {
            const afterNew = out[out.length - 1] === 'new';
            out.push(declName);
            if (afterNew && tokens[index + 1] !== '(') out.push('(', ')');
            continue;
        }
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
        // `expr ?? null` is mathematically redundant -- the fallback for a
        // null/unset left side is null either way -- so it is safe to drop
        // unconditionally, wherever it appears, unlike a fallback to any
        // other value.
        if (token === '??' && tokens[index + 1] === 'null') {
            index++;
            continue;
        }
        // instanceof-closure: `$x instanceof Closure` spells as
        // `typeIs(x, 'function')` -- a closure is a bare function value.
        // 'Closure' has already been caught by PHP_DROPPED everywhere it is
        // just a type hint, so it must be intercepted here, one token early,
        // while it still marks this specific construct. Only the single-
        // token receiver every occurrence in this file actually has (a bare
        // `$var`, never a dotted expression) is handled; anything else is
        // left alone rather than guessed at.
        if (token === 'instanceof' && tokens[index + 1] === 'Closure' && out.length > 0) {
            const receiver = out.pop();
            out.push('typeIs', '(', receiver, ',', 'str:function', ')');
            index++;
            continue;
        }
        out.push(token);
    }
    // A method declaration's `function` keyword; JS spells the name alone.
    if (out[0] === 'function') out.shift();
    else if (out[0] === 'static' && out[1] === 'function') out.splice(1, 1);
    return stripPropertyNullDefault(
        foldArrayKeyExists(
            foldIsString(
                foldEmpty(
                    foldCount(
                        foldArrayPop(
                            foldIsNull(
                                foldArrayLast(expandIsset(expandUnset(reorderForeach(stripSignatureNoise(out))))),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    );
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

// Splits a call's arguments at `openIndex` (pointing at `(`) into top-level
// comma-separated token groups. Returns null on an unmatched paren.
function matchCallArgs(tokens, openIndex)
{
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
    if (closeIndex === -1) return null;
    const inner = tokens.slice(openIndex + 1, closeIndex);
    const args = [];
    let current = [];
    let innerDepth = 0;
    for (const t of inner) {
        if (t === ',' && innerDepth === 0) {
            args.push(current);
            current = [];
            continue;
        }
        if (t === '(' || t === '[' || t === '{') innerDepth++;
        else if (t === ')' || t === ']' || t === '}') innerDepth--;
        current.push(t);
    }
    if (current.length > 0 || args.length > 0) args.push(current);
    return { closeIndex, args };
}

function canonicalizeTs(tokens, renames)
{
    const tsToCanon = new Map();
    for (const [php, tsName] of Object.entries(renames)) {
        tsToCanon.set(tsName, php);
    }
    const out = [];
    for (let index = 0; index < tokens.length; index++) {
        let token = tokens[index];
        // PHP has no local-variable-declaration keyword at all -- the first
        // assignment doubles as the declaration -- so a statement-level
        // `const`/`let` never has anything on the PHP side to line up with.
        // Not inside a `for (...)` header, though: reorderForeach's own PHP
        // output inserts the literal token `const` to match
        // `for (const x of list)`, and a C-style `for (let i = 0; ...)` has
        // no PHP counterpart shape to strip toward either -- both are
        // recognized by the `(` that always precedes a for-header's own
        // declaration, never a statement's.
        if (token === ';' || ((token === 'const' || token === 'let') && tokens[index - 1] !== '(')) continue;
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
        // `!empty(x)` reads as `x.size() > 0` at this one call site (resolve());
        // folds toward the same `x.isEmpty() === false` foldEmpty already
        // produces on the PHP side, a pure suffix rewrite so it needs no
        // backward reach into however many tokens make up the receiver.
        if (
            token === '.' && tokens[index + 1] === 'size' && tokens[index + 2] === '(' && tokens[index + 3] === ')'
            && tokens[index + 4] === '>' && tokens[index + 5] === '0'
        ) {
            out.push('.', 'isEmpty', '(', ')', '===', 'false');
            index += 5;
            continue;
        }
        // collection-ops: a keyed read (`.get(k)`) spells `[ k ]` -- same
        // receiver-stays-put reasoning as `.set`/`.push` below. Each
        // argument is itself run back through canonicalizeTs before
        // splicing in -- matchCallArgs jumps straight past a call's whole
        // argument list, so a nested `.get(...)`/`.set(...)` inside one
        // (extend's `closure(this.instances.get(abstract) as never, this)`
        // is both a write and a read of the same target in one statement)
        // would otherwise never reach these checks at all.
        if (token === '.' && tokens[index + 1] === 'get' && tokens[index + 2] === '(') {
            const matched = matchCallArgs(tokens, index + 2);
            if (matched && matched.args.length === 1) {
                out.push('[', ...canonicalizeTs(matched.args[0], renames), ']');
                index = matched.closeIndex;
                continue;
            }
        }
        // collection-ops: a keyed write (`.set(k, v)`) spells `[ k ] = v`;
        // `.push` reads two ways depending on arity -- one argument is a
        // plain list append (`$x[] = v`), two is OrderedMap's own keyed
        // push (`$x[k][] = v`, the same target shape autovivification
        // reaches for below). The receiver needs no capturing here: it
        // already sits in `out` from earlier iterations, in the same
        // position PHP's own receiver-first `$x[k] = v` puts it.
        if (
            token === '.' && (tokens[index + 1] === 'set' || tokens[index + 1] === 'push') && tokens[index + 2] === '('
        ) {
            const matched = matchCallArgs(tokens, index + 2);
            if (matched) {
                const { closeIndex, args } = matched;
                if (tokens[index + 1] === 'set' && args.length === 2) {
                    out.push('[', ...canonicalizeTs(args[0], renames), ']', '=', ...canonicalizeTs(args[1], renames));
                    index = closeIndex;
                    continue;
                }
                if (tokens[index + 1] === 'push' && args.length === 1) {
                    out.push('[', ']', '=', ...canonicalizeTs(args[0], renames));
                    index = closeIndex;
                    continue;
                }
                if (tokens[index + 1] === 'push' && args.length === 2) {
                    out.push(
                        '[',
                        ...canonicalizeTs(args[0], renames),
                        ']',
                        '[',
                        ']',
                        '=',
                        ...canonicalizeTs(args[1], renames),
                    );
                    index = closeIndex;
                    continue;
                }
            }
        }
        // autovivification: `Util.pushInto(x, k, v)` is PHP's
        // `$x[$k][] = $v`; `Util.setInto(x, k1, k2, v)` is `$x[$k1][$k2] =
        // $v`. Unlike `.set`/`.push` above, the receiver is the call's own
        // first argument, not a preceding token, so it has to be relocated
        // to the front of the rewrite.
        if (
            token === 'Util' && (tokens[index + 1] === '.')
            && (tokens[index + 2] === 'pushInto' || tokens[index + 2] === 'setInto') && tokens[index + 3] === '('
        ) {
            const matched = matchCallArgs(tokens, index + 3);
            if (matched) {
                const { closeIndex, args } = matched;
                if (tokens[index + 2] === 'pushInto' && args.length === 3) {
                    out.push(
                        ...canonicalizeTs(args[0], renames),
                        '[',
                        ...canonicalizeTs(args[1], renames),
                        ']',
                        '[',
                        ']',
                        '=',
                        ...canonicalizeTs(args[2], renames),
                    );
                    index = closeIndex;
                    continue;
                }
                if (tokens[index + 2] === 'setInto' && args.length === 4) {
                    out.push(
                        ...canonicalizeTs(args[0], renames),
                        '[',
                        ...canonicalizeTs(args[1], renames),
                        ']',
                        '[',
                        ...canonicalizeTs(args[2], renames),
                        ']',
                        '=',
                        ...canonicalizeTs(args[3], renames),
                    );
                    index = closeIndex;
                    continue;
                }
            }
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
        // never a reference to anything -- neither must canonicalize into
        // one. A static method keeps its `static` modifier at token 0 (the
        // PHP side does too, once canonicalizePhp strips `function` back to
        // `static <name>`), so the declared name itself sits at token 1
        // there instead.
        const nameIndex = tokens[0] === 'static' ? 1 : 0;
        if (tsToCanon.has(token) && index !== nameIndex && tokens[index - 1] !== '.') {
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
export function verifyMember({ scriptDir, phpFile, phpLines, tsFile, tsLines, conventions, declName })
{
    const renames = conventions.renames ?? {};

    const phpTokens = canonicalizePhp(tokenizePhp(scriptDir, phpFile, phpLines), declName);

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
