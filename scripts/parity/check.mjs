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
// Usage: node scripts/parity/check.mjs <path/to/File.ts> [--out=report.csv]
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
    for (const arg of argv) {
        if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
        else positional.push(arg);
    }
    if (positional.length !== 1) {
        console.error('Usage: node scripts/parity/check.mjs <path/to/File.ts> [--out=report.csv]');
        process.exit(1);
    }
    return { tsFile: path.resolve(positional[0]), out };
}

const { tsFile, out } = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------
// PHP side: locate the class via Composer's own autoloader (robust against
// any mismatch between namespace and physical file layout -- e.g.
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
// TS side: find the "main" class -- a plain `export class X {}` or, for a
// trait ported as a mixin, the `class extends Base {}` expression a mixin
// factory function returns -- and list its own members with their exact
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
        if (!member.body) continue; // overload signature, no body -- skip
        tsMembers.push({ name: '__construct', kind: 'method', node: member, ...tsMemberInfo(member) });
    } else if (ts.isMethodDeclaration(member)) {
        if (!member.body) continue; // overload signature -- the implementation carries the real body
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
    'void',
    'self',
    'static',
]);

function canonicalizePhp(tokens)
{
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        if (token === ';' || PHP_DROPPED.has(token)) continue;
        if (/^\s+$/.test(token)) continue; // whitespace tokens from the flat dump
        // A class-name type hint (`ReflectionParameter $parameter`) is
        // erased the same way the primitive names above already are.
        if (/^[A-Z]/.test(token) && tokens[i + 1]?.startsWith('$')) continue;
        // `->{EXPR}` (dynamic property/method access by variable name)
        // spells as `[EXPR]` -- there is no TS equivalent of PHP's curly-
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
        if (isStringToken(token)) {
            out.push(canonicalString(token));
            continue;
        }
        // instanceof-closure: `$x instanceof Closure` spells as
        // `typeIs(x, 'function')` -- a closure is a bare function value.
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
// (CONVENTIONS.md: reserved words, property/method name collisions, and
// __call all take it) -- stripping exactly one from every TS identifier
// covers all three without needing a specific rule per case, since PHP's
// own `__call` already carries two underscores and the port's `___call`
// carries one more than that.
function unRename(token)
{
    return token.startsWith('_') && token.length > 1 ? token.slice(1) : token;
}

// Collects [start, end) character ranges (into sourceFile.text) that are
// pure type syntax with nothing on the PHP side to line up against --
// `: Type` annotations, `as Type`/`as unknown as Type` casts, a trailing
// non-null `!`, a method's own `<T>` type parameter list -- so they can be
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
        // on the PHP side to match either -- same "nullable-default"
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
        // `(x as Y)(...)`/`(x as Y).z` -- parens exist only so the cast can
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
// modifier position -- neither PHP nor TS ever lets 'static' be a plain
// identifier, so dropping every occurrence is safe on both sides).
const TS_DROPPED = new Set(['public', 'private', 'protected', 'readonly', 'static']);

function canonicalizeTs(tokens)
{
    const out = [];
    for (const token of tokens) {
        if (token === ';' || TS_DROPPED.has(token)) continue;
        if (isStringToken(token)) {
            out.push(canonicalString(token));
            continue;
        }
        out.push(unRename(token));
    }
    return out;
}

// ---------------------------------------------------------------------
// Longest common subsequence -- the residue is everything not part of it,
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

// ---------------------------------------------------------------------
// Match PHP members to TS members (applying the underscore convention to
// the name itself, not just body tokens) and compute fidelity for each.
// ---------------------------------------------------------------------

function tsNameCandidates(tsMember)
{
    return [tsMember.name, unRename(tsMember.name)];
}

const rows = [];
const matchedTsMembers = new Set();

for (const phpMember of phpData.members) {
    const tsMember = tsMembers.find(
        (m) => !matchedTsMembers.has(m) && m.kind === phpMember.kind && tsNameCandidates(m).includes(phpMember.name),
    );

    const phpTokens = canonicalizePhp(phpMemberTokens(phpMember));

    if (!tsMember) {
        rows.push({
            laravel_path: path.relative(upstreamRoot, phpData.file),
            declaration: fqcn.split('\\').pop(),
            member: phpMember.name,
            kind: phpMember.kind,
            status: 'missing',
            php_line: phpMember.startLine,
            ts_line: '',
            mirror_fidelity: 0,
        });
        continue;
    }

    matchedTsMembers.add(tsMember);
    const tsText = stripTypesFromText(tsMember.node, sourceFile);
    const tsTokens = canonicalizeTs(tokenizeJs(tsText));

    rows.push({
        laravel_path: path.relative(upstreamRoot, phpData.file),
        declaration: fqcn.split('\\').pop(),
        member: phpMember.name,
        kind: phpMember.kind,
        status: 'both',
        php_line: phpMember.startLine,
        ts_line: sourceFile.getLineAndCharacterOfPosition(tsMember.node.getStart(sourceFile)).line + 1,
        mirror_fidelity: mirrorFidelity(phpTokens, tsTokens),
    });
}

for (const tsMember of tsMembers) {
    if (matchedTsMembers.has(tsMember)) continue;
    rows.push({
        laravel_path: path.relative(upstreamRoot, phpData.file),
        declaration: fqcn.split('\\').pop(),
        member: tsMember.name,
        kind: tsMember.kind,
        status: 'port-only',
        php_line: '',
        ts_line: sourceFile.getLineAndCharacterOfPosition(tsMember.node.getStart(sourceFile)).line + 1,
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

const header = ['laravel_path', 'declaration', 'member', 'kind', 'status', 'php_line', 'ts_line', 'mirror_fidelity'];
const csvLines = [header.join(','), ...rows.map((row) => header.map((key) => csvField(row[key])).join(','))];
const csv = csvLines.join('\n') + '\n';

if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, csv);
    console.log(`Wrote ${rows.length} row(s) to ${out}`);
} else {
    process.stdout.write(csv);
}
