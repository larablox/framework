#!/usr/bin/env node
// Compares one ported .ts file against its upstream Laravel PHP twin,
// member by member, and reports a mirror-fidelity percentage for each
// method/property: (tokens in common) / (tokens on the longer side) * 100,
// after canonicalizing away the differences CONVENTIONS.md already accepts
// (visibility keywords, PHP variable sigils, the leading-underscore rename
// convention, type annotations and casts TS/PHP don't share, etc).
//
// This is advisory, the same way the deleted parity tool was: an empty
// residue is strong evidence of a verbatim mirror; a non-empty one is a
// worklist to justify by hand, not proof of a bug by itself.
//
// Usage: node scripts/parity/check.mjs <path/to/File.ts> [--out=report.csv] [--show=memberName]
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv)
{
    const positional = [];
    let out;
    let show;
    for (const arg of argv) {
        if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
        else if (arg.startsWith('--show=')) show = arg.slice('--show='.length);
        else positional.push(arg);
    }
    if (positional.length !== 1) {
        console.error('Usage: node scripts/parity/check.mjs <path/to/File.ts> [--out=report.csv] [--show=memberName]');
        process.exit(1);
    }
    return { tsFile: path.resolve(positional[0]), out, show };
}

const { tsFile, out, show } = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------
// PHP side: locate the class via Composer's own autoloader (robust against
// any mismatch between namespace and physical file layout - e.g.
// Illuminate\Support\Traits\Conditionable actually lives under this
// upstream's Illuminate/Conditionable/), then list its own members.
// ---------------------------------------------------------------------

const srcRoot = path.join(projectRoot, 'src');
const relativeToSrc = path.relative(srcRoot, tsFile).replace(/\.ts$/, '');
const fqcn = relativeToSrc.split(path.sep).join('\\');
const upstreamRoot = path.join(projectRoot, '.upstream');

let phpData;
try {
    const stdout = execFileSync('php', [path.join(projectRoot, 'scripts/parity/extract-php.php'), upstreamRoot, fqcn], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
    });
    phpData = JSON.parse(stdout);
} catch (error) {
    console.error(`Could not extract PHP member data for ${fqcn}:`);
    console.error(error.stderr ?? error.message);
    process.exit(1);
}

function phpMemberTokens(member)
{
    return phpData.tokens
        .filter((t) => t.line >= member.startLine && t.line <= member.endLine)
        .map((t) => t.text);
}

// ---------------------------------------------------------------------
// TS side: find the "main" class - a plain `export class X {}` or, for a
// trait ported as a mixin, the `class extends Base {}` expression a mixin
// factory function returns - and list its own members with their exact
// source text.
// ---------------------------------------------------------------------

const tsSourceText = fs.readFileSync(tsFile, 'utf8');
const sourceFile = ts.createSourceFile(tsFile, tsSourceText, ts.ScriptTarget.ESNext, true);

