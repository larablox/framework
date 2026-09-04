// Pure canonicalization logic for scripts/parity/check.mjs: tokenizing a PHP
// or TS member body and normalizing away the differences CONVENTIONS.md
// already accepts. No CLI/file/process side effects here on purpose - this
// module is imported both by check.mjs and by canonicalize.test.mjs.
//
// Each canonicalization is a "pass": a `(tokens: string[]) => string[]`
// function operating on the whole token array, independently readable and
// testable. `canonicalizePhp`/`canonicalizeTs` are declared as an ordered
// list of these passes (via `pipe`) rather than one big per-token
// if-cascade, so adding the next accepted convention is one more list
// entry, not a new branch threaded through shared loop state.
//
// Pass ORDER matters in a few places, called out on the passes themselves:
// mainly, the two passes with a recursive `canonicalizePhp`/`canonicalizeTs`
// call (foldDynamicMemberAccess, stripRedundantNewParens, unwrapTruthyCalls)
// must run before anything that would alter the raw tokens they slice out -
// their recursive call re-derives full canonicalization for that slice from
// scratch, the same way the original single-loop implementation always saw
// unmodified tokens for it regardless of loop position.
import ts from 'typescript';

export const JS_TOKEN =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d[\w.]*|===|!==|\?\?=|\?\?|\*\*=?|=>|\.\.\.|&&|\|\||\+\+|--|[+\-*/%<>=!&|^]=|<=|>=|[{}()[\].,;:?<>+\-*/%=!&|^~]/g;

export function tokenizeJs(text)
{
    return [...text.matchAll(JS_TOKEN)].map((m) => m[0]).filter((t) => !t.startsWith('//') && !t.startsWith('/*'));
}

function isStringToken(token)
{
    return /^['"`]/.test(token);
}

// One canonical spelling for a string literal, PHP or TS: quotes off,
// interpolation braces normalized ("{$x}" and `${x}` both read as {x}).
function canonicalString(token)
{
    return 'str:' + token.replace(/^['"`]|['"`]$/g, '').replaceAll('${', '{').replaceAll('{$', '{').replaceAll('$', '');
}

// Shared between both sides - a string literal canonicalizes the same way
// regardless of which language it came from.
function canonicalizeStringLiterals(tokens)
{
    return tokens.map((token) => (isStringToken(token) ? canonicalString(token) : token));
}

// Applies canonicalization passes in order - see the module docblock for
// why order isn't arbitrary for a few of these.
function pipe(tokens, passes)
{
    return passes.reduce((acc, pass) => pass(acc), tokens);
}

const PHP_DROPPED = new Set([
    'public',
    'protected',
    'private',
    'function',
    'fn',
    'mixed',
    'callable',
    'string',
    'array',
    'bool',
    'int',
    'float',
    'iterable',
    'object',
    'void',
    'self',
    'static',
]);

// A bare `?` is the *exact same token* whether it's a nullable-type marker
// (`?callable`) or the ternary operator (`$x ? $y : $z`) - token_get_all
// doesn't distinguish them, only position does. Dropping every `?`
// unconditionally (this set's own approach for everything else) silently
// ate real ternary operators too, which cost two whole tokens' worth of
// fidelity on every ternary in this file before it was caught by reading
// the actual --show residue, not the percentage alone. Only drop it when
// the next token is a type name - a nullable marker is always immediately
// followed by one, a ternary's `?` never is.
function isNullableTypeMarker(tokens, index)
{
    const next = tokens[index + 1];
    return PHP_DROPPED.has(next) || (/^[A-Z]/.test(next ?? '') && tokens[index + 2]?.startsWith('$'));
}

function dropNullableTypeMarkers(tokens)
{
    return tokens.filter((token, i) => !(token === '?' && isNullableTypeMarker(tokens, i)));
}

// A class-name type hint (`ReflectionParameter $parameter`) is erased the
// same way the primitive names in PHP_DROPPED already are.
function dropClassNameTypeHints(tokens)
{
    return tokens.filter((token, i) => !(/^[A-Z]/.test(token) && tokens[i + 1]?.startsWith('$')));
}

// PHP_DROPPED's keywords and a bare `;` both have nothing on the TS side to
// line up against either.
function dropPhpNoise(tokens)
{
    return tokens.filter((token) => token !== ';' && !PHP_DROPPED.has(token));
}

// `->{EXPR}` (dynamic property/method access by variable name) spells as
// `[EXPR]` - there is no TS equivalent of PHP's curly-brace member syntax,
// only bracket indexing, so this reads the same as any other keyed access.
// Depth-tracked (not a fixed token count) since EXPR itself could be more
// than one token. Must run before rewriteMemberAccessOperators (which would
// otherwise have already turned the `->` this looks for into `.`) - see the
// module docblock for why its recursive call needs to run this early too.
function foldDynamicMemberAccess(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '->' && tokens[i + 1] === '{') {
            let depth = 0;
            let close = -1;
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j] === '{') depth++;
                else if (tokens[j] === '}') {
                    depth--;
                    if (depth === 0) {
                        close = j;
                        break;
                    }
                }
            }
            if (close !== -1) {
                const inner = canonicalizePhp(tokens.slice(i + 2, close));
                out.push('[', ...inner, ']');
                i = close;
                continue;
            }
        }
        out.push(token);
    }
    return out;
}

