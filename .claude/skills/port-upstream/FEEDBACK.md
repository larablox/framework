# port-upstream: feedback log

Every agent that runs the `port-upstream` skill appends one entry here
before finishing (see SKILL.md §6). Newest entry last. The maintainer
folds *Proposed* items into SKILL.md / CONVENTIONS.md / the tooling and
may prune entries once they are absorbed - until then, this file is the
freshest list of traps, so read it before starting a port.

Entry template (copy it, keep the headings):

```
## YYYY-MM-DD - <FQCN or directory ported>

**Result:** <N/N members at 100%, or which weren't and why>

**Applied:** <changes made directly as part of the port - CONVENTIONS.md
sections, canonicalize.mjs folds + tests, skill corrections - one line each>

**Friction:** <every command/check/residue that didn't behave as SKILL.md
said, with the exact command and output; every place you had to guess>

**Proposed:** <changes for the maintainer: skill wording/workflow, new
translation-table rows, tooling ideas - one line of rationale each>
```

---

## 2026-09-04 - Illuminate\Support\HigherOrderWhenProxy (finishing pass; Conditionable already at 100%)

**Result:** 9/9 members at 100% (`__call` went 88.6% -> 100%);
Conditionable 2/2 stayed at 100%.

**Applied:**
- CONVENTIONS.md: "explicit dynamic-dispatch receiver" divergence under
  Magic dispatch (Luau `:` needs a literal method name; `obj[m](...)`
  drops `self`), with the emitted `.luau` line as evidence.
- CONVENTIONS.md: `func_num_args()` <-> `decoratePackedArgs()` wiring rule,
  now enforced by `scripts/lint/check-packed-args.mjs` on every build.
- `canonicalize.mjs`: `foldExplicitDynamicDispatchReceiver`; the whole
  canonicalization split out of `check.mjs` into an ordered list of
  fold passes, each with a case in `canonicalize.test.mjs` (19 tests,
  `npm run test:parity`).
- `npm run parity` (`scripts/parity/aggregate.mjs`): whole-tree report to
  `reports/parity/all.csv` plus a printed below-100% worklist.
- `src/Illuminate/Support/types.ts` with `Callable`; HigherOrderWhenProxy's
  target field typed `T & Record<string, unknown>` once in the
  constructor, removing every body-level `as`.

**Friction:**
- `npx rbxtsc --noEmit -p .` printed only `Unknown argument: noEmit` and
  exited; piped through `grep -i error` that line vanished and a fix was
  reported as "compiles" when nothing had been checked. Only
  `npm run build` is a real compile check.
- The "class-name type hint" drop rule (`ReflectionParameter $p`) is not
  exercised by either ported file, so a before/after CSV diff could not
  have caught a regression in it during the checker refactor - found only
  by writing a synthetic unit test. Every fold now has one.
- A reflowed `--` at a line start/end (`CONVENTIONS.md` lines 80/128/137,
  `extract-php.php` 3/101) survived a `s/ -- / - /` pass; `.luau` files
  need their leading `--` comment marker left alone.

**Proposed:**
- SKILL.md §2.4 lists constructs with no convention yet; the first port to
  hit `interface`/`enum`/class `const`/PHP arrays should turn its decision
  into a translation-table row rather than leaving it in prose only.
- `check.mjs` still shells out to `php` once per file; once `npm run
  parity` covers dozens of files, batch the extraction (one PHP process
  dumping every class) - not worth it at two files.
- A fold in `canonicalize.mjs` whose rule current ports never hit is
  invisible to `npm run parity`; consider a test that asserts each
  exported pass is referenced by at least one test case, so the "every
  fold has a test" rule can't drift.

## 2026-09-04 - Illuminate\Support\HigherOrderTapProxy

**Result:** 3/3 members at 100% (`__construct`, `__call`, `target`), empty
`--show` residue for each on the first checker run; whole tree 14/14 at
100% across 3 files. Spec: 9 TestEZ cases, all passing under Lune.

**Applied:**
- `src/Illuminate/Support/MagicDispatch.ts`: the `MagicDispatch<T>` brand
  now declares typed `__get<K>(key: K): T[K]` and `___call<K>(method: K,
  parameters)` members off the view's own `K`, so a rewritten magic call
  keeps the return type the source access had.
- `scripts/build/transform-magic-dispatch.mjs`: emits the plain
  `receiver.___call('m', [args])` / `receiver.__get('k')` CONVENTIONS.md
  already described, instead of casting the receiver to a throwaway
  `{ ___call(...): unknown }`; a hand-written `__get`/`___call` on a
  magic-typed value is now left alone instead of re-routed into a magic
  call named `___call`.
- CONVENTIONS.md, Magic dispatch: a paragraph on the typed rewrite and why
  the cast had to go.
- No new fold: the port matched the existing folds out of the box
  (`foldDynamicMemberAccess`, `foldExplicitDynamicDispatchReceiver`,
  `renameConstructorToken`, the type-range stripping).

**Friction:**
- `npm run build` passed, then `npm test` failed in `test:build` on the
  spec's one chained call, `view.activate('chain').isActive()`:
  `.magic-dispatch/tests/.../HigherOrderTapProxy.spec.ts:116:32 - error
  TS2571: Object is of type 'unknown'.` The transform's rewrite typed every
  magic-call result `unknown`, which no existing spec had ever noticed
  because every result went straight into `expect()` or another magic hop
  (which re-cast). A tap proxy exists only to hand the target back for
  further use, so the first realistic use of it hit this immediately. Fixed
  at the type level as listed under Applied; verified with a scratch
  `tsc` probe that wrong arity, a wrong argument type, a non-method key,
  and a wrong result type are all still errors after the rewrite (removing
  one `@ts-expect-error` reported `Argument of type '[]' is not assignable
  to parameter of type '[reason: string]'`).
- A plain `npx tsc -p <probe tsconfig>` over `src/` plus a probe file
  reports a dozen errors inside `node_modules/@rbxts/*` typings
  (`Global type 'Iterable' must have 3 type parameter(s)`, `Cannot find
  name 'CustomMatchers'`); those are environmental and unrelated to the
  probe. Filter on the probe's own path and prove it is checked by
  injecting a deliberate error first.
- The PHP lives at `Illuminate/Support/HigherOrderTapProxy.php` and its
  namespace matches, so the namespace-vs-physical-path table in §1 did not
  come into play here.

**Proposed:**
- §2.3 says "export `Resolved…`/`Pending…` view types"; a proxy with one
  state (tap) has no natural adjective, so this port exports
  `HigherOrderTapProxyView<T>`. Suggest the skill name the single-state
  spelling (`<Class>View<T>`) so the next one-state proxy doesn't guess.
- §2.3's "cast once in the constructor" pattern types the field as
  `T & Record<string, unknown>`; on a *public* field (this class, unlike
  `HigherOrderWhenProxy`'s `protected` one) that intersection leaks into the
  API: reading `proxy.target` as a `Subject` is fine, but assigning
  `proxy.target = new Subject()` is not (scratch probe: `TS2322: Type
  'Subject' is not assignable to type 'Subject & Record<string, unknown>'`).
  Followed the reference as written; worth a sentence in §2.3 on whether
  a public field should instead stay `T` and cast at the one use site.
- Add a test to the transform for "result of a magic call used as a typed
  value" (assignment to a typed `const`, a plain chained member) - this
  port's spec is currently the only guard against a regression.
- `HigherOrderWhenProxy` still has no spec of its own (only Conditionable's
  covers it indirectly); the definition-of-done checkbox would fail on it
  today.
