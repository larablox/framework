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
// The canonicalization rules themselves (and why order matters for a few
// of them) live in scripts/parity/canonicalize.mjs, as plain, side-effect-
// free functions - see canonicalize.test.mjs for coverage of each one.
//
// Usage: node scripts/parity/check.mjs <path/to/File.ts> [--out=report.csv] [--show=memberName]
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { collectClassMembers, findClassNode, findPackedArgsDecoratedMembers } from './ts-ast-utils.mjs';
import {
    canonicalizePhp,
    canonicalizeTs,
    foldExplicitDynamicDispatchReceiver,
    mirrorFidelity,
    stripTypesFromText,
    tokenizeJs,
    unRename,
} from './canonicalize.mjs';

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
// TS side: find the "main" class and list its own members with their exact
// source text.
// ---------------------------------------------------------------------

const tsSourceText = fs.readFileSync(tsFile, 'utf8');
const sourceFile = ts.createSourceFile(tsFile, tsSourceText, ts.ScriptTarget.ESNext, true);

const classNode = findClassNode(sourceFile);
if (!classNode) {
    console.error(`Could not find a class declaration/expression in ${tsFile}`);
    process.exit(1);
}

const tsMembers = collectClassMembers(classNode, sourceFile);

// --show=<member> diagnostic: prints the two canonicalized token streams
// aligned as runs of tokens present on only one side (an LCS backtrack, not
// just the length mirrorFidelity's own LCS returns), so it's visible
// exactly what a fold would need to bridge instead of guessing from the
// percentage alone.
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

// foldPackedArgsParam only ever applies to members genuinely wrapped by
// decoratePackedArgs() - see ts-ast-utils.mjs for how those are found.
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
