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
- `.workbench/` — a consumer of the package, for trying a theory against a
  running place instead of arguing about it. Its own npm project, tsconfig and
  Rojo place; never shipped (`files` keeps it out, `npm pack --dry-run`
  confirms). See `.workbench/README.md`

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
| Run the suite (no Studio)               | `npm test`                 |
| Run one spec (no Studio)                | `npm run test:lune -- <filter>` |
| Build the test place                    | `npm run test:build`       |
| Serve the test place to Studio          | `npm run test:serve`       |
| Remove build artifacts                  | `npm run clean`            |
| Install the workbench                   | `npm run workbench:install`|
| Build the workbench                     | `npm run workbench`        |
| Build the workbench place file          | `npm run workbench:place`  |
| Serve the workbench to Studio           | `npm run workbench:serve`  |

`npm run analyze` rebuilds the project and refreshes the sourcemap on its
own. Run `npm run types:roblox` once after cloning — the Roblox API
definitions are 650 KB and are not kept in the repository.

`default.project.json` here is a throwaway Studio place used only to run
this repo's own test suite once it exists — it is not a game.

`npm test` runs the suite under **Lune**, with no Studio and no DataModel —
1096 of the suite's 1141 tests in about 13 seconds. The other 45 live in five
spec files that are about `DataStoreService` and `MemoryStoreService` and
nothing else; those are skipped, named at the end of every run, and still need
Studio or Open Cloud. A green `npm test` is therefore not a green suite, which
is why the run says so out loud. `agent_docs/testing.md` has how the harness
works and why the two services are not faked.

## The workbench

`.workbench/` is a game that consumes this package, kept for the questions a
compiler cannot answer: does the request actually reach the controller, does
the sandbox actually isolate, do two overlapping requests actually keep their
own route parameters. `npm run analyze` reads the generated Luau as code; the
workbench runs it.

Two things about it are load-bearing and were arrived at the hard way:

- **The framework is linked in as `out/` only**, by
  `.workbench/scripts/link-framework.mjs`, not as a `"file:.."` dependency.
  npm would symlink the whole repository, and the repository contains
  `.workbench` — so the workbench's own modules become reachable through the
  link and roblox-ts fails with `Could not find Rojo data` on them.
- **`preserveSymlinks` is on** in `.workbench/tsconfig.json`, for the same
  cycle: without it TypeScript resolves the link to its real path and decides
  the package root is the repository.

So the workbench compiles against **built** output: change `src/` here, run
`npm run build` here, and the workbench sees it with no reinstall. The Rojo
place declares the `Call`/`Send`/`Stream`/`Push` remotes the gateway waits for.

**The workbench lints itself** — `.workbench/eslint.config.js`, reachable as
`npm run workbench:lint` from the root. The root config ignores `.workbench/**`
outright, and has to: it is a separate npm project, CI installs only this one,
and linting it from a runner with no `.workbench/node_modules` fails on every
import with "Scope @larablox is declared in typeRoots but was not found". Its
rules are the framework's, spelled out again with a different TypeScript
project; the plugins resolve from this repository's `node_modules`, so the
workbench needs no lint dependencies of its own.

Its lint does depend on `out/` existing. Run it straight after `npm run clean`
and every framework type degrades to `any`, which `roblox-ts/lua-truthiness`
then reports as errors that are not there. Build first.

CI (`.github/workflows/ci.yml`) checks the package only — `npm ci`, `lint`,
`analyze`. It does not install or build the workbench, so nothing in there can
break the package's checks.

## Rules

- Reply to the user in Russian; keep all code, identifiers, and commit
  messages in English.
- When porting a framework component, check it against the Laravel sources:
  reproduce class names, method names, and argument order literally. Diverge
  only where the platform forces it, and say so in your reply.
- **Every public member is in use.** This is a library: its callers are games,
  and none of them are in this repository. So `grep` finding no caller says
  nothing at all — not that a method is dead, not that a bug in it does not
  matter, not that its behaviour is safe to change. The surface is defined by
  Laravel, not by whatever `src/` happens to call.
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
- `"declaration": true` is **on**, and has to stay on: without the `.d.ts`
  it emits, a consumer gets TS2307 on every deep import. It only compiles
  because each mixin with non-public members declares its own return type —
  `export declare class <Name>Shape` next to the factory (exported, and
  *not* through `export type { ... }` — roblox-ts leaves that one in the
  compiled module table), `as never` on the returned class expression.
  Without it, declaration emit fails with
  TS4094 ("Property of exported class expression may not be private or
  protected") on `Conditionable`, `ForwardsCalls`, `InteractsWithData`,
  `ResolvesRouteDependencies` and everything extending them (`Request`,
  `Stringable`, `Response`, `PendingRequest`, the dispatchers). The
  **public** half of each shape is checked against the trait in both
  directions and will fail the build if the two drift; the `private` and
  `protected` members cannot be (nothing in the type system reaches across
  two declarations), so those seven are on the honour system — change one
  and change its shape. A class extending such a mixin also needs an explicit
  `import type` of the shape, or its `.d.ts` keeps a baseUrl path no
  consumer can resolve; `grep 'import("Illuminate/' out --include='*.d.ts'`
  must come back empty. `roblox-ts-constraints.md` has the full pattern and
  the reasoning behind both. Do not
  "simplify" it by dropping `private`/`protected` on those members: that
  clears TS4094 too, but it is a real encapsulation change, it diverges from
  Laravel, and anonymous-class emit erases `this` types on the way out.

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
  generates its own from `src/index.ts`; this package has no barrel to
  generate one from — only the per-module declarations that land beside the
  Luau in `out/Illuminate` — so the file is committed.
- **`files` lists only `index.d.ts` and `out/Illuminate`.** The specs
  compile to `out-tests/` for exactly this reason — `npm pack --dry-run` is
  the way to check nothing else crept in.

A consequence worth telling consumers about: because `index.d.ts` is
`export {}`, an editor has nothing to auto-import from. TypeScript offers
completions for what is *in the program*, and a deep-imported module only
enters the program once some file already imports it — so `Log` and everything
else is invisible until it has been typed out by hand once. A barrel would fix
the completion and break the runtime: roblox-ts would emit a require of the
package root, and there is no module there in the DataModel.

The fix is on the consumer's side — list the declarations in its `tsconfig.json`
so they are all in the program from the start:

```json
"include": [
    "src/**/*.ts",
    "node_modules/@larablox/framework/out/Illuminate/**/*.d.ts"
]
```

`.workbench/tsconfig.json` does this; verified with `tsc --listFiles` (303
declaration files in the program, `Facades/Log.d.ts` among them, with nothing
importing it).

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
