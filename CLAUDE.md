# Larablox Framework (repository: framework)

An in-house port of the Laravel framework to roblox-ts, as faithfully as the
platform allows. Consumed by Roblox games (starting with
[`larablox/larablox`](https://github.com/larablox/larablox)) as the npm
package `@larablox/framework`.

## Stack

- TypeScript 5.x → Luau via roblox-ts (`rbxtsc`); not Node, not a browser
- Package manager: npm
- Tests: none yet (see `agent_docs/porting-plan.md`, item 3)

## Layout

Mirrors [`laravel/framework`](https://github.com/laravel/framework):

- `src/Illuminate/` — the framework core, one directory per component, same
  names as upstream Laravel
- `src/Monolog/` — the logging backend `Illuminate/Log` builds on. Laravel
  depends on `monolog/monolog` as a separate Composer package; there is no
  Luau port of Monolog to depend on the same way, so it is vendored here
  instead — the one deliberate divergence from the reference layout, and it
  stays only until a standalone port exists.
- `out/` — generated Luau, a build artifact; never edit by hand

There is no game here — no `server`/`client` split, no entry point. Anything
under `src/Illuminate` or `src/Monolog` must not import from outside those
two directories.

## Commands

| Task                                    | Command                    |
|------------------------------------------|----------------------------|
| Install                                 | `npm ci` + `rokit install` |
| Compile TypeScript to Luau              | `npm run build`            |
| Watch sources in `src/` (TypeScript)    | `npm run dev`              |
| Watch artifacts in `out/` (Studio)      | `rojo serve`               |
| Lint                                    | `npm run lint`             |
| Lint + autofix                          | `npm run lint:fix`         |
| Analyze generated Luau                  | `npm run analyze`          |
| Remove build artifacts                  | `npm run clean`            |

`npm run analyze` rebuilds the project and refreshes the sourcemap on its
own. Run `npm run types:roblox` once after cloning — the Roblox API
definitions are 650 KB and are not kept in the repository.

`default.project.json` here is a throwaway Studio place used only to run
this repo's own test suite once it exists — it is not a game.

## Rules

- Reply to the user in Russian; keep all code, identifiers, and commit
  messages in English.
- When porting a framework component, check it against the Laravel sources:
  reproduce class names, method names, and argument order literally. Diverge
  only where the platform forces it, and say so in your reply.
- A successful build proves nothing: `rbxtsc` only checks TS types. After
  changing `src/`, run `npm run analyze` and read the corresponding file in
  `out/` — the compiler does not see Luau semantics.
- The build is incremental: `rbxtsc` will not regenerate a file whose source
  did not change, so edits made directly in `out/` survive `npm run build`.
  Run `npm run clean` first when you need to trust what is in `out/`.
- Formatting and style are `npm run lint:fix`'s job, not yours.
- No Node APIs, no DOM, no `window`. The runtime is Luau; the only usable npm
  packages are `@rbxts/*`.
- Do not add dependencies unless asked.
- `"declaration": true` is what a consumer needs for real `.d.ts` files, but
  it is currently **off**: turning it on makes `rbxtsc` fail with TS4094
  ("Property of exported class expression may not be private or protected")
  on every mixin (`Conditionable`, `ForwardsCalls`, `InteractsWithData`, and
  everything that extends them — `Request`, `Stringable`, `Response`,
  `PendingRequest`, ...). This is the trait-as-mixin pattern
  `roblox-ts-constraints.md` documents as load-bearing for the whole port —
  do not "fix" it by dropping `private`/`protected` on those members without
  discussing it first; that is a real encapsulation change, not a workaround.

## Publishing

`npm publish --access public` requires an npm login this environment does
not have — that step is run by hand, not by an agent. See
`agent_docs/porting-plan.md` for the current state of the release workflow.

## Topic details

Read the relevant file when a task touches it:

- `agent_docs/porting-plan.md` — current state, gaps inside ported
  components, what to port next; start here when picking up work
- `agent_docs/laravel-parity.md` — what is ported and how it maps to Laravel
- `agent_docs/framework-boot.md` — Application, ServiceProvider,
  register/boot. Written from a consuming game's point of view (its code
  examples, e.g. `server/bootstrap/app.ts`, live in the game repo, not here)
- `agent_docs/roblox-ts-constraints.md` — transpilation limits, tsconfig
- `agent_docs/routing-design.md` — routing over remotes: request envelope,
  Request/Response, route registration, client side. A consuming game must
  declare the `Call`/`Send`/`Stream`/`Push` remotes this depends on in its
  own `default.project.json`.
