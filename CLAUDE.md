# Larablox Framework (repository: framework)

An in-house port of the Laravel framework to roblox-ts, as faithfully as the platform allows.

## Stack

- TypeScript 5.x → Luau via roblox-ts (`rbxtsc`); not Node, not a browser
- Package manager: npm
- Tests: TestEZ (`@rbxts/testez`), run under Lune (`npm test`) -- `lune` must
  be installed and on `PATH`

## Layout

Mirrors [`laravel/framework`](https://github.com/laravel/framework):

- `src/Illuminate/` — the framework core, one directory per component, same names as upstream Laravel
- `tests/Illuminate/` — specs, one `*.spec.ts` per ported file, same layout as `src/`
- `out/` — generated Luau, a build artifact; never edit by hand
- `out-tests/` — generated Luau for `npm test`; never edit by hand
- `.magic-dispatch/` — a generated shadow copy of `src/` and `tests/`, rewritten by `npm run build`/`watch`/`test`; never edit by hand

## Rules

- Keep all code, identifiers, and commit messages in English.
- Port letter-for-letter: same constructs, same variable names as the PHP.
  Diverge only where TypeScript/roblox-ts/Luau genuinely forces it, and
  record that divergence in `CONVENTIONS.md`.
