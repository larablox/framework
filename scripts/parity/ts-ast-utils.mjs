// Small TS-AST helpers shared between scripts/parity/check.mjs,
// scripts/parity/aggregate.mjs and scripts/lint/check-packed-args.mjs - all
// three need to find "the class" in a ported file and its members the same
// way, so that logic lives in one place rather than being copied.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

// Recursively lists every non-declaration .ts file under `dir`. `.d.ts`
// files are skipped - they have no method bodies for any of the three
// scripts above to look at.
export function findTsFiles(dir)
{
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...findTsFiles(full));
        else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(full);
    }
    return files;
}

// Finds the "main" class - a plain `export class X {}` or, for a trait
// ported as a mixin, the `class extends Base {}` expression a mixin factory
// function returns.
export function findClassNode(root)
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

// Lists a class's own constructor/method/property members with their name
// and AST node. Overload signatures (no body) are skipped - the
// implementation carries the real body.
export function collectClassMembers(classNode, sourceFile)
{
    const members = [];
    for (const member of classNode.members) {
        if (ts.isConstructorDeclaration(member)) {
            if (!member.body) continue;
            members.push({ name: '__construct', kind: 'method', node: member });
        } else if (ts.isMethodDeclaration(member)) {
            if (!member.body) continue;
            members.push({ name: member.name.getText(sourceFile), kind: 'method', node: member });
        } else if (ts.isPropertyDeclaration(member)) {
            members.push({ name: member.name.getText(sourceFile), kind: 'property', node: member });
        }
    }
    return members;
}

// Finds every member name passed as the 2nd argument to a real call of
// whatever local name TableArgs.d.ts's `decoratePackedArgs` export is
// imported/aliased as in this file - rather than hardcoding that name, in
// case it's renamed again (as it already has been once). Driven by actual
// call sites, not a fixed list.
export function findPackedArgsDecoratedMembers(sourceFile)
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
