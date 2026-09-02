#!/usr/bin/env node
// Rewrites every access on a `MagicDispatch<T>`-typed value (see
// src/Illuminate/Support/MagicDispatch.ts) into an explicit __get/___call
// call, before rbxtsc ever sees the source. rbxtsc has no
// customTransformers/plugins hook, so this runs as its own pass, writing a
// shadow copy of src/ that tsconfig.magic-dispatch.json points rbxtsc at --
// every file is copied through, transformed or not, so the shadow tree
// always mirrors src/ exactly and imports resolve the same way in both.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(projectRoot, 'src');
const outRoot = path.join(projectRoot, '.magic-dispatch');
const MARKER_PROPERTY = '__magicDispatch';

function loadProgram()
{
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);

    return ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
}

function isMagicDispatchType(checker, type)
{
    return checker.getPropertyOfType(type, MARKER_PROPERTY) !== undefined;
}

// Returns { text, changed } for `node`: its own rewritten form if it's
// itself a magic-dispatch access, otherwise its original text with any
// rewritten *descendants* spliced back in. Recursive and bottom-up --
// `receiver`/`args` are run back through this before being embedded, so a
// chain like `model.when().isActive().activate(x)` gets every link rewritten,
// not just the outermost one (the bug in the first version of this script:
// it grabbed the receiver's raw getText() instead of transforming it too).
function transformNode(checker, sourceFile, node)
{
    // `receiver.method(args)` -- a genuine call, decided by the `(`
    // actually present in this source -- routes to ___call, args and all.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const propertyAccess = node.expression;
        const receiverType = checker.getTypeAtLocation(propertyAccess.expression);

        if (isMagicDispatchType(checker, receiverType)) {
            const receiverText = transformNode(checker, sourceFile, propertyAccess.expression).text;
            const method = propertyAccess.name.getText(sourceFile);
            const args = node.arguments.map((argument) => transformNode(checker, sourceFile, argument).text).join(', ');

            // rbxtsc re-typechecks the shadow tree from scratch -- a real
            // ts.TransformerFactory rewrites already-checked AST nodes and
            // is never re-validated, but a shadow-copy-and-recompile
            // pipeline (rbxtsc has no transformer hook to run inside)
            // doesn't get that luxury. `receiver`'s own declared type
            // (MagicDispatch<View>) has no ___call member, so the cast
            // below targets a fresh, unrelated structural type instead.
            return {
                text:
                    `(${receiverText} as unknown as { ___call(method: string, parameters: unknown[]): unknown }).___call('${method}', [${args}])`,
                changed: true,
            };
        }
    }

    // `receiver.key`, bare -- no `(` anywhere in this source -- routes to __get.
    if (ts.isPropertyAccessExpression(node)) {
        const isCallee = ts.isCallExpression(node.parent) && node.parent.expression === node;

        if (!isCallee) {
            const receiverType = checker.getTypeAtLocation(node.expression);

            if (isMagicDispatchType(checker, receiverType)) {
                const receiverText = transformNode(checker, sourceFile, node.expression).text;
                const key = node.name.getText(sourceFile);

                return {
                    text: `(${receiverText} as unknown as { __get(key: string): unknown }).__get('${key}')`,
                    changed: true,
                };
            }
        }
    }

    // Not a magic-dispatch access itself -- keep this node's own text, but
    // splice in any rewritten descendants (recursing all the way down).
    const start = node.getStart(sourceFile);
    const original = sourceFile.text.slice(start, node.getEnd());

    const childEdits = [];
    let anyChanged = false;
    ts.forEachChild(node, (child) => {
        const result = transformNode(checker, sourceFile, child);
        if (result.changed) {
            anyChanged = true;
            childEdits.push({
                start: child.getStart(sourceFile) - start,
                end: child.getEnd() - start,
                text: result.text,
            });
        }
    });

    if (!anyChanged) return { text: original, changed: false };

    childEdits.sort((first, second) => second.start - first.start);
    let text = original;
    for (const edit of childEdits) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    }

    return { text, changed: true };
}

function transformSourceFile(checker, sourceFile)
{
    let totalEdits = 0;
    const originalText = sourceFile.getFullText();
    const edits = [];

    ts.forEachChild(sourceFile, (topLevelNode) => {
        const result = transformNode(checker, sourceFile, topLevelNode);
        if (result.changed) {
            // Count individual magic-dispatch call sites for the summary
            // line, not just top-level statements touched.
            totalEdits += (result.text.match(/\.(___call|__get)\(/g) ?? []).length;
            edits.push({
                start: topLevelNode.getStart(sourceFile),
                end: topLevelNode.getEnd(),
                text: result.text,
            });
        }
    });

    edits.sort((first, second) => second.start - first.start);
    let text = originalText;
    for (const edit of edits) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    }

    return { text, editCount: totalEdits };
}

function run()
{
    const program = loadProgram();

    // Surface the developer's own type errors against the real source
    // before rewriting anything -- a diagnostic pointing at the shadow
    // tree instead of src/ would be useless.
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName.startsWith(srcRoot));
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
    const expectedRelativePaths = new Set();

    // No wholesale fs.rmSync(outRoot) up front: rbxtsc -w watches this same
    // directory concurrently in `npm run watch`, and a delete-then-rewrite
    // pass leaves a window where it sees the tree emptied but not yet
    // refilled, mid-run -- caught this once as a bogus "MacroManager could
    // not find symbol for Promise" error. Writing files in place (only
    // touching ones whose content actually changed) means the tree is
    // never observably incomplete; stale files get swept after.
    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue;
        if (!sourceFile.fileName.startsWith(srcRoot + path.sep)) continue;

        const { text, editCount } = transformSourceFile(checker, sourceFile);
        totalEdits += editCount;
        fileCount++;

        const relative = path.relative(srcRoot, sourceFile.fileName);
        expectedRelativePaths.add(relative);

        const outPath = path.join(outRoot, relative);
        if (!fs.existsSync(outPath) || fs.readFileSync(outPath, 'utf8') !== text) {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, text);
        }
    }

    removeStaleFiles(outRoot, expectedRelativePaths);

    console.log(`transform-magic-dispatch: ${fileCount} file(s), ${totalEdits} magic-dispatch access site(s) rewritten.`);
}

// Deletes anything under outRoot that doesn't correspond to a current src/
// file -- handles a source file being renamed or removed between runs.
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
    // that it reliably catches the *first* change under src/ and then goes
    // silent on Linux, no error, no further events. ts.sys.watchDirectory is
    // the same watch abstraction rbxtsc's own -w mode is built on -- already
    // proven reliable for repeated changes in this same setup.
    //
    // Registered before the first run(), not after: run() rebuilds a whole
    // ts.Program (not instant), and a change landing in that window would
    // otherwise never reach a listener that isn't attached yet.
    let debounce;
    ts.sys.watchDirectory(srcRoot, (filename) => {
        if (!filename.endsWith('.ts')) return;
        // A single save reliably fires more than one watch event; without
        // this, that was three overlapping run()s -- of a function that
        // mkdirs/writes files -- racing each other.
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            console.log(`transform-magic-dispatch: ${path.relative(srcRoot, filename)} changed, re-running...`);
            run();
        }, 100);
    }, /* recursive */ true);
    run();
    console.log('transform-magic-dispatch: watching src/ for changes.');
} else {
    run();
}
