// Fixture-based coverage for magic-dispatch-rewrite.mjs, the pure rewrite
// behind scripts/build/transform-magic-dispatch.mjs.
// Run with: node --test scripts/build/transform-magic-dispatch.test.mjs
//
// Each fixture is one small TS module compiled in memory - a CompilerHost
// overlay over the real disk - so it imports the real
// src/Illuminate/Support/MagicDispatch.ts the same way a spec file does.
// The project's own tsconfig (`noLib`, @rbxts typings) is unusable for a
// plain ts.Program, so this uses its own minimal options with a real lib:
// the rewrite only needs the checker to see the `__magicDispatch` brand,
// never a roblox-ts global.
//
// The rewritten text is checked twice: as a string, and by type-checking
// it in a fresh program. The shadow tree is what rbxtsc re-checks from
// scratch, so a rewrite that merely *looked* right (FEEDBACK.md: every
// result typed `unknown`) has to fail here rather than in the first spec
// that uses a result for something.
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import url from 'node:url';
import { transformSourceFile } from './magic-dispatch-rewrite.mjs';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

// Never on disk - served from memory by the host overlay below.
const fixturePath = path.join(projectRoot, '__fixture__', 'fixture.ts');

// `baseUrl: src` is what lets the fixture spell the import the way the
// real sources do; `types: []` keeps node_modules typings out of a program
// that has no use for them.
const { options, errors } = ts.convertCompilerOptionsFromJson(
    { strict: true, target: 'ES2022', lib: ['ES2022'], module: 'CommonJS', moduleResolution: 'Node', baseUrl: 'src', types: [] },
    projectRoot,
);
if (errors.length > 0) throw new Error(ts.formatDiagnostics(errors, ts.createCompilerHost(options)));

function createFixtureProgram(text)
{
    // setParentNodes: transformNode reads `node.parent` to tell a callee
    // apart from a bare read - the binder would set it anyway once the
    // checker runs, but the fixture shouldn't depend on that ordering.
    const host = ts.createCompilerHost(options, /* setParentNodes */ true);
    const { fileExists, readFile } = host;
    host.fileExists = (fileName) => fileName === fixturePath || fileExists(fileName);
    host.readFile = (fileName) => (fileName === fixturePath ? text : readFile(fileName));

    return ts.createProgram({ rootNames: [fixturePath], options, host });
}

