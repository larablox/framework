# Larablox Framework (repository: framework)

An in-house port of the Laravel framework to roblox-ts, as faithfully as the platform allows.

## Stack

- TypeScript 5.x → Luau via roblox-ts (`rbxtsc`); not Node, not a browser
- Package manager: npm

## Layout

Mirrors [`laravel/framework`](https://github.com/laravel/framework):

- `src/Illuminate/` — the framework core, one directory per component, same names as upstream Laravel
- `out/` — generated Luau, a build artifact; never edit by hand
- `.magic-dispatch/` — a generated shadow copy of `src/`, rewritten by
  `npm run build`/`watch` before `rbxtsc` compiles it; see CONVENTIONS.md's
  "Magic dispatch" entry. Never edit by hand either.

## Rules

- Keep all code, identifiers, and commit messages in English.
- Port letter-for-letter: same constructs, same variable names as the PHP.
  Diverge only where TypeScript/roblox-ts/Luau genuinely forces it, and
  record that divergence in `CONVENTIONS.md`.
