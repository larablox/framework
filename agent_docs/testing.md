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
**not** set `"declaration": true`, though `tsconfig.json` does. Declarations
are on in the publish build because the package ships them — without them a
consumer gets TS2307 on every deep import (see "## Rules" in `CLAUDE.md` and
the mixin note in `roblox-ts-constraints.md`). Nothing imports from
`out-tests/`: it is a Studio place, so emitting `.d.ts` there would only
cost build time.

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

The Studio runner is `scripts/studio/RunTests.server.luau`, mounted by
`test.project.json` as `ServerScriptService.RunTests`. It warms up every
module in both `Illuminate` and `IlluminateTests` through `TS.import` — see
monolog's `agent_docs/testing.md` for why that step is required and not
decorative — and then runs TestEZ against `IlluminateTests`.

It drives TestEZ through the four steps `TestBootstrap:run()` documents
(locate, plan, run, report) rather than calling it, because `TestBootstrap`
hands its reporter the *finished* tree: a run says nothing at all until it
is over, and a slow one is indistinguishable from a hung one. The output is
PHPUnit's instead — a progress row per 63 tests while it runs, then a
numbered list of failures, then the totals:

```
Running 1141 tests, 54 of them overlapped across 5 files

...............................................................  63 / 1141 (  5%)
...............................................................  126 / 1141 ( 11%)
...

Time: 46.3s

There were 2 failures:

1) IlluminateTests > Support > Str > Searching > position() finds ...
   Expected value "999" (number), got "7" (number) instead
   IlluminateTests.Support.Str.Searching.spec:29

FAILURES!
Tests: 1141, Failures: 2.
```

Two details are load-bearing. Progress needs a per-test hook, and TestEZ
has none, so the three `TestSession` methods that write a leaf's outcome are
wrapped for the duration of the run — every session reaches them through
`TestSession.__index`, and the originals go back afterwards. And the failure
line carries the first spec frame of the traceback: an `expect` failure
names TestRunner, not the assertion that tripped, so without it the report
says only *what* differed and never *where*.

`TextReporter`, TestEZ's own, prints the whole plan tree one line per test.
At this suite's size that overflows Studio's log buffer and scrolls the
failures out of reach before anyone can read them — which is why the format
above exists rather than a per-test listing.

To run: `npm run test:build`, `npm run test:serve` (or `rojo serve
test.project.json`), connect Studio's Rojo plugin to it, press Play. Output
goes to the console. Re-run after any source change with `npm run
test:build` (or `npm run test:watch`) then press Play again — a `ModuleScript`
that already failed once caches that failure for the rest of the session, so
mid-session edits to a broken module need a fresh Play, not just a re-sync.

## Running them without Studio