function diagnosticsOf(text)
{
    return ts.getPreEmitDiagnostics(createFixtureProgram(text))
        .map((diagnostic) => `${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
}

// Mirrors the CLI's own order: the checker is created before any rewrite.
function rewrite(text)
{
    const program = createFixtureProgram(text);
    const checker = program.getTypeChecker();

    return transformSourceFile(checker, program.getSourceFile(fixturePath));
}

// `Subject` stands in for a ported class; `View` is its magic-dispatch view
// (HigherOrderTapProxyView<T>, ResolvedHigherOrderWhenProxy<T>, ...).
// `self()` returning `View` again is what makes a chain stay magic at every
// link. `Plain` has the same shape plus its own `__get`/`___call` and no
// brand - HigherOrderWhenProxy/HigherOrderTapProxy *instances* look exactly
// like this, and their explicit calls must stay explicit.
const PRELUDE = `import { MagicDispatch } from 'Illuminate/Support/MagicDispatch';

type View = MagicDispatch<Subject>;

class Subject
{
    public active = false;

    public isActive(): boolean
    {
        return this.active;
    }

    public activate(reason: string): string
    {
        return reason;
    }

    public rename(first: string, last: string): string
    {
        return \`\${first} \${last}\`;
    }

    public self(): View
    {
        return this as unknown as View;
    }
}

class Plain
{
    public active = false;

    public isActive(): boolean
    {
        return this.active;
    }

    public __get(key: string): unknown
    {
        return key;
    }

    public ___call(method: string, parameters: unknown[]): unknown
    {
        return [method, parameters];
    }
}

declare const view: View;
declare const plain: Plain;
`;

test('rewrites a bare property read on a magic value to __get', () => {
    const { text, editCount } = rewrite(PRELUDE + `
const active = view.active;
`);

    assert.equal(text, PRELUDE + `
const active = view.__get('active');
`);
    assert.equal(editCount, 1);
});

test('rewrites a method call to ___call, arguments included and themselves rewritten', () => {
    const { text, editCount } = rewrite(PRELUDE + `
const checked = view.isActive();
const renamed = view.rename('Taylor', view.activate('first'));
`);

    assert.equal(text, PRELUDE + `
const checked = view.___call('isActive', []);
const renamed = view.___call('rename', ['Taylor', view.___call('activate', ['first'])]);
`);
    assert.equal(editCount, 3);
});

test('rewrites a chained receiver inside-out, every link', () => {
    const { text, editCount } = rewrite(PRELUDE + `
const active = view.self().active;
const activated = view.self().self().activate('chain');
`);

    assert.equal(text, PRELUDE + `
const active = view.___call('self', []).__get('active');
const activated = view.___call('self', []).___call('self', []).___call('activate', ['chain']);
`);
    assert.equal(editCount, 5);
});

test('leaves a hand-written __get/___call on a magic value untouched', () => {
    const source = PRELUDE + `
const active = view.__get('active');
const activated = view.___call('activate', ['explicit']);
`;

    const { text, editCount } = rewrite(source);

    assert.equal(text, source);
    assert.equal(editCount, 0);
});

test('leaves a non-magic receiver untouched, even one with a __get of its own', () => {
    const source = PRELUDE + `
const active = plain.active;
const checked = plain.isActive();
const key = plain.__get('active');
`;

    const { text, editCount } = rewrite(source);

    assert.equal(text, source);
    assert.equal(editCount, 0);
});

test('reports zero edits and byte-identical text for a file with nothing to rewrite', () => {
    const source = `// Leading trivia and a trailing newline have to survive too.
${PRELUDE}
function describe(subject: Plain): string
{
    return subject.isActive() ? 'active' : 'inactive';
}
`;

    const { text, editCount } = rewrite(source);

    assert.equal(text, source);
    assert.equal(editCount, 0);
});

// The FEEDBACK.md regression: a rewritten call's result used as a typed
// value. A rewrite that typed results `unknown` passes every string
// assertion above and fails only here, when the rewritten text is
// type-checked the way rbxtsc will.
test('keeps the result of a rewritten call typed: assignable, chainable, zero diagnostics', () => {
    const source = PRELUDE + `
const activated: string = view.activate('typed');
const length: number = view.rename('Taylor', 'Otwell').length;
const active: boolean = view.self().isActive();
`;
    assert.deepEqual(diagnosticsOf(source), []);

    const { text, editCount } = rewrite(source);

    assert.equal(text, PRELUDE + `
const activated: string = view.___call('activate', ['typed']);
const length: number = view.___call('rename', ['Taylor', 'Otwell']).length;
const active: boolean = view.___call('self', []).___call('isActive', []);
`);
    assert.equal(editCount, 4);
    assert.deepEqual(diagnosticsOf(text), []);
});

// Negative controls for the test above: the same check has to *fail* on a
// deliberately wrong use, or its zero-diagnostics assertion proves nothing.
test('still rejects a wrong argument type after the rewrite', () => {
    const { text } = rewrite(PRELUDE + `
const activated = view.activate(42);
`);

    assert.ok(text.includes(`view.___call('activate', [42])`));
    assert.deepEqual(diagnosticsOf(text), ["2322: Type 'number' is not assignable to type 'string'."]);
});

test('still rejects a wrong const annotation on the result after the rewrite', () => {
    const { text } = rewrite(PRELUDE + `
const activated: number = view.activate('typed');
`);

    assert.ok(text.includes(`view.___call('activate', ['typed'])`));
    assert.deepEqual(diagnosticsOf(text), ["2322: Type 'string' is not assignable to type 'number'."]);
});

test('still rejects an unknown member on the result after the rewrite', () => {
    const { text } = rewrite(PRELUDE + `
const missing = view.rename('Taylor', 'Otwell').missing;
`);

    assert.ok(text.includes(`view.___call('rename', ['Taylor', 'Otwell']).missing`));
    assert.deepEqual(diagnosticsOf(text), ["2339: Property 'missing' does not exist on type 'string'."]);
});