// `elseif` is one PHP token; TS only has `else` `if` as two - same
// construct, just never spelled as one word there.
function foldElseif(tokens)
{
    return tokens.flatMap((token) => (token === 'elseif' ? ['else', 'if'] : [token]));
}

// `(new X(...))->method()`: the outer parens exist only because Laravel's
// own style always wraps a `new` expression before chaining off of it
// (older PHP required this to chain at all); `new X(...).method()` chains
// directly in TS/JS, no parens needed. Stripped only in front of `->`/`::`
// specifically, not every parenthesized `new` (a `(new X())` passed as a
// plain argument has nothing chained after it to make the parens
// redundant). Must run before rewriteMemberAccessOperators, same reason as
// foldDynamicMemberAccess above.
function stripRedundantNewParens(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '(' && tokens[i + 1] === 'new') {
            let newDepth = 0;
            let newClose = -1;
            for (let j = i; j < tokens.length; j++) {
                if (tokens[j] === '(') newDepth++;
                else if (tokens[j] === ')') {
                    newDepth--;
                    if (newDepth === 0) {
                        newClose = j;
                        break;
                    }
                }
            }
            if (newClose !== -1 && (tokens[newClose + 1] === '->' || tokens[newClose + 1] === '::')) {
                const inner = canonicalizePhp(tokens.slice(i + 1, newClose));
                out.push(...inner);
                i = newClose;
                continue;
            }
        }
        out.push(token);
    }
    return out;
}

function stripVariableSigils(tokens)
{
    return tokens.map((token) => (token.startsWith('$') ? token.slice(1) : token));
}

// instanceof-closure: `$x instanceof Closure` spells as `typeIs(x,
// 'function')` - a closure is a bare function value. Only the single-token
// receiver this file's one occurrence has is handled (the token
// immediately before `instanceof`); a multi-token receiver would need
// popping more than one, which nothing here needs yet. Must run after
// stripVariableSigils: the receiver this pops has to already be bare (no
// `$`), matching what the original single-loop implementation saw (sigils
// were stripped before this check ran, for the *previous* token, within
// the same left-to-right pass).
function foldInstanceofClosure(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'instanceof' && tokens[i + 1] === 'Closure') {
            const receiver = out.pop();
            out.push('typeIs', '(', receiver, ',', 'str:function', ')');
            i++; // consume 'Closure' too
            continue;
        }
        out.push(tokens[i]);
    }
    return out;
}

function rewriteMemberAccessOperators(tokens)
{
    return tokens.map((token) => (token === '->' || token === '::' ? '.' : token));
}

function renameConstructorToken(tokens)
{
    return tokens.map((token) => (token === '__construct' ? 'constructor' : token));
}

// nullable-default (CONVENTIONS.md): a PHP `= null` parameter default has
// nothing to match on the TS side - an omitted argument already reads as
// `undefined` there, so the port doesn't write a default at all. Scoped to
// the member's own top-level parameter list specifically (not just any
// `= null` - a body-level assignment is a real statement TS should still
// have *something* to match).
function stripParamDefaults(tokens)
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

    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        if (i > openIndex && i < closeIndex && tokens[i] === '=' && tokens[i + 1] === 'null') {
            i++;
            continue;
        }
        out.push(tokens[i]);
    }
    return out;
}