function findClassNode(root)
{
    let found;
    const visit = (node) => {
        if (found) return;
        if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
}

const classNode = findClassNode(sourceFile);
if (!classNode) {
    console.error(`Could not find a class declaration/expression in ${tsFile}`);
    process.exit(1);
}

function tsMemberInfo(member)
{
    const hasModifier = (kind) => (ts.getModifiers(member) ?? []).some((m) => m.kind === kind);
    const isStatic = hasModifier(ts.SyntaxKind.StaticKeyword);
    const visibility = hasModifier(ts.SyntaxKind.PrivateKeyword)
        ? 'private'
        : hasModifier(ts.SyntaxKind.ProtectedKeyword)
        ? 'protected'
        : 'public';

    return { isStatic, visibility };
}

const tsMembers = [];
for (const member of classNode.members) {
    if (ts.isConstructorDeclaration(member)) {
        if (!member.body) continue; // overload signature, no body - skip
        tsMembers.push({ name: '__construct', kind: 'method', node: member, ...tsMemberInfo(member) });
    } else if (ts.isMethodDeclaration(member)) {
        if (!member.body) continue; // overload signature - the implementation carries the real body
        tsMembers.push({ name: member.name.getText(sourceFile), kind: 'method', node: member, ...tsMemberInfo(member) });
    } else if (ts.isPropertyDeclaration(member)) {
        tsMembers.push({ name: member.name.getText(sourceFile), kind: 'property', node: member, ...tsMemberInfo(member) });
    }
}

// ---------------------------------------------------------------------
// Tokenizing + canonicalizing each side.
// ---------------------------------------------------------------------

const JS_TOKEN =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|\d[\w.]*|===|!==|\?\?=|\?\?|\*\*=?|=>|\.\.\.|&&|\|\||\+\+|--|[+\-*/%<>=!&|^]=|<=|>=|[{}()[\].,;:?<>+\-*/%=!&|^~]/g;

function tokenizeJs(text)
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
function foldFuncNumArgsCall(tokens)
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
// (see findPackedArgsDecoratedMembers) carries one extra leading TS-only
// parameter - the packed-args table - that PHP's own signature has no
// counterpart for at all (unlike func_num_args()'s call sites, there's no
// PHP token here to fold *from*; one has to be synthesized). Matches
// canonicalizeTs's post-unRename spelling (`args`, no leading underscore).
function foldPackedArgsParam(tokens)
{
    const openIndex = tokens.indexOf('(');
    if (openIndex === -1) return tokens;
    const insertion = tokens[openIndex + 1] === ')' ? ['args'] : ['args', ','];
    return [...tokens.slice(0, openIndex + 1), ...insertion, ...tokens.slice(openIndex + 1)];
}

function canonicalizePhp(rawTokens, hasPackedArgsParam)
{
    // Whitespace tokens (T_WHITESPACE carries its own text in the flat
    // dump) have to go *before* the folds below, not after: `= null` in
    // the source is actually three raw tokens, `=`, ` `, `null`, and a
    // fold pattern-matching on adjacent token text would never see them
    // as adjacent otherwise.
    const withoutWhitespace = rawTokens.filter((t) => !/^\s+$/.test(t));
    let tokens = foldFuncNumArgsCall(stripParamDefaults(withoutWhitespace));
    if (hasPackedArgsParam) tokens = foldPackedArgsParam(tokens);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        if (token === ';' || PHP_DROPPED.has(token)) continue;
        if (token === '?' && isNullableTypeMarker(tokens, i)) continue;
        // A class-name type hint (`ReflectionParameter $parameter`) is
        // erased the same way the primitive names above already are.
        if (/^[A-Z]/.test(token) && tokens[i + 1]?.startsWith('$')) continue;
        // `->{EXPR}` (dynamic property/method access by variable name)
        // spells as `[EXPR]` - there is no TS equivalent of PHP's curly-
        // brace member syntax, only bracket indexing, so this reads the
        // same as any other keyed access. Depth-tracked (not a fixed token
        // count) since EXPR itself could be more than one token.
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
        // `elseif` is one PHP token; TS only has `else` `if` as two -
        // same construct, just never spelled as one word there.
        if (token === 'elseif') {
            out.push('else', 'if');
            continue;
        }
        // `(new X(...))->method()`: the outer parens exist only because
        // Laravel's own style always wraps a `new` expression before
        // chaining off of it (older PHP required this to chain at all);
        // `new X(...).method()` chains directly in TS/JS, no parens
        // needed. Stripped only in front of `->`/`::` specifically, not
        // every parenthesized `new` (a `(new X())` passed as a plain
        // argument has nothing chained after it to make the parens
        // redundant).
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
        if (isStringToken(token)) {
            out.push(canonicalString(token));
            continue;
        }
        // instanceof-closure: `$x instanceof Closure` spells as
        // `typeIs(x, 'function')` - a closure is a bare function value.
        // Only the single-token receiver this file's one occurrence has is
        // handled (the last token already pushed); a multi-token receiver
        // would need popping more than one, which nothing here needs yet.
        if (token === 'instanceof' && tokens[i + 1] === 'Closure') {
            const receiver = out.pop();
            out.push('typeIs', '(', receiver, ',', 'str:function', ')');
            i++; // consume 'Closure' too
            continue;
        }
        if (token.startsWith('$')) token = token.slice(1);
        if (token === '->' || token === '::') token = '.';
        if (token === '__construct') token = 'constructor';
        out.push(token);
    }
    return out;
}

