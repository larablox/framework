#!/usr/bin/env node
// Rewrites every access on a `MagicDispatch<T>`-typed value (see
// src/Illuminate/Support/MagicDispatch.ts) into an explicit __get/___call
// call, before rbxtsc ever sees the source. rbxtsc has no
// customTransformers/plugins hook, so this runs as its own pass, writing a
// shadow copy that tsconfig.magic-dispatch.json/tsconfig.tests.json point
// rbxtsc at instead - every file is copied through, transformed or not, so
// the shadow tree always mirrors the real one and imports resolve the same
// way in both.
//
// src/ and tests/ get their own separate shadow trees, not one merged tree:
// a test-only support file (tests/globals.ts, declaring the ambient
// describe/it/expect globals) has to stay out of the package build, and
// once it's physically sitting in the same directory as the real src/
// files there's no way to exclude "everything that came from tests/"
// without matching by name, which doesn't generalize. tsconfig.tests.json
// uses `rootDirs` to still resolve `import ... from "Illuminate/Support/..."`
// in a spec file against src/'s shadow tree - the same virtual-merge
// TypeScript feature this project's old (deleted) test setup used, per its
// own since-removed comment: "src and tests are merged into one virtual
// directory instead of [...]".
//
// The rewrite itself (what an access becomes, and how a chain gets every
// link rewritten) lives in scripts/build/magic-dispatch-rewrite.mjs, as
// plain, side-effect-free functions - see transform-magic-dispatch.test.mjs
// for coverage. This file is only the project walk around it: load the
// real ts.Program, write the shadow trees, watch for changes.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { transformSourceFile } from './magic-dispatch-rewrite.mjs';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

// Both shadow trees nest under one shared parent (rather than sitting as
// siblings of the project root) so tsconfig.tests.json's `rootDir` - needed
// for rbxtsc to compute out-tests/'s layout - can be that shared parent
// without also covering (and trying to copy as assets) the rest of the repo.
const shadowRoot = path.join(projectRoot, '.magic-dispatch');
const roots = [
    { real: path.join(projectRoot, 'src'), shadow: path.join(shadowRoot, 'src') },
    { real: path.join(projectRoot, 'tests'), shadow: path.join(shadowRoot, 'tests') },
].filter((root) => fs.existsSync(root.real));

function rootFor(fileName)
{
    return roots.find((root) => fileName.startsWith(root.real + path.sep));
}

function loadProgram()
{
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);

    // tsconfig.json's own `include` only covers src/**/*.ts - tests/ isn't
    // a real compiler entry point (there is no tsconfig for it that rbxtsc
    // itself runs), so its files are found and added by hand here.
    const testsRoot = path.join(projectRoot, 'tests');
    const testFiles = fs.existsSync(testsRoot) ? ts.sys.readDirectory(testsRoot, ['.ts']) : [];

    return ts.createProgram({ rootNames: [...parsed.fileNames, ...testFiles], options: parsed.options });
}

// Hand-written, non-.ts files (a raw .luau module and its .d.ts twin -
// see src/Illuminate/Support/TableArgs.*) live under src/ too, but never
// pass through ts.Program.getSourceFiles() below: TypeScript only loads a
// .d.ts to resolve types from it, and a .luau file isn't a TS construct at
// all. rbxtsc itself copies any non-.ts file it finds under its own rootDir
// straight through to out/ - but rbxtsc's rootDir is the *shadow* tree,
// not the real one, so without this pass those files would exist in src/
// and simply never reach out/. Walked directly off disk, independent of
// the TS program, so it needs no help identifying what "the rest of src/"
// contains.
function copyNonTsAssets(root, expected)
{
    if (!fs.existsSync(root.real)) return;

    walkFiles(root.real, (fullPath) => {
        // A real .ts source file (not .d.ts) is already handled via
        // ts.Program above - but .d.ts itself ends in ".ts" too, and
        // ts.Program deliberately skips copying declaration files (they're
        // only loaded to resolve types from), so it needs to be included
        // here or it reaches neither pass.
        if (fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) return;

        const relative = path.relative(root.real, fullPath);
        expected.add(relative);

        const outPath = path.join(root.shadow, relative);
        const content = fs.readFileSync(fullPath);
        if (!fs.existsSync(outPath) || !fs.readFileSync(outPath).equals(content)) {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, content);
        }
    });
}