// func_num_args() (CONVENTIONS.md): PHP calls it with zero arguments,
// reading the current call frame implicitly - there is no Luau equivalent
// (confirmed: `arguments`/`arguments.length` is rejected outright by
// roblox-ts, and `select('#', ...)` only sees the true count *before* a
// `...args: T[]` rest parameter collapses it, which happens unconditionally
// before any TS-compiled body runs). This port's own func_num_args() must
// be handed the packed-args table explicitly instead. Canonicalized to the
// shape the TS side actually has - `func_num_args(args)`, `args` because
// canonicalizeTs's unRename already strips `_args`'s leading underscore -
// so this necessary, documented divergence doesn't cost fidelity on every
// call site.
export function foldFuncNumArgsCall(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'func_num_args' && tokens[i + 1] === '(' && tokens[i + 2] === ')') {
            out.push('func_num_args', '(', 'args', ')');
            i += 2;
            continue;
        }
        out.push(tokens[i]);
    }
    return out;
}

// Companion to the func_num_args() call-site fold above, for the *signature*
// side of the same divergence: a member TableArgs.luau's decorator wraps
// (see ts-ast-utils.mjs's findPackedArgsDecoratedMembers) carries one extra
// leading TS-only parameter - the packed-args table - that PHP's own
// signature has no counterpart for at all (unlike func_num_args()'s call
// sites, there's no PHP token here to fold *from*; one has to be
// synthesized). Matches canonicalizeTs's post-unRename spelling (`args`, no
// leading underscore).
export function foldPackedArgsParam(tokens)
{
    const openIndex = tokens.indexOf('(');
    if (openIndex === -1) return tokens;
    const insertion = tokens[openIndex + 1] === ')' ? ['args'] : ['args', ','];
    return [...tokens.slice(0, openIndex + 1), ...insertion, ...tokens.slice(openIndex + 1)];
}

export function canonicalizePhp(rawTokens, hasPackedArgsParam)
{
    // Whitespace tokens (T_WHITESPACE carries its own text in the flat
    // dump) have to go *before* the folds below, not after: `= null` in
    // the source is actually three raw tokens, `=`, ` `, `null`, and a
    // fold pattern-matching on adjacent token text would never see them
    // as adjacent otherwise.
    const withoutWhitespace = rawTokens.filter((t) => !/^\s+$/.test(t));
    let tokens = foldFuncNumArgsCall(stripParamDefaults(withoutWhitespace));
    if (hasPackedArgsParam) tokens = foldPackedArgsParam(tokens);

    return pipe(tokens, [
        foldDynamicMemberAccess,
        foldElseif,
        stripRedundantNewParens,
        dropNullableTypeMarkers,
        dropClassNameTypeHints,
        dropPhpNoise,
        canonicalizeStringLiterals,
        stripVariableSigils,
        foldInstanceofClosure,
        rewriteMemberAccessOperators,
        renameConstructorToken,
    ]);
}

// A leading underscore is this port's one general escape hatch
// (CONVENTIONS.md: reserved words and property/method name collisions
// both take it, one underscore - `_default`, `_condition`). `__call`
// takes it too, but PHP's own magic methods already spell themselves with
// two underscores (`__get`, `__call`), so a name that already has exactly
// two must be left alone - stripping one from `__get` would wrongly turn
// it into `_get`, matching nothing. Only one leading underscore (-> zero)
// or three (-> two, `___call` -> `__call`) are this port's own doing.
export function unRename(token)
{
    const leading = token.match(/^_+/)?.[0].length ?? 0;
    return leading === 1 || leading === 3 ? token.slice(1) : token;
}