// A leading underscore is this port's one general escape hatch
// (CONVENTIONS.md: reserved words and property/method name collisions
// both take it, one underscore - `_default`, `_condition`). `__call`
// takes it too, but PHP's own magic methods already spell themselves with
// two underscores (`__get`, `__call`), so a name that already has exactly
// two must be left alone - stripping one from `__get` would wrongly turn
// it into `_get`, matching nothing. Only one leading underscore (-> zero)
// or three (-> two, `___call` -> `__call`) are this port's own doing.
function unRename(token)
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
function collectTypeRanges(node, sourceFile, ranges)
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

function stripTypesFromText(node, sourceFile)
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

function canonicalizeTs(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === ';' || TS_DROPPED.has(token)) continue;
        // trailing-comma: a `,` immediately before a `)` is syntactically
        // optional and semantically a no-op in JS/TS - this port's own
        // multi-line parameter lists always write one (matching the rest
        // of the file's formatting convention), but a single-line PHP
        // signature never has anywhere to put one. Dropped unconditionally
        // rather than scoped to parameter-list position specifically: it's
        // a no-op everywhere it can legally appear, so there's nothing to
        // lose by not scoping this.
        if (token === ',' && tokens[i + 1] === ')') continue;
        // truthiness (CONVENTIONS.md territory, if not yet written down
        // there): `truthy(X)` exists purely to replicate PHP's own
        // implicit bool coercion in a condition position - PHP never
        // spells that coercion as a function call, so unwrapping it here
        // is normalizing the spelling of one accepted convention, not
        // inferring anywhere-truthy() *should* have been used but wasn't
        // (a call to it has to already be there in the tokens for this to
        // fire at all).
        if (token === 'truthy' && tokens[i + 1] === '(') {
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
        if (isStringToken(token)) {
            out.push(canonicalString(token));
            continue;
        }
        out.push(unRename(token));
    }
    return out;
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
function foldExplicitDynamicDispatchReceiver(tokens)
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

// ---------------------------------------------------------------------
// Longest common subsequence - the residue is everything not part of it,
// aligned as runs of tokens present on only one side.
// ---------------------------------------------------------------------

