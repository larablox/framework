// Fixture-based coverage for each canonicalization pass in canonicalize.mjs.
// Run with: node --test scripts/parity/canonicalize.test.mjs
//
// The real ported files (HigherOrderWhenProxy.ts/Conditionable.ts) already
// exercise most of these rules end-to-end via check.mjs itself, but a
// couple - the class-name type hint drop, most notably - have no current
// call site in either upstream file, so a regression there would pass
// check.mjs's own 100% scores undetected. These tests exist so a future
// refactor of canonicalize.mjs (or a new accepted-convention fold) can be
// checked without needing a real PHP/TS file pair for every rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizePhp, canonicalizeTs, foldExplicitDynamicDispatchReceiver, mirrorFidelity, unRename } from './canonicalize.mjs';

test('drops PHP visibility/type keywords and the statement terminator', () => {
    assert.deepEqual(canonicalizePhp(['public', 'function', 'foo', '(', ')', ';']), ['foo', '(', ')']);
});

test('drops a nullable-type marker but keeps a real ternary `?`', () => {
    assert.deepEqual(canonicalizePhp(['?', 'callable', '$x']), ['x']);
    assert.deepEqual(canonicalizePhp(['$x', '?', '$y', ':', '$z']), ['x', '?', 'y', ':', 'z']);
});

// Not exercised by either currently-ported file (HigherOrderWhenProxy.php,
// Conditionable.php) - see the module docblock above.
test('drops a class-name type hint', () => {
    assert.deepEqual(canonicalizePhp(['ReflectionParameter', '$parameter']), ['parameter']);
});

test('folds `->{EXPR}` dynamic member access into bracket indexing', () => {
    assert.deepEqual(canonicalizePhp(['$this', '->', 'target', '->', '{', '$method', '}']), ['this', '.', 'target', '[', 'method', ']']);
});

test('folds `elseif` into two tokens, `else` `if`', () => {
    assert.deepEqual(canonicalizePhp(['elseif']), ['else', 'if']);
});

test('strips the redundant parens around `(new X(...))->`', () => {
    assert.deepEqual(canonicalizePhp(['(', 'new', 'X', '(', ')', ')', '->', 'foo', '(', ')']), ['new', 'X', '(', ')', '.', 'foo', '(', ')']);
});

test('leaves a parenthesized `new` alone when nothing chains off it', () => {
    assert.deepEqual(canonicalizePhp(['foo', '(', '(', 'new', 'X', '(', ')', ')', ')']), ['foo', '(', '(', 'new', 'X', '(', ')', ')', ')']);
});

test('canonicalizes an `instanceof Closure` check to a typeIs() call', () => {
    assert.deepEqual(canonicalizePhp(['$value', 'instanceof', 'Closure']), ['typeIs', '(', 'value', ',', 'str:function', ')']);
});

test('rewrites `->`/`::` to `.`, and `__construct` to `constructor`', () => {
    assert.deepEqual(canonicalizePhp(['$this', '->', 'foo', '::', 'bar']), ['this', '.', 'foo', '.', 'bar']);
    assert.deepEqual(canonicalizePhp(['function', '__construct', '(', ')']), ['constructor', '(', ')']);
});

test('canonicalizes a PHP string literal, interpolation braces included', () => {
    assert.deepEqual(canonicalizePhp(["'plain'"]), ['str:plain']);
    assert.deepEqual(canonicalizePhp(['"{$x}"']), ['str:{x}']);
});

test('folds a zero-arg func_num_args() call to the packed-args shape', () => {
    assert.deepEqual(canonicalizePhp(['func_num_args', '(', ')']), ['func_num_args', '(', 'args', ')']);
});

test('synthesizes the packed-args leading parameter for a decorated member', () => {
    assert.deepEqual(canonicalizePhp(['function', 'when', '(', '$value', ')'], true), ['when', '(', 'args', ',', 'value', ')']);
    assert.deepEqual(canonicalizePhp(['function', 'when', '(', ')'], true), ['when', '(', 'args', ')']);
});

test('drops TS visibility/readonly/const/let and the statement terminator', () => {
    assert.deepEqual(canonicalizeTs(['public', 'readonly', 'const', 'x', '=', '1', ';']), ['x', '=', '1']);
});

test('drops a trailing comma before a closing paren', () => {
    assert.deepEqual(canonicalizeTs(['foo', '(', 'a', ',', 'b', ',', ')']), ['foo', '(', 'a', ',', 'b', ')']);
});

test('unwraps a truthy() call to its argument', () => {
    assert.deepEqual(canonicalizeTs(['truthy', '(', 'x', ')']), ['x']);
});

test('canonicalizes a TS string literal, interpolation braces included', () => {
    assert.deepEqual(canonicalizeTs(["'plain'"]), ['str:plain']);
    assert.deepEqual(canonicalizeTs(['`${x}`']), ['str:{x}']);
});

test('unRename strips exactly one or three leading underscores, not two', () => {
    assert.equal(unRename('_default'), 'default');
    assert.equal(unRename('___call'), '__call');
    assert.equal(unRename('__get'), '__get');
    assert.equal(unRename('plain'), 'plain');
});

test('folds the explicit receiver a dynamic-dispatch call re-passes', () => {
    const tokens = ['this', '.', 'target', '[', 'method', ']', '(', 'this', '.', 'target', ',', '...', 'parameters', ')'];
    assert.deepEqual(foldExplicitDynamicDispatchReceiver(tokens), ['this', '.', 'target', '[', 'method', ']', '(', '...', 'parameters', ')']);
});

test('mirrorFidelity is 100 for identical token streams and 0 for disjoint ones', () => {
    assert.equal(mirrorFidelity(['a', 'b'], ['a', 'b']), 100);
    assert.equal(mirrorFidelity([], []), 100);
    assert.equal(mirrorFidelity(['a'], ['b']), 0);
});