// Collects [start, end) character ranges (into sourceFile.text) that are
// pure type syntax with nothing on the PHP side to line up against -
// `: Type` annotations, `as Type`/`as unknown as Type` casts, a trailing
// non-null `!`, a method's own `<T>` type parameter list - so they can be
// cut before tokenizing at all.
//
// This used to be a token-level heuristic (skip forward from `:`/`as`
// until a bracket-depth-aware stop token). It broke on exactly the
// shortest possible case, `(): this { ... }`: nothing in a flat token
// stream distinguishes the method body's own opening `{` from an object
// type literal's, so the "skip the return type" scan just kept going and
// swallowed the entire body looking for a matching close. The AST already
// knows precisely where each type node starts and ends; asking it directly
// has no such ambiguity to get wrong.
export function collectTypeRanges(node, sourceFile, ranges)
{
    const text = sourceFile.text;

    function withType(n)
    {
        // A bare `?` optionality marker (parameter or property) has nothing
        // on the PHP side to match either - same "nullable-default"
        // convention as a PHP `= null` default already erasing to nothing,
        // just spelled on the declaration instead of a default value.
        if (n.questionToken) ranges.push([n.questionToken.getStart(sourceFile), n.questionToken.getEnd()]);
        if (!n.type) return;
        const colon = text.lastIndexOf(':', n.type.getStart(sourceFile));
        ranges.push([colon, n.type.getEnd()]);
    }

    function visit(n)
    {
        if (
            ts.isParameter(n) || ts.isPropertyDeclaration(n) || ts.isMethodDeclaration(n)
            || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n)
        ) {
            withType(n);
        }
        if ((ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n)) && n.typeParameters?.length) {
            const first = n.typeParameters[0];
            const last = n.typeParameters[n.typeParameters.length - 1];
            const lt = text.lastIndexOf('<', first.getStart(sourceFile));
            const gt = text.indexOf('>', last.getEnd());
            ranges.push([lt, gt + 1]);
        }
        if (ts.isAsExpression(n)) {
            const as = text.lastIndexOf('as', n.type.getStart(sourceFile));
            ranges.push([as, n.type.getEnd()]);
        }
        if (ts.isNonNullExpression(n)) {
            ranges.push([n.expression.getEnd(), n.getEnd()]);
        }
        // `(x as Y)(...)`/`(x as Y).z` - parens exist only so the cast can
        // be called/accessed; once the cast itself is stripped above they
        // are redundant (`value(this)` parses the same as `(value)(this)`)
        // and PHP never had a matching pair to line up against anyway.
        if (ts.isParenthesizedExpression(n) && ts.isAsExpression(n.expression)) {
            ranges.push([n.getStart(sourceFile), n.getStart(sourceFile) + 1]);
            ranges.push([n.getEnd() - 1, n.getEnd()]);
        }
        ts.forEachChild(n, visit);
    }

    visit(node);
}

export function stripTypesFromText(node, sourceFile)
{
    const ranges = [];
    collectTypeRanges(node, sourceFile, ranges);
    ranges.sort((a, b) => a[0] - b[0]);

    const text = sourceFile.text;
    const nodeStart = node.getStart(sourceFile);
    const nodeEnd = node.getEnd();

    let result = '';
    let cursor = nodeStart;
    for (const [start, end] of ranges) {
        if (start < cursor || start >= nodeEnd) continue; // already covered, or belongs to a different member
        result += text.slice(cursor, start);
        cursor = Math.max(cursor, end);
    }
    result += text.slice(cursor, nodeEnd);
    return result;
}

// Matches PHP_DROPPED's own unconditional 'static' drop (not just a leading
// modifier position - neither PHP nor TS ever lets 'static' be a plain
// identifier, so dropping every occurrence is safe on both sides).
// 'const'/'let' too: PHP has no local-variable-declaration keyword at all
// (the first assignment doubles as the declaration), so a statement-level
// one never has anything on the PHP side to line up against.
const TS_DROPPED = new Set(['public', 'private', 'protected', 'readonly', 'static', 'const', 'let']);

function dropTsNoise(tokens)
{
    return tokens.filter((token) => token !== ';' && !TS_DROPPED.has(token));
}

// trailing-comma: a `,` immediately before a `)` is syntactically optional
// and semantically a no-op in JS/TS - this port's own multi-line parameter
// lists always write one (matching the rest of the file's formatting
// convention), but a single-line PHP signature never has anywhere to put
// one. Dropped unconditionally rather than scoped to parameter-list
// position specifically: it's a no-op everywhere it can legally appear, so
// there's nothing to lose by not scoping this.
function dropTrailingCommaBeforeCloseParen(tokens)
{
    return tokens.filter((token, i) => !(token === ',' && tokens[i + 1] === ')'));
}

