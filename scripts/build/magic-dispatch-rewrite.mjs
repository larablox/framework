// Pure rewrite logic for scripts/build/transform-magic-dispatch.mjs: given a
// type checker and one source file, produce that file's text with every
// access on a `MagicDispatch<T>`-typed value (see
// src/Larablox/MagicDispatch.ts) spelled as an explicit
// __get/___call call. No CLI/file/process side effects here on purpose -
// this module is imported both by transform-magic-dispatch.mjs (which
// walks the real project and writes the shadow tree) and by
// transform-magic-dispatch.test.mjs (which feeds it in-memory programs).
import ts from 'typescript';

export const MARKER_PROPERTY = '__magicDispatch';

// A `__get`/`___call` written out by hand on a magic-dispatch value is
// already the explicit form this rewrite produces - left as is, rather than
// re-routed into a magic call *named* `___call` (which nothing implements).
export const DISPATCH_METHODS = new Set(['__get', '___call']);

export function isMagicDispatchType(checker, type)
{
    return checker.getPropertyOfType(type, MARKER_PROPERTY) !== undefined;
}

// Returns { text, changed } for `node`: its own rewritten form if it's
// itself a magic-dispatch access, otherwise its original text with any
// rewritten *descendants* spliced back in. Recursive and bottom-up -
// `receiver`/`args` are run back through this before being embedded, so a
// chain like `model.when().isActive().activate(x)` gets every link rewritten,
// not just the outermost one (the bug in the first version of this script:
// it grabbed the receiver's raw getText() instead of transforming it too).
export function transformNode(checker, sourceFile, node)
{
    // `receiver.method(args)` - a genuine call, decided by the `(`
    // actually present in this source - routes to ___call, args and all.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const propertyAccess = node.expression;
        const method = propertyAccess.name.getText(sourceFile);
        const receiverType = checker.getTypeAtLocation(propertyAccess.expression);

        if (!DISPATCH_METHODS.has(method) && isMagicDispatchType(checker, receiverType)) {
            const receiverText = transformNode(checker, sourceFile, propertyAccess.expression).text;
            const args = node.arguments.map((argument) => transformNode(checker, sourceFile, argument).text).join(', ');

            // rbxtsc re-typechecks the shadow tree from scratch - a real
            // ts.TransformerFactory rewrites already-checked AST nodes and
            // is never re-validated, but a shadow-copy-and-recompile
            // pipeline (rbxtsc has no transformer hook to run inside)
            // doesn't get that luxury. The rewritten call resolves against
            // the `___call` member MagicDispatch<T> itself declares, typed
            // off the view's own `method` entry, so its result keeps the
            // exact type `receiver.method(args)` had - anything the source
            // went on to chain or assign from it still typechecks. (An
            // earlier version cast the receiver to a throwaway
            // `{ ___call(...): unknown }` instead; that typed every result
            // `unknown`, which held up only as long as no result was ever
            // used as anything but an `expect()` argument.)
            return {
                text: `${receiverText}.___call('${method}', [${args}])`,
                changed: true,
            };
        }
    }

    // `receiver.key`, bare - no `(` anywhere in this source - routes to __get.
    if (ts.isPropertyAccessExpression(node)) {
        const isCallee = ts.isCallExpression(node.parent) && node.parent.expression === node;
        const key = node.name.getText(sourceFile);

        if (!isCallee && !DISPATCH_METHODS.has(key)) {
            const receiverType = checker.getTypeAtLocation(node.expression);

            if (isMagicDispatchType(checker, receiverType)) {
                const receiverText = transformNode(checker, sourceFile, node.expression).text;

                return {
                    text: `${receiverText}.__get('${key}')`,
                    changed: true,
                };
            }
        }
    }

    // Not a magic-dispatch access itself - keep this node's own text, but
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

// Returns { text, editCount }: the whole file's text with every magic access
// rewritten, and the number of access sites for the caller's summary line.
export function transformSourceFile(checker, sourceFile)
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
