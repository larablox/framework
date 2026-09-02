# Larablox Framework (repository: framework)

An in-house port of the Laravel framework to roblox-ts, as faithfully as the
platform allows. Consumed by Roblox games (starting with
[`larablox/larablox`](https://github.com/larablox/larablox)) as the npm
package `@larablox/framework`.

## Stack

- TypeScript 5.x → Luau via roblox-ts (`rbxtsc`); not Node, not a browser
- Package manager: npm

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
| Install                                 | `npm ci`                   |
| Compile TypeScript to Luau              | `npm run build`            |
| Watch sources in `src/` (TypeScript)    | `npm run dev`              |
| Watch artifacts in `out/` (Studio)      | `rojo serve`               |
| Remove build artifacts                  | `npm run clean`            |
| Install the workbench                   | `npm run workbench:install`|
| Build the workbench                     | `npm run workbench`        |
| Build the workbench place file          | `npm run workbench:place`  |
| Serve the workbench to Studio           | `npm run workbench:serve`  |

`.nvmrc` holds the Node line this is developed on. `nvm use $(cat .nvmrc)` —
nvm for Windows does not read the file on its own.

There is deliberately no `engines` field. It would describe what a *consumer*
needs, and a consumer's Node only runs `rbxtsc`: the runtime this package
ships to is Luau. Claiming `>=24` there would hand everyone still on 20 or 22
an `EBADENGINE` warning for a requirement that is ours, not theirs.

`default.project.json` here is a throwaway Studio place for watching `out/`
directly via `rojo serve` — it is not a game.

## The workbench

`.workbench/` is a game that consumes this package, kept for the questions a
compiler cannot answer: does the request actually reach the controller, does
the sandbox actually isolate, do two overlapping requests actually keep their
own route parameters.

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
  changing `src/`, run `npm run build` and read the corresponding file in
  `out/` — the compiler does not see Luau semantics.
- The build is incremental: `rbxtsc` will not regenerate a file whose source
  did not change, so edits made directly in `out/` survive `npm run build`.
  Run `npm run clean` first when you need to trust what is in `out/`.
- No Node APIs, no DOM, no `window`. The runtime is Luau; the only usable npm
  packages are `@rbxts/*`.
- Do not add dependencies unless asked.
- `"declaration": true` is **on**, and has to stay on: without the `.d.ts`
  it emits, a consumer gets TS2307 on every deep import. A mixin with
  non-public members will need its own declared return type to satisfy
  this — `export declare class <Name>Shape` next to the factory (exported,
  and *not* through `export type { ... }` — roblox-ts leaves that one in the
  compiled module table), `as never` on the returned class expression —
  or declaration emit fails with TS4094 ("Property of exported class
  expression may not be private or protected"). A class extending such a
  mixin also needs an explicit `import type` of the shape, or its `.d.ts`
  keeps a baseUrl path no consumer can resolve; `grep 'import("Illuminate/'
  out --include='*.d.ts'` must come back empty. Do not "simplify" it by
  dropping `private`/`protected` on the mixin's members: that clears
  TS4094 too, but it is a real encapsulation change, it diverges from
  Laravel, and anonymous-class emit erases `this` types on the way out.

## Publishing

Two things the package needs that are easy to break:

- **`index.d.ts` is checked in, not generated.** A consumer must list
  `node_modules/@larablox` in `typeRoots` to deep-import, and that makes
  TypeScript try to load `@larablox/framework` as an implicit type library,
  which needs a `types` entry to point somewhere. `@larablox/monolog`
  generates its own from `src/index.ts`; this package has no barrel to
  generate one from — only the per-module declarations that land beside the
  Luau in `out/Illuminate` — so the file is committed.
- **`files` lists only `index.d.ts` and `out/Illuminate`.** `npm pack
  --dry-run` is the way to check nothing else crept in.

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

`.workbench/tsconfig.json` does this; verify with `tsc --listFiles` that the
declarations under `node_modules/@larablox/framework/out/Illuminate` are in
the program, with nothing importing them yet.
