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
- `Conditionable::when` read 99% with residue `php: ,` at one point and
  100% later with no relevant checker change in between; the cause was
  never isolated. Treat a 1-token residue on a decorated member as
  suspicious and re-run rather than assume.

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
