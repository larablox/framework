#!/usr/bin/env node
// Guards the func_num_args()/decoratePackedArgs() wiring CONVENTIONS.md
// documents (see its "func_num_args()" section): any method reading
// func_num_args(args) needs its true call-time argument count supplied by
// TableArgs.luau's wrapper, which only happens if decoratePackedArgs(cls,
// methodName) was called for it. TypeScript can't catch a missing or
// misspelled wiring on its own - the method still compiles fine, it just
// silently can't distinguish `when()` from `when(undefined)` at runtime.
//
// Unlike scripts/parity/check.mjs, this doesn't need the upstream PHP twin
// at all - it's a pure self-consistency check within one TS file, so it can
// run on every build without a `php` dependency.
//
// Usage: node scripts/lint/check-packed-args.mjs
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { collectClassMembers, findClassNode, findPackedArgsDecoratedMembers, findTsFiles } from '../parity/ts-ast-utils.mjs';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(projectRoot, 'src');

function containsFuncNumArgsCall(node, sourceFile)
{
    return /\bfunc_num_args\s*\(/.test(node.getText(sourceFile));
}

const violations = [];

for (const file of findTsFiles(srcRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
    const classNode = findClassNode(sourceFile);
    if (!classNode) continue;

    const members = collectClassMembers(classNode, sourceFile);
    const decorated = findPackedArgsDecoratedMembers(sourceFile);
    const relativePath = path.relative(projectRoot, file);

    for (const member of members) {
        if (member.kind === 'method' && containsFuncNumArgsCall(member.node, sourceFile) && !decorated.has(member.name)) {
            violations.push(
                `${relativePath}: method '${member.name}' calls func_num_args() but isn't wrapped by decoratePackedArgs()`,
            );
        }
    }

    const memberNames = new Set(members.map((m) => m.name));
    for (const name of decorated) {
        if (!memberNames.has(name)) {
            violations.push(`${relativePath}: decoratePackedArgs(cls, '${name}') targets a method that doesn't exist`);
        }
    }
}

if (violations.length > 0) {
    console.error('func_num_args()/decoratePackedArgs() wiring violations:\n');
    for (const violation of violations) console.error(`  ${violation}`);
    console.error('\nSee CONVENTIONS.md ("func_num_args()") for why this wiring matters.');
    process.exit(1);
}