// truthiness (CONVENTIONS.md territory, if not yet written down there):
// `truthy(X)` exists purely to replicate PHP's own implicit bool coercion
// in a condition position - PHP never spells that coercion as a function
// call, so unwrapping it here is normalizing the spelling of one accepted
// convention, not inferring anywhere-truthy() *should* have been used but
// wasn't (a call to it has to already be there in the tokens for this to
// fire at all). Must run before dropTsNoise/dropTrailingCommaBeforeCloseParen
// - see the module docblock for why its recursive call needs to run this
// early.
function unwrapTruthyCalls(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'truthy' && tokens[i + 1] === '(') {
            let depth = 0;
            let close = -1;
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j] === '(') depth++;
                else if (tokens[j] === ')') {
                    depth--;
                    if (depth === 0) {
                        close = j;
                        break;
                    }
                }
            }
            if (close !== -1) {
                out.push(...canonicalizeTs(tokens.slice(i + 2, close)));
                i = close;
                continue;
            }
        }
        out.push(tokens[i]);
    }
    return out;
}

function unRenameTokens(tokens)
{
    return tokens.map(unRename);
}

export function canonicalizeTs(tokens)
{
    return pipe(tokens, [
        unwrapTruthyCalls,
        dropTsNoise,
        dropTrailingCommaBeforeCloseParen,
        canonicalizeStringLiterals,
        unRenameTokens,
    ]);
}

// explicit dynamic-dispatch receiver (HigherOrderWhenProxy's `__call`, and
// any future MagicDispatch-style forwarder): PHP's `$this->target->{$method}(...)`
// binds `$method`'s receiver ($this->target) implicitly, the same way
// Luau's own `:` self-call syntax would for a *literal* method name - but
// `:` requires that literal, so a call whose method name is only known at
// runtime can only ever compile to a plain, non-self Luau function call
// (confirmed against the compiled .luau output:
// `(self.target)[method](self.target, unpack(parameters))`). The port has
// to re-pass the receiver as an explicit first call argument to get the
// binding PHP/Luau give for free with a literal name - forced by the
// platform, not a bug, so (matching func_num_args()'s own precedent) it
// shouldn't cost fidelity either.
export function foldExplicitDynamicDispatchReceiver(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '[') {
            let depth = 0;
            let close = -1;
            for (let j = i; j < tokens.length; j++) {
                if (tokens[j] === '[') depth++;
                else if (tokens[j] === ']') {
                    depth--;
                    if (depth === 0) {
                        close = j;
                        break;
                    }
                }
            }
            if (close !== -1 && tokens[close + 1] === '(') {
                // The receiver is the dot-chain (`this . target`) already
                // pushed to `out` immediately before this `[`.
                let start = out.length;
                let expectIdent = true;
                while (start > 0) {
                    const t = out[start - 1];
                    if (expectIdent && /^[A-Za-z_$][\w$]*$/.test(t)) {
                        start--;
                        expectIdent = false;
                    } else if (!expectIdent && t === '.') {
                        start--;
                        expectIdent = true;
                    } else {
                        break;
                    }
                }
                const receiver = expectIdent ? [] : out.slice(start);
                const argsStart = close + 2;
                if (
                    receiver.length > 0 &&
                    receiver.every((t, k) => tokens[argsStart + k] === t) &&
                    tokens[argsStart + receiver.length] === ','
                ) {
                    out.push(...tokens.slice(i, close + 2));
                    i = argsStart + receiver.length; // skip the duplicated receiver and its comma
                    continue;
                }
            }
        }
        out.push(tokens[i]);
    }
    return out;
}

export function lcsLength(a, b)
{
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

export function mirrorFidelity(phpTokens, tsTokens)
{
    if (phpTokens.length === 0 && tsTokens.length === 0) return 100;
    const common = lcsLength(phpTokens, tsTokens);
    const longer = Math.max(phpTokens.length, tsTokens.length);
    return Math.round((common / longer) * 1000) / 10;
}
