#!/usr/bin/env node
// Runs check.mjs over every ported .ts file under src/Illuminate/ - the
// mirror of upstream; src/Larablox/ is the port's own runtime with no
// Laravel twin and is never a candidate - and merges the results into one
// CSV, instead of invoking it by hand, file by file, as
// scripts/parity/check.mjs's own header comment still shows. check.mjs
// itself stays a single-file tool - this only adds the "run it over
// everything" loop on top, spawning one `node check.mjs <file>` per
// candidate so check.mjs's own CLI/exit-code behavior needs no changes.
//
// A .ts file with no class at all (helpers.ts - free functions) is skipped
// before ever invoking check.mjs: it would refuse to run on such a file
// anyway, and that's expected here, not a bug to report. That does mean a
// helper ported from upstream's helpers.php (tap()) goes unmeasured -
// check.mjs only compares class members. A file
// that DOES declare a class but check.mjs still can't match an upstream PHP
// twin for (no such class in .upstream, or a namespace/path mismatch) is
// reported separately, as something to look at - it produced no rows, so
// there's nothing to fold into the CSV.
//
// Prints to stdout by default, matching check.mjs's own convention - pass
// --out=<path> to write to a file instead (`npm run parity` does, into
// reports/parity/all.csv - see package.json).
//
// Usage: node scripts/parity/aggregate.mjs [--out=report.csv]
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { findClassNode, findTsFiles } from './ts-ast-utils.mjs';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(projectRoot, 'src', 'Illuminate');
const checkScript = path.join(projectRoot, 'scripts/parity/check.mjs');
const defaultHeader = 'declaration,member,kind,mirror_fidelity,laravel_path,ts_path';

function parseArgs(argv)
{
    let out;
    for (const arg of argv) {
        if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
    }
    return { out };
}

const { out } = parseArgs(process.argv.slice(2));

function hasClass(file)
{
    const text = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
    return Boolean(findClassNode(sourceFile));
}

const candidates = findTsFiles(srcRoot).filter(hasClass).sort();

let header = defaultHeader;
const rows = [];
const unmatchedFiles = [];

for (const file of candidates) {
    let stdout;
    try {
        stdout = execFileSync('node', [checkScript, file], { encoding: 'utf8' });
    } catch (error) {
        unmatchedFiles.push({
            file: path.relative(projectRoot, file),
            reason: (error.stderr ?? error.message).trim().split('\n').pop(),
        });
        continue;
    }
    const [fileHeader, ...dataLines] = stdout.trimEnd().split('\n');
    header = fileHeader;
    rows.push(...dataLines);
}

const csv = [header, ...rows].join('\n') + '\n';

if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, csv);
    console.log(`Wrote ${rows.length} row(s) from ${candidates.length - unmatchedFiles.length} file(s) to ${out}`);
} else {
    process.stdout.write(csv);
}

// A quick, scannable worklist alongside the full CSV: anything short of a
// verbatim mirror, most-divergent first. mirror_fidelity is blank (not 0)
// for a TS member with no matching PHP member at all - still worth
// surfacing here, just sorted last among the non-100 rows.
const attention = rows
    .map((line) => line.split(','))
    .filter(([, , , fidelity]) => fidelity !== '100')
    .sort((a, b) => (Number(b[3]) || -1) - (Number(a[3]) || -1));

if (attention.length > 0) {
    console.error(`\n${attention.length} member(s) below 100% mirror fidelity:`);
    for (const [declaration, member, kind, fidelity] of attention) {
        console.error(`  ${declaration}::${member} (${kind}): ${fidelity === '' ? 'no PHP match' : fidelity + '%'}`);
    }
}

if (unmatchedFiles.length > 0) {
    console.error(`\n${unmatchedFiles.length} file(s) with a class but no matched upstream PHP twin:`);
    for (const { file, reason } of unmatchedFiles) {
        console.error(`  ${file}: ${reason}`);
    }
}
