# Larablox Framework (repository: framework)

An in-house port of the Laravel framework to roblox-ts, as faithfully as the
platform allows. Consumed by Roblox games (starting with
[`larablox/larablox`](https://github.com/larablox/larablox)) as the npm
package `@larablox/framework`.

## Stack

- TypeScript 5.x → Luau via roblox-ts (`rbxtsc`); not Node, not a browser
- Package manager: npm
- Tests: TestEZ (`@rbxts/testez`) -- see `agent_docs/testing.md`

## Layout

Mirrors [`laravel/framework`](https://github.com/laravel/framework):

- `src/Illuminate/` — the framework core, one directory per component, same
  names as upstream Laravel
- `out/` — generated Luau, a build artifact; never edit by hand

There is no game here — no `server`/`client` split, no entry point.
`Illuminate/Log` depends on Monolog the same way Laravel does — as an
external package, [`@larablox/monolog`](https://github.com/larablox/monolog),
not vendored code, and depended on by a real semver range (`^0.2.0`) now
that it is published. It is a **dependency**, not a devDependency: the
compiled `out/Illuminate/Log/LogManager.luau` reaches for it at runtime
through `TS.getModule`, so a consumer that did not get it installed would
fail there.

## Depending on `@larablox/monolog`

Two things a real npm range alone will not give you, both discovered getting
this wired up, both load-bearing:

- **Deep imports need the `out/` segment.** `@larablox/monolog`'s compiled
  output lives at `out/Monolog/...` inside the package (its `outDir`), so the
  import is `"@larablox/monolog/out/Monolog/Logger"`, not
  `"@larablox/monolog/Monolog/Logger"`. Cosmetic, but get it wrong and you
  get a plain "cannot find module".
- **`node_modules/@larablox` must be in `tsconfig.json`'s `typeRoots`.**
  roblox-ts refuses a scoped deep import unless the scope directory is listed
  there (`createImportExpression.js`'s `validateModule`) — already done here.
  That in turn makes TypeScript try to auto-load every package under
  `node_modules/@larablox` as an implicit global type library, which fails
  unless the package has a `types` entry. That's what `@larablox/monolog`'s
  `src/index.ts` is — an otherwise-empty file that exists only to satisfy
  that scan, not a real barrel. Any future `@larablox/*` dependency needs the
  same shim, or the build breaks the same way.

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

Pushing a `v*` tag runs `.github/workflows/release.yml`, which checks the
tag against `package.json`'s version, builds, and publishes through npm
trusted publishing (OIDC — no token in the repository, and npm attaches a
provenance attestation on its own). Nothing about it needs an agent, and an
agent has no npm login to do it by hand with.

Two things the package needs that are easy to break:

- **`index.d.ts` is checked in, not generated.** A consumer must list
  `node_modules/@larablox` in `typeRoots` to deep-import, and that makes
  TypeScript try to load `@larablox/framework` as an implicit type library,
  which needs a `types` entry to point somewhere. `@larablox/monolog`
  generates its own from `src/index.ts` because it has `declaration` on;
  this one cannot (see the TS4094 note above), so the file is committed.
- **`files` lists only `index.d.ts` and `out/Illuminate`.** The specs
  compile to `out-tests/` for exactly this reason — `npm pack --dry-run` is
  the way to check nothing else crept in.

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
- `agent_docs/testing.md` — how the TestEZ suite under `tests/` is set up,
  the two-`tsconfig` build split, and how to run it in Studio.