function walkFiles(dir, callback)
{
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(fullPath, callback);
        else callback(fullPath);
    }
}

function run()
{
    const program = loadProgram();

    // Surface the developer's own type errors against the real source
    // before rewriting anything - a diagnostic pointing at a shadow tree
    // instead of src/tests would be useless.
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.file && rootFor(d.file.fileName));
    if (diagnostics.length > 0) {
        const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCurrentDirectory: () => projectRoot,
            getCanonicalFileName: (fileName) => fileName,
            getNewLine: () => ts.sys.newLine,
        });
        process.stderr.write(formatted);
        process.exitCode = 1;
        return;
    }

    const checker = program.getTypeChecker();
    let totalEdits = 0;
    let fileCount = 0;
    const expectedRelativePathsByShadow = new Map(roots.map((root) => [root.shadow, new Set()]));

    // No wholesale fs.rmSync(outRoot) up front: rbxtsc -w watches these same
    // directories concurrently in `npm run watch`, and a delete-then-rewrite
    // pass leaves a window where it sees a tree emptied but not yet
    // refilled, mid-run - caught this once as a bogus "MacroManager could
    // not find symbol for Promise" error. Writing files in place (only
    // touching ones whose content actually changed) means a tree is never
    // observably incomplete; stale files get swept after.
    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue;
        const root = rootFor(sourceFile.fileName);
        if (!root) continue;

        const { text, editCount } = transformSourceFile(checker, sourceFile);
        totalEdits += editCount;
        fileCount++;

        const relative = path.relative(root.real, sourceFile.fileName);
        expectedRelativePathsByShadow.get(root.shadow).add(relative);

        const outPath = path.join(root.shadow, relative);
        if (!fs.existsSync(outPath) || fs.readFileSync(outPath, 'utf8') !== text) {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, text);
        }
    }

    for (const root of roots) copyNonTsAssets(root, expectedRelativePathsByShadow.get(root.shadow));

    for (const [shadow, expected] of expectedRelativePathsByShadow) removeStaleFiles(shadow, expected);

    console.log(`transform-magic-dispatch: ${fileCount} file(s), ${totalEdits} magic-dispatch access site(s) rewritten.`);
}

// Deletes anything under a shadow tree that doesn't correspond to a current
// source file - handles a source file being renamed or removed between runs.
function removeStaleFiles(dir, expectedRelativePaths, base = dir)
{
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            removeStaleFiles(fullPath, expectedRelativePaths, base);
            if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
            continue;
        }

        const relative = path.relative(base, fullPath);
        if (!expectedRelativePaths.has(relative)) fs.rmSync(fullPath);
    }
}

if (process.argv.includes('--watch')) {
    // Not the built-in fs.watch({recursive: true}): confirmed empirically
    // that it reliably catches the *first* change under a watched directory
    // and then goes silent on Linux, no error, no further events.
    // ts.sys.watchDirectory is the same watch abstraction rbxtsc's own -w
    // mode is built on - already proven reliable for repeated changes in
    // this same setup.
    //
    // Registered before the first run(), not after: run() rebuilds a whole
    // ts.Program (not instant), and a change landing in that window would
    // otherwise never reach a listener that isn't attached yet.
    let debounce;
    const onChange = (filename) => {
        if (!filename.endsWith('.ts') && !filename.endsWith('.luau')) return;
        // A single save reliably fires more than one watch event; without
        // this, that was three overlapping run()s - of a function that
        // mkdirs/writes files - racing each other.
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            console.log(`transform-magic-dispatch: ${filename} changed, re-running...`);
            run();
        }, 100);
    };
    for (const root of roots) ts.sys.watchDirectory(root.real, onChange, /* recursive */ true);
    run();
    console.log(`transform-magic-dispatch: watching ${roots.map((r) => path.relative(projectRoot, r.real)).join(', ')} for changes.`);
} else {
    run();
}
