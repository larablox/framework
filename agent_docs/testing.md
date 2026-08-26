# Testing

Runner: TestEZ (`@rbxts/testez`), same choice and same reasoning as
`@larablox/monolog` (see that repo's `agent_docs/testing.md` for the
candidate evaluation against `jest-lua` — not repeated here). Coverage
mirrors upstream `laravel/framework`'s `tests/...` in this repo's
`tests/Illuminate/...`: same directory shape where the layout translates
(`Container/ContainerTest.php` -> `Illuminate/Container/Container.spec.ts`),
same scenarios, same names where they translate, a `// PHP:
ClassName::testMethodName` comment above each `it()` for traceability. Two
things diverge from PHPUnit on purpose, same as monolog:

- **The `.spec` suffix**, not PHP's `Test` suffix: TestEZ only discovers
  `ModuleScript`s whose name ends in `.spec`.
- Anything that only makes sense under PHPUnit or that exercises a Laravel
  feature this port doesn't have (`Mockery`, `ReflectionClass`,
  `Illuminate\Support\Carbon`, `LazyCollection`, `Macroable`, database
  transactions, ...) is not ported. Say why in a comment at the point of
  omission, same as everywhere else in this repo — see `laravel-parity.md`
  and `porting-plan.md` for the authoritative list of what this port does
  and doesn't have per component.

Each spec file needs `/// <reference types="@rbxts/testez/globals" />` at
the top — `@rbxts/testez`'s `describe`/`it`/`expect` globals aren't picked up
automatically via `typeRoots`.

Only the components this port actually ships have tests: `Container`,
`Events`, `Pipeline`, `Config`, `Cache`, `Queue`, `Bus`, `Log`, `Http`,
`Routing`, `Foundation`, `Support`. Everything under "Чего нет вовсе" in
`porting-plan.md` (`Validation`, `Database`, `Auth`, `Concurrency`,
`Console`/`Artisan`, `Mail`, `Notifications`, `Broadcasting`, `Filesystem`,
`Session`, `View`/`Blade`, `Testing`) has no upstream code to test against
here.

## Two `tsconfig`s, two outputs, on purpose

Same mechanism as `@larablox/monolog`'s own test setup — see that repo's
`tsconfig.tests.json` comment and `agent_docs/testing.md` for the full
rationale (`rootDirs` merge, why a real `rootDir` would crash roblox-ts's
asset-copy step). Applied here: `tsconfig.json` (`npm run build`) is the
publish build, `rootDir: "src"`, `tests/` is not part of it — and critically
**has an explicit `"include": ["src/**/*.ts"]`**, without which TypeScript's
default `**/*` include would sweep `tests/` into the publish build too and
fail with TS6059 ("File is not under 'rootDir'"). `tsconfig.tests.json`
(`npm run test:build`) recompiles `src/` *and* `tests/` together via
`rootDirs: ["src", "tests"]` into `out-tests/`, so specs can `import` real
`Illuminate` classes.

One difference from monolog's version: `tsconfig.tests.json` here does
**not** set `"declaration": true`. Monolog's does, because its own
`tsconfig.json` also does. This repo's `tsconfig.json` keeps `declaration`
off on purpose (see "## Rules" in `CLAUDE.md`) — turning it on fails with
TS4094 on every mixin (`Conditionable`, `ForwardsCalls`, `InteractsWithData`,
`Request`, `Stringable`, `Response`, `PendingRequest`, ...). The test build
recompiles the same `src/`, so it would hit the identical error; there was
never a reason to diverge from the publish build on this setting.

`test.project.json` mounts `ReplicatedStorage.Illuminate` from
`out-tests/src/Illuminate` and `ReplicatedStorage.IlluminateTests` from
`out-tests/tests/Illuminate` — two separate instances, same reasoning as
monolog's `.Monolog`/`.MonologTests` split. It additionally mounts
`ReplicatedStorage.node_modules.@larablox` (this repo depends on
`@larablox/monolog`), mirroring `default.project.json`'s own node_modules
mount. `eslint.config.js` lists both `tsconfig.json` and
`tsconfig.tests.json` under `parserOptions.project` so lint sees `tests/`
too.

## Running them

`test.project.json`'s place has a `ServerScriptService.RunTests` `Script`
that warms up every module in both `Illuminate` and `IlluminateTests`
through `TS.import`, then runs TestEZ against `IlluminateTests`, printing a
pass/fail summary — identical mechanism to monolog's `RunTests` script (see
that repo's `agent_docs/testing.md` for why the warm-up step is required,
not decorative).

To run: `npm run test:build`, `npm run test:serve` (or `rojo serve
test.project.json`), connect Studio's Rojo plugin to it, press Play. Output
goes to the console. Re-run after any source change with `npm run
test:build` (or `npm run test:watch`) then press Play again — a `ModuleScript`
that already failed once caches that failure for the rest of the session, so
mid-session edits to a broken module need a fresh Play, not just a re-sync.

## Formerly a known blocker (fixed 2026-08-26)

`src/Illuminate/Log/LogManager.ts` imports `ConsoleHandler`,
`FingersCrossedHandler`, and `WhatFailureGroupHandler` from
`@larablox/monolog/out/Monolog/Handler/*`. Until 2026-08-26 the linked
`@larablox/monolog` checkout only shipped `NullHandler`,
`RobloxConsoleHandler`, and `TestHandler`, so both `npm run build` and
`npm run test:build` failed on that import — predating the test
infrastructure added here, reproducing identically on a clean `npm run
build` with no `tests/` directory involved at all. Fixed by porting
`GroupHandler`, `WhatFailureGroupHandler`, and `FingersCrossedHandler` from
upstream Monolog into `@larablox/monolog`, plus a new `ConsoleHandler` (not
a port of an upstream class — see that repo's `CLAUDE.md` "Not ported"
section for why) — all in the sibling `monolog` checkout, not here. Both
repos build and lint clean as of this fix.

## As components change

Compiling only checks types; the pattern from `CLAUDE.md`'s own "## Rules"
still applies to `tests/` — `npm run test:build` and `npm run analyze`-style
scrutiny of `out-tests/` prove nothing about Luau runtime behavior. Run the
suite live in Studio before trusting a change, same as monolog: writing
tests against a live Studio run, not just a passing build, is what catches
real bugs (see monolog's own `agent_docs/testing.md` "Real bugs this suite
has already caught" for the pattern — the same class of issue can recur
here).
