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

// A union with a magic constituent (`HigherOrderTapProxyView<T> | T`, the
// optional-callback overload of tap()) is not magic itself:
// getPropertyOfType() only returns a property every constituent has. An
// access on it can't be routed - at runtime the value may be the proxy,
// whose only real members are __get/___call - so it is refused below
// rather than passed through as an ordinary access.
function hasMagicConstituent(checker, type)
{
    return type.isUnion() && type.types.some((constituent) => isMagicDispatchType(checker, constituent));
}

// An access on a magic-dispatch value written in a shape this rewrite does
// not handle. Refused at build time on purpose: passing it through would
// compile to a plain Luau access on the proxy, which has no such member,
// and fail as a `nil` call at runtime with nothing pointing back here.
export class MagicDispatchShapeError extends Error {}

function shapeError(sourceFile, node, message)
{
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return new MagicDispatchShapeError(`${sourceFile.fileName}:${line + 1}:${character + 1}: ${message}`);
}

function unwrapParens(node)
{
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
}

function receiverIsMagic(checker, receiver)
{
    return isMagicDispatchType(checker, checker.getTypeAtLocation(receiver));
}

// Throws a MagicDispatchShapeError for the shapes the two rewrite branches
// in transformNode would otherwise mishandle or silently skip. Each is a
// spelling the rest of the port never needs: the plain `view.key` /
// `view.method(args)` forms are what the branches route.
function refuseUnsupportedShapes(checker, sourceFile, node)
{
    // `(view.m)(x)`: the parens hide the property access from the call
    // branch, so `view.m` would be routed to __get and the result called.
    if (ts.isCallExpression(node) && ts.isParenthesizedExpression(node.expression)) {
        const callee = unwrapParens(node.expression);
        if (ts.isPropertyAccessExpression(callee) && receiverIsMagic(checker, callee.expression)) {
            throw shapeError(sourceFile, node, 'a parenthesized callee on a magic-dispatch value is not routed; write `view.method(args)` without the parens');
        }
    }

    // `view?.m(x)` / `view?.key` / `view.m?.(x)`: rewriting would drop the
    // `?.`; the receiver's type is never undefined here anyway, so the
    // `?.` is not doing anything - write the plain access.
    if (
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && (node.questionDotToken || node.expression.questionDotToken)
        && receiverIsMagic(checker, node.expression.expression)
    ) {
        throw shapeError(sourceFile, node, 'optional chaining on a magic-dispatch value is not routed; the receiver is never undefined, write `view.method(args)`');
    }
    if (ts.isPropertyAccessExpression(node) && node.questionDotToken && receiverIsMagic(checker, node.expression)) {
        throw shapeError(sourceFile, node, 'optional chaining on a magic-dispatch value is not routed; the receiver is never undefined, write `view.key`');
    }

    // `view['key']` / `view['m'](x)`: an element access is never routed.
    if (ts.isElementAccessExpression(node) && receiverIsMagic(checker, node.expression)) {
        throw shapeError(sourceFile, node, 'element access on a magic-dispatch value is not routed; write `view.key` / `view.method(args)`');
    }

    // `union.key` / `union.m(x)` where the union has a magic constituent.
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && hasMagicConstituent(checker, checker.getTypeAtLocation(node.expression))) {
        throw shapeError(sourceFile, node, 'an access on a union with a magic-dispatch constituent cannot be routed; narrow or cast the receiver first');
    }
}

// Returns { text, changed, editCount } for `node`: its own rewritten form
// if it's itself a magic-dispatch access, otherwise its original text with
// any rewritten *descendants* spliced back in. Recursive and bottom-up -
// `receiver`/`args` are run back through this before being embedded, so a
// chain like `model.when().isActive().activate(x)` gets every link rewritten,
// not just the outermost one (the bug in the first version of this script:
// it grabbed the receiver's raw getText() instead of transforming it too).
// `editCount` is the number of access sites rewritten within `node`,
// counted where each rewrite happens - not by regexing the output, which
// also matched a hand-written `___call`/`__get` sharing a statement with a
// real rewrite (the whole spec body is one statement) and over-counted.
export function transformNode(checker, sourceFile, node)
{
    refuseUnsupportedShapes(checker, sourceFile, node);

    // `receiver.method(args)` - a genuine call, decided by the `(`
    // actually present in this source - routes to ___call, args and all.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const propertyAccess = node.expression;
        const method = propertyAccess.name.getText(sourceFile);
        const receiverType = checker.getTypeAtLocation(propertyAccess.expression);

        if (!DISPATCH_METHODS.has(method) && isMagicDispatchType(checker, receiverType)) {
            const receiver = transformNode(checker, sourceFile, propertyAccess.expression);
            const args = node.arguments.map((argument) => transformNode(checker, sourceFile, argument));

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
                text: `${receiver.text}.___call('${method}', [${args.map((argument) => argument.text).join(', ')}])`,
                changed: true,
                editCount: 1 + receiver.editCount + args.reduce((sum, argument) => sum + argument.editCount, 0),
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
                const receiver = transformNode(checker, sourceFile, node.expression);

                return {
                    text: `${receiver.text}.__get('${key}')`,
                    changed: true,
                    editCount: 1 + receiver.editCount,
                };
            }
        }
    }

    // Not a magic-dispatch access itself - keep this node's own text, but
    // splice in any rewritten descendants (recursing all the way down).
    const start = node.getStart(sourceFile);
    const original = sourceFile.text.slice(start, node.getEnd());

    const childEdits = [];
    let editCount = 0;
    ts.forEachChild(node, (child) => {
        const result = transformNode(checker, sourceFile, child);
        if (result.changed) {
            editCount += result.editCount;
            childEdits.push({
                start: child.getStart(sourceFile) - start,
                end: child.getEnd() - start,
                text: result.text,
            });
        }
    });

    if (editCount === 0) return { text: original, changed: false, editCount: 0 };

    childEdits.sort((first, second) => second.start - first.start);
    let text = original;
    for (const edit of childEdits) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    }

    return { text, changed: true, editCount };
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
            totalEdits += result.editCount;
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
