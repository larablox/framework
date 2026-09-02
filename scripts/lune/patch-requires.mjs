#!/usr/bin/env node
// rbxtsc's compiled output always calls into Roblox's Instance-based module
// system (`TS.import(script, ancestor, ...segments)`, itself resting on
// `local TS = _G[script]` and, transitively, on `require(instance)`) --
// there is no compiler flag for anything else, because the *shipped
// package* (out/) genuinely needs that: it runs inside a real Roblox
// DataModel, where `script` exists and Roblox's own `require` accepts an
// Instance. Lune has neither: no `script` global, and its `require` rejects
// an Instance outright (confirmed empirically: "bad argument #1 to
// 'require' (string expected, got userdata)").
//
// Rather than emulate a DataModel under Lune (build a fake Instance tree,
// override `require` globally, `loadstring` each module's source by hand --
// all of it possible, per Lune's docs, but a lot of moving parts to keep
// correct), this rewrites out-tests/ after the fact: every `TS.import(...)`
// call, computed from test.project.json's own mount points, becomes a plain
// relative `require("...")` Lune already knows how to resolve. Only
// out-tests/ is touched -- out/ ships to real Roblox and must keep its
// Instance-based imports exactly as rbxtsc wrote them.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const outTestsRoot = path.join(projectRoot, 'out-tests');

// Mirrors test.project.json's ReplicatedStorage tree: which Instance-tree
// mount name each on-disk directory under out-tests/ corresponds to.
const MOUNTS = [
    { logical: 'Illuminate', disk: path.join(outTestsRoot, 'src', 'Illuminate') },
    { logical: 'IlluminateTests', disk: path.join(outTestsRoot, 'tests', 'Illuminate') },
];

function toLogicalPath(diskPath)
{
    for (const mount of MOUNTS) {
        if (diskPath === mount.disk || diskPath.startsWith(mount.disk + path.sep)) {
            const rest = path.relative(mount.disk, diskPath);
            return rest === '' ? mount.logical : `${mount.logical}/${rest.split(path.sep).join('/')}`;
        }
    }
    return undefined;
}

function toDiskPath(logicalPath)
{
    const segments = logicalPath.split('/');
    const mount = MOUNTS.find((m) => m.logical === segments[0]);
    if (!mount) return undefined;
    return path.join(mount.disk, ...segments.slice(1));
}

const TS_IMPORT_PATTERN = /TS\.import\(script, (script(?:\.Parent)*), ((?:"[^"]*"(?:, )?)+)\)/g;

function patchFile(filePath)
{
    const diskDir = path.dirname(filePath);
    const ownLogical = toLogicalPath(filePath.replace(/\.luau$/, ''));
    // Not every file sits under a mounted directory -- tests/globals.ts
    // (the ambient describe/it/expect type reference) lives outside
    // tests/Illuminate/ on purpose, is not part of test.project.json's
    // tree, and never needs a require() rewritten in it anyway (it has no
    // TS.import calls -- it compiles to `return nil`).
    if (!ownLogical) return false;
    const ownLogicalSegments = ownLogical.split('/');

    let text = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    text = text.replace(TS_IMPORT_PATTERN, (whole, ancestorExpr, segmentsList) => {
        const parentHops = (ancestorExpr.match(/\.Parent/g) ?? []).length;
        // `script` alone (parentHops === 0) is the file itself, and the
        // *first* `.Parent` already reaches its containing directory --
        // ownLogicalSegments minus the file's own name (one slot) is that
        // directory, so it's `length - parentHops`, not `length - 1 -
        // parentHops` (caught this by hand-tracing the actual 4-`.Parent`
        // case, which should land on the shared root and didn't).
        const ancestorSegments = ownLogicalSegments.slice(0, ownLogicalSegments.length - parentHops);
        const importedSegments = [...segmentsList.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
        const targetLogical = [...ancestorSegments, ...importedSegments].join('/');

        const targetDiskPath = toDiskPath(targetLogical);
        if (!targetDiskPath) {
            throw new Error(`Could not resolve "${targetLogical}" (from ${filePath}) to a mounted directory`);
        }

        let relative = path.relative(diskDir, targetDiskPath).split(path.sep).join('/');
        if (!relative.startsWith('.')) relative = `./${relative}`;

        changed = true;
        return `require("${relative}")`;
    });

    if (!changed) return false;

    text = text.replace(/^local TS = _G\[script\]\n/m, '');
    fs.writeFileSync(filePath, text);
    return true;
}

function walk(dir, files = [])
{
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath, files);
        else if (entry.name.endsWith('.luau')) files.push(fullPath);
    }
    return files;
}

const files = walk(outTestsRoot);
let patchedCount = 0;
for (const file of files) {
    if (patchFile(file)) patchedCount++;
}

console.log(`patch-requires: ${patchedCount}/${files.length} file(s) had TS.import(...) rewritten to require(...).`);
