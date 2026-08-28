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
    return out;
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
        if (token === ';') continue;
        if (isStringToken(token)) {
            out.push(canonicalString(token));
            continue;
        }
        // `A.b` may canonicalize as one dotted name (Arr.reverse -> array_reverse).
        const dotted = `${token}.${tokens[index + 2] ?? ''}`;
        if (tokens[index + 1] === '.' && tsToCanon.has(dotted)) {
            out.push(tsToCanon.get(dotted));
            index += 2;
            continue;
        }
        if (tsToCanon.has(token)) {
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
    const tsTokens = canonicalizeTs(tokenizeJs(transpiled), renames);
    // Drop the `class __V { ... }` wrapper tokens.
    if (tsTokens[0] === 'class' && tsTokens[1] === '__V') {
        tsTokens.splice(0, 3);
        tsTokens.pop();
    }

    const residue = residueOf(phpTokens, tsTokens);
    const disagreeing = residue.reduce((sum, run) => sum + run.php.length + run.ts.length, 0);
    return { residue, disagreeing, total: phpTokens.length + tsTokens.length };
}
