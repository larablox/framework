#!/usr/bin/env node
// `npm run build` is one shot: transform then compile. Watch mode needs both
// running continuously and cooperating - the transform rewrites src/ into
// .magic-dispatch/ on every change, and rbxtsc -w watches .magic-dispatch/
// itself, so a src/ edit has to reach rbxtsc through that shadow copy.
// No new dependency for this (CLAUDE.md: don't add one unless asked) -
// spawning both and forwarding signals is a dozen lines of child_process.
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const transformScript = path.join(projectRoot, 'scripts/build/transform-magic-dispatch.mjs');

// One synchronous pass first: rbxtsc -w does its own initial compile the
// moment it starts, so .magic-dispatch/ has to be populated *before* that,
// not racing it via the watcher's first async run.
execFileSync(process.execPath, [transformScript], { cwd: projectRoot, stdio: 'inherit' });

const transform = spawn(
	process.execPath,
	[transformScript, '--watch'],
	{ cwd: projectRoot, stdio: 'inherit' },
);

const rbxtsc = spawn('rbxtsc', ['-w', '-p', 'tsconfig.magic-dispatch.json'], {
	cwd: projectRoot,
	stdio: 'inherit',
	shell: process.platform === 'win32',
});

function shutdown(code)
{
	transform.kill();
	rbxtsc.kill();
	process.exit(code ?? 0);
}

transform.on('exit', (code) => shutdown(code));
rbxtsc.on('exit', (code) => shutdown(code));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