`npm test` runs the same specs under [Lune](https://lune-rs.com), a standalone
Luau runtime: `npm run test:build` then `lune run scripts/lune/RunTests`. No
Studio, no DataModel, no Rojo connection, a non-zero exit code on failure — so
it runs in CI (`.github/workflows/ci.yml`'s `tests` job, on the same
`ubuntu-latest` as everything else) and it is the fast way to run the suite
locally: **1096 tests in 13.1s**, against 46.3s in Studio.

`npm run test:lune -- <filter>` takes the same filter the Studio runner takes
from `TestFilter`, in the same forms, resolved by the same code.

### What it does not run, and why there is no mock

Five spec files are skipped: `Cache/DataStoreStore`, `Cache/MemoryStoreStore`,
`Queue/MemoryStoreQueue`, `Queue/Size`, `Queue/Failed/DataStoreFailedJobProvider`
— the same five `RunTests.server.luau` overlaps, for the same reason they are
the five. They are about `DataStoreService` and `MemoryStoreService` and nothing
else. Every run names them at the end, so a green Lune run is never mistaken
for a green suite; those 45 tests need Studio or Open Cloud.

Faking the two services was considered and rejected. A fake would have to
reproduce `UpdateAsync`'s compare-and-set, per-key write throttling, the 50-
character key limit, `ListKeysAsync` paging, `GetSizeAsync`'s `excludeInvisible`,
queue invisibility timeouts — that is, it would encode what we *believe* about
the platform, and the tests would then check that belief against itself. This
repository has already paid for that mistake once: `MemoryStoreQueue.size()`
answered `0` on the written grounds that MemoryStore reports no length, and a
test asserted the zero (see "a platform limit asserted instead of checked"
above). `Globals.luau` raises on both services rather than answering, so a spec
that reaches one says so.

The five files are what cannot run *today*; they are not the whole boundary.
`Support/Serializer` also branches on `CFrame`, `Color3`, `Enum`, `UDim`,
`UDim2`, `Vector2` and `Vector3`, none of which exist under Lune and none of
which are faked, for the same reason — reproducing `CFrame` to test `CFrame`
handling proves nothing. No spec covers those branches yet; one written for
them belongs in Studio, and `Globals.luau` raises by name rather than leaving
a nil global, so it will say that rather than failing on an index.

The shims that do exist are deliberately narrow, and their surface was
established by grep rather than guessed: `HttpService` (`JSONEncode`,
`JSONDecode`, `GenerateGUID`), `RunService`, `Players`, `Stats`, `TestService`,
`DateTime`'s four members, and `task`. `Stats.GetTotalMemoryUsageMb()` answers
the Luau heap instead of a constant — `Worker.memoryExceeded()` compares against
it, and a hard zero would turn that comparison into one that can only go one way.

### How the harness works

`scripts/lune/` is four files:

- `Tree.luau` — a virtual instance tree over the filesystem, following Rojo's
  two rules (a `.lua`/`.luau` file is a `ModuleScript`; a directory is a
  `Folder`, or a `ModuleScript` if it holds an `init` file). Built eagerly, and
  that is not a preference: `script.Parent.Foo` resolves through `__index`, and
  Lune's `fs.readDir` yields, which a metamethod may not do.
- `Loader.luau` — rebuilds the mounts `test.project.json` declares, then loads
  each module with `luau.load`'s `environment`, which is what lets a compiled
  module have a `script` of its own and a shared `_G`. **`RuntimeLib` is not
  reimplemented**: roblox-ts's own copy is loaded through this same mechanism
  with `game` and `require` shimmed underneath it, so import resolution,
  circular-dependency detection and `TS.try`/`TS.generator`/`TS.async` stay the
  compiler's code rather than our reading of it. The only thing the harness
  knows about roblox-ts is where that file lives.
- `Globals.luau` — the Roblox globals, as above.
- `RunTests.luau` — the same warm-up, planning, progress and PHPUnit-shaped
  report as `RunTests.server.luau`, minus the overlapping: what that buys is
  removed latency on service calls, and there are no service calls left.

Two consequences worth knowing. `test.project.json`'s mounts are spelled out a
second time in `Loader.luau`, so a mount added there has to be added here too —
the two drifting apart is a run that passes on a tree Studio never sees. And
`TestEZ` needs `getfenv`/`setfenv`, which Lune has; that was the one thing
capable of sinking this approach outright, and it does not.

## Running one spec

The whole suite is 65 seconds, which is the wrong price for debugging one
test. `ServerScriptService.TestFilter` — a `StringValue` the project file
ships empty — narrows the run to specs whose path contains its value:

```
Foundation.Runtime.Worker                             как в списке провалов
tests/Illuminate/Foundation/Runtime/Server.spec.ts    как в редакторе
Foundation/Runtime                                    директория
Routing                                               всё поддерево
```

Регистр не важен, совпадение — по подстроке пути вида
`IlluminateTests.Foundation.Runtime.Worker`.

Путь из редактора работает наравне с путём из вывода, и это не тривиально:
`IlluminateTests` смонтирован на `out-tests/tests/Illuminate`, то есть **два**
сегмента репозиторного пути схлопываются в имя корня. Поэтому фильтр не
пытается знать это соответствие — он отбрасывает ведущие сегменты, пока
остаток не окажется путём. Сначала пробуется самая точная форма, так что
приставка, с которой путь скопировали, отваливается сама.

Если ничего не совпало, раннер печатает несколько настоящих путей — чтобы
промах объяснял себя. Когда файлов немного, он перечисляет и то, что попало
под фильтр, до начала прогона.

Значение правится **прямо в Studio**, в панели Properties: пересобирать и
пересинхронизировать не нужно, достаточно нажать Play заново. Осторожно с
`rojo serve` — очередная синхронизация вернёт значение из проектного файла,
то есть пустое.

Отфильтрованный прогон говорит об этом первой же строкой:

```
Filtered to "Foundation.Runtime" -- 2 of the suite's specs
```

Иначе короткий зелёный прогон не отличить от полного. Фильтр, не совпавший ни
с чем, — это ошибка, а не пустой успех: раннер падает с сообщением, а не
печатает `OK (0 tests)`.

Прогревается при этом по-прежнему всё дерево — 390 модулей за 0.1s, экономить
там нечего.

## Why part of the run overlaps

Five spec files hold 58 of the 1141 tests and about 80% of the running time,
because every one of those tests waits on a Roblox service. Measured on this
place: a `DataStoreService` call costs ~305ms and a `MemoryStoreService` one
~233ms, near enough all of it idle. Ten reads in a row take 3.05s; ten
overlapped take 0.80s. The request budget is nowhere near its limit while that
happens (991 reads left of the minute's allowance), so what is being paid for
is latency, not throughput — and latency is what overlapping removes.

So `RunTests.server.luau` builds one plan for everything else and one plan per
service file, runs the first alone, then runs the rest together. A plan is the
unit a `TestSession` covers, which makes it the smallest thing that can run
beside another. Measured over the whole suite: **110.9s before, 46.3s after**.

What makes a file safe to put in that group is **not** that it is slow — it is
that it shares no state with the others. Each of the five builds its own
`Container` and names its own store from a GUID, and none of them touches a
facade. Everything else runs first and alone, so a spec that does lean on
global state is never interleaved with anything. Add a file to `CONCURRENT`
only after checking the same.

Overlapping buys nothing for a test that only computes: one Luau thread runs
them all and they would simply take turns. Actors — real parallelism — cannot
help either, because a parallel-phase script may not make the yielding service
calls these tests are made of.

The runner timed each test and named the slowest while this was being worked
out; that reporting is gone now the answer is known. Should the question come
back — a run that is suddenly slower, a new file worth adding to `CONCURRENT`
— the way to get it back is to time each leaf between `TestSession:pushNode`
and its outcome, keyed by session, since two sessions are commonly mid-test at
once. Beware of adding those times up: a wall time counts the waiting its
neighbours did, so the first version of that report summed them and announced
"93.8s of 46.3s".

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

## Real bugs this suite has caught

The suite reached green at **1141 passing** on 2026-08-26. Getting there
turned up around thirty genuine framework defects — every one of them
compiled clean, type-checked clean, and was invisible to `npm run analyze`.
They fall into recognisable families, and the families are worth knowing
because the next component ported will hit the same ones:

- **A Luau table is a reference; a PHP array is a value.** `Arr::except()`
  reached into the caller's nested tables, and `Route::bind()` handed
  `originalParameters` the very map `SubstituteBindings` was about to write
  over. Anywhere upstream leans on assignment-copies an explicit copy is
  needed here.
- **One shape, two meanings.** `new Map([[1, x]])` compiles to the same
  table as the list `[x]`, and `[Throttle, "60"]` to the same table as a
  list of two middleware. Both collisions were silently resolving the wrong
  way; both are documented where they were fixed
  (`Container.normalizeParameters()`, `Pipeline/Pipes.ts`).
- **A regular expression translated instead of ported.** `Str::snake()`,
  `Str::deduplicate()`, `whereUlid()` — each read plausibly and matched the
  wrong thing. Read the PCRE pattern character by character, especially
  what a quantifier actually binds to under `/u`.
- **`mb_*` is not `string.*`.** `Str::position()` answered bytes where
  `mb_strpos()` answers characters; `Str::limit()` measured length where
  `mb_strwidth()` measures display width; `trim()` did not strip the 58
  invisible codepoints Laravel's does.
- **`nil` is not `null`.** A table cannot hold one, so *absent* and
  *present-but-null* are one state — which is why several ported cases are
  marked dropped rather than adapted.
- **A platform limit asserted instead of checked.** `MemoryStoreQueue`'s
  `size()` and its three siblings answered `0`, and `clear()` was missing,
  both on the written grounds that MemoryStore reports no length. It does:
  `GetSizeAsync` counts a queue, and `excludeInvisible` draws exactly the
  line PHP gets from a separate `:reserved` key. Worse, a *test* asserted the
  zero, so the gap was pinned in place rather than found. When a port
  diverges "because the platform cannot", check the API before writing the
  test that freezes it — and write the test against what the platform really
  withholds (here: the jobs, not the count).

Two of these specs also leaked into the universe's 64 KB MemoryStore quota,
which is shared with the running game, until a run failed with
`TotalMemoryOverLimit` for reasons that had nothing to do with the code.
Both fixes are worth copying when a spec touches MemoryStore: put the random
part in the **key**, never in the structure's name (`ListItemsAsync`
enumerates a map you can name; nothing enumerates the maps), and give the
quota back in an `afterAll` through the driver's own `clear()` rather than
leaving it to the expiration.

Test-side, three defects in the harness accounted for roughly 240 of the
original failures on their own: TestEZ's `equal()` is Luau `==` (reference
identity on tables, hence `expectDeepEqual` in `tests/Illuminate/TestHelpers.ts`),
its globals are installed with `setfenv` on the callback (so a spec calling
`describe()` at module scope sees a nil `expect` — hence the
`export = (): void => { ... }` wrapper every spec uses), and `throw(msg)`
matches with `err:find()`, which an exception *object* never satisfies.

## As components change

Compiling only checks types; the pattern from `CLAUDE.md`'s own "## Rules"
still applies to `tests/` — `npm run test:build` and `npm run analyze`-style
scrutiny of `out-tests/` prove nothing about Luau runtime behavior. Run the
suite live in Studio before trusting a change, same as monolog: writing
tests against a live Studio run, not just a passing build, is what catches
real bugs (see monolog's own `agent_docs/testing.md` "Real bugs this suite
has already caught" for the pattern — the same class of issue can recur
here).
