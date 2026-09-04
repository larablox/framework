// Fixture-based coverage for the TS-AST helpers in ts-ast-utils.mjs that
// decide *what* check.mjs compares. Run with: node --test scripts/parity/ts-ast-utils.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { collectClassMembers, collectTopLevelFunctions, findClassNode } from './ts-ast-utils.mjs';

function parse(source)
{
    return ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.ESNext, true);
}

test('collectTopLevelFunctions lists exported and plain declarations with a body, in source order', () => {
    const sourceFile = parse(`
        export function tap(value: unknown): unknown { return value; }
        function helper(): void {}
    `);
    assert.deepEqual(collectTopLevelFunctions(sourceFile).map((f) => [f.name, f.kind]), [['tap', 'function'], ['helper', 'function']]);
});

test('collectTopLevelFunctions skips overload signatures, keeping only the implementation', () => {
    const sourceFile = parse(`
        export function tap(value: object): object;
        export function tap(value: unknown, callback: () => void): unknown;
        export function tap(value: unknown, callback?: () => void): unknown { return value; }
    `);
    const functions = collectTopLevelFunctions(sourceFile);
    assert.equal(functions.length, 1);
    assert.ok(functions[0].node.body);
});

test('collectTopLevelFunctions ignores nested functions and arrow-function consts', () => {
    const sourceFile = parse(`
        export function outer(): void { function inner(): void {} }
        export const arrow = (): void => {};
    `);
    assert.deepEqual(collectTopLevelFunctions(sourceFile).map((f) => f.name), ['outer']);
});

test('a helpers file has no class for findClassNode, and a class file has no top-level functions to fall back on', () => {
    const helpers = parse('export function tap(value: unknown): unknown { return value; }');
    assert.equal(findClassNode(helpers), undefined);

    const classFile = parse('export class Foo { public bar(): void {} }');
    assert.deepEqual(collectTopLevelFunctions(classFile), []);
    assert.deepEqual(collectClassMembers(findClassNode(classFile), classFile).map((m) => m.name), ['bar']);
});