function lcsLength(a, b)
{
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

function mirrorFidelity(phpTokens, tsTokens)
{
    if (phpTokens.length === 0 && tsTokens.length === 0) return 100;
    const common = lcsLength(phpTokens, tsTokens);
    const longer = Math.max(phpTokens.length, tsTokens.length);
    return Math.round((common / longer) * 1000) / 10;
}

// --show=<member> diagnostic: prints the two canonicalized token streams
// aligned as runs of tokens present on only one side (an LCS backtrack, not
// just the length lcsLength returns), so it's visible exactly what a fold
// would need to bridge instead of guessing from the percentage alone.
function printResidue(name, phpTokens, tsTokens)
{
    const dp = Array.from({ length: phpTokens.length + 1 }, () => new Array(tsTokens.length + 1).fill(0));
    for (let i = 1; i <= phpTokens.length; i++) {
        for (let j = 1; j <= tsTokens.length; j++) {
            dp[i][j] = phpTokens[i - 1] === tsTokens[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const runs = [];
    let phpBuf = [];
    let tsBuf = [];
    const flush = () => {
        if (phpBuf.length || tsBuf.length) runs.unshift({ php: phpBuf, ts: tsBuf });
        phpBuf = [];
        tsBuf = [];
    };
    let i = phpTokens.length;
    let j = tsTokens.length;
    while (i > 0 && j > 0) {
        if (phpTokens[i - 1] === tsTokens[j - 1]) {
            flush();
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            phpBuf.unshift(phpTokens[i - 1]);
            i--;
        } else {
            tsBuf.unshift(tsTokens[j - 1]);
            j--;
        }
    }
    while (i > 0) {
        phpBuf.unshift(phpTokens[--i]);
    }
    while (j > 0) {
        tsBuf.unshift(tsTokens[--j]);
    }
    flush();

    console.error(`--- residue for ${name} ---`);
    for (const run of runs) {
        if (run.php.length) console.error(`  php: ${run.php.join(' ')}`);
        if (run.ts.length) console.error(`  ts : ${run.ts.join(' ')}`);
    }
    console.error('');
}

// ---------------------------------------------------------------------
// Match PHP members to TS members (applying the underscore convention to
// the name itself, not just body tokens) and compute fidelity for each.
// ---------------------------------------------------------------------

function tsNameCandidates(tsMember)
{
    return [tsMember.name, unRename(tsMember.name)];
}

// Finds every member name passed as the 2nd argument to a real call of
// whatever local name TableArgs.d.ts's `decoratePackedArgs` export is
// imported/aliased as in this file - rather than hardcoding that name, in
// case it's renamed again (as it already has been once). Driven by actual
// call sites, not a fixed list, so foldPackedArgsParam only ever applies to
// members genuinely wrapped this way.
function findPackedArgsDecoratedMembers(sourceFile)
{
    let localName;
    ts.forEachChild(sourceFile, (node) => {
        if (!ts.isImportDeclaration(node) || !node.moduleSpecifier.getText(sourceFile).includes('TableArgs')) return;
        const namedBindings = node.importClause?.namedBindings;
        if (!namedBindings || !ts.isNamedImports(namedBindings)) return;
        for (const element of namedBindings.elements) {
            if ((element.propertyName ?? element.name).text === 'decoratePackedArgs') {
                localName = element.name.text;
            }
        }
    });

    const decorated = new Set();
    if (!localName) return decorated;

    const visit = (node) => {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === localName &&
            node.arguments.length === 2 &&
            ts.isStringLiteralLike(node.arguments[1])
        ) {
            decorated.add(node.arguments[1].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return decorated;
}

const packedArgsDecoratedMembers = findPackedArgsDecoratedMembers(sourceFile);

const rows = [];
const matchedTsMembers = new Set();

for (const phpMember of phpData.members) {
    const tsMember = tsMembers.find(
        (m) => !matchedTsMembers.has(m) && m.kind === phpMember.kind && tsNameCandidates(m).includes(phpMember.name),
    );

    const phpTokens = canonicalizePhp(phpMemberTokens(phpMember), packedArgsDecoratedMembers.has(phpMember.name));

    if (!tsMember) {
        rows.push({
            laravel_path: path.relative(upstreamRoot, phpData.file),
            ts_path: path.relative(projectRoot, tsFile),
            declaration: fqcn.split('\\').pop(),
            member: phpMember.name,
            kind: phpMember.kind,
            mirror_fidelity: 0,
        });
        continue;
    }

    matchedTsMembers.add(tsMember);
    const tsText = stripTypesFromText(tsMember.node, sourceFile);
    const tsTokens = foldExplicitDynamicDispatchReceiver(canonicalizeTs(tokenizeJs(tsText)));

    if (show === phpMember.name) printResidue(phpMember.name, phpTokens, tsTokens);

    rows.push({
        laravel_path: path.relative(upstreamRoot, phpData.file),
        ts_path: path.relative(projectRoot, tsFile),
        declaration: fqcn.split('\\').pop(),
        member: phpMember.name,
        kind: phpMember.kind,
        mirror_fidelity: mirrorFidelity(phpTokens, tsTokens),
    });
}

for (const tsMember of tsMembers) {
    if (matchedTsMembers.has(tsMember)) continue;
    rows.push({
        laravel_path: path.relative(upstreamRoot, phpData.file),
        ts_path: path.relative(projectRoot, tsFile),
        declaration: fqcn.split('\\').pop(),
        member: tsMember.name,
        kind: tsMember.kind,
        mirror_fidelity: '',
    });
}

// ---------------------------------------------------------------------
// CSV output.
// ---------------------------------------------------------------------

function csvField(value)
{
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const header = ['declaration', 'member', 'kind', 'mirror_fidelity', 'laravel_path', 'ts_path'];
const csvLines = [header.join(','), ...rows.map((row) => header.map((key) => csvField(row[key])).join(','))];
const csv = csvLines.join('\n') + '\n';

if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, csv);
    console.log(`Wrote ${rows.length} row(s) to ${out}`);
} else {
    process.stdout.write(csv);
}
