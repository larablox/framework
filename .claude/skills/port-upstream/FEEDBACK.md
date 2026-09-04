# port-upstream: feedback log

Every agent that runs the `port-upstream` skill appends one entry here
before finishing (see SKILL.md §6). Newest entry last. The maintainer folds
*Applied*/*Proposed* items into SKILL.md / CONVENTIONS.md / the tooling and
then deletes the entry - what has been decided lives in those files, not
here. So this file is short by design: only what is still open. Read it
before starting a port; it is the freshest list of traps nobody has fixed
yet.

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

## Open items (maintainer-curated, as of 2026-09-04)

Known, not yet fixed. If one of these bites your port, say so in your
entry's *Friction* - a second hit is what moves it up the list.

- `scripts/build/transform-magic-dispatch.mjs` over-counts its "N access
  site(s) rewritten" summary: `transformSourceFile` regexes the whole
  rewritten top-level statement, so hand-written `___call`/`__get` calls in
  a spec's single `export = () => {...}` are counted too. Cosmetic; the fix
  is counting at the rewrite site in `transformNode`, with a test case that
  puts a hand-written `___call` in the same statement as a real rewrite.
- The transform silently passes through element access (`view['key']`), a
  parenthesized callee (`(view.m)(x)`) and would drop `?.` on a magic
  receiver - none of these shapes occur in current sources; the first port
  that writes one needs a guard or a rewrite plus a test.
- `scripts/parity/check.mjs` shells out to `php` once per file; batch the
  extraction (one PHP process dumping every class) once `npm run parity`
  covers enough files to feel slow. Not worth it at five.
- A fold in `canonicalize.mjs` whose rule no current port hits is invisible
  to `npm run parity`; an automated check that every pass has a case in
  `canonicalize.test.mjs` would keep the "every fold has a test" rule from
  drifting. Held by review discipline for now.

---

## 2026-09-04 - Illuminate\Support\Traits\Tappable

**Result:** 1/1 members at 100% (`Tappable::tap`) on the first `check.mjs`
run; `--show=tap` prints an empty residue. `npm run parity`: 15 rows from
4 files, all 100, no unmatched files. `npm test`: 21 parity + 10 transform
node tests, 71 TestEZ cases (57 before, +8 `Tappable.spec.ts`, +6
`helpers.spec.ts`). The trait's one dependency, the global `tap()` helper,
was ported into `Illuminate/Support/helpers.ts` as part of this task (small
helper, §1).

**Applied:**
- `CONVENTIONS.md` "Traits": trait -> mixin factory, `AnyConstructor`'s `any`
  with the `TS2545` evidence (scratch probe through `npm run build`: a
  `new (...args: unknown[]) => T` constraint is refused). SKILL.md §0 says
  this exception is "already documented in CONVENTIONS.md"; it was not -
  only the packed-args `any` was.
- `CONVENTIONS.md` "`null`": roblox-ts rejects `null` outright (`TS
  roblox-ts: \`null\` is not supported! Suggestion: Use \`undefined\`
  instead.`, scratch probe through `npm run build`), so `is_null($x)` is
  `x === undefined` and a bare `null` value is `undefined`.
- `canonicalize.mjs`: `foldIsNullCalls` (PHP `is_null(EXPR)` ->
  `EXPR === undefined`, depth-tracked, recursive like
  `foldDynamicMemberAccess`) and `renameNullToUndefined` (bare `null` ->
  `undefined`, after `stripParamDefaults` has already erased `= null`
  defaults), both wired into `canonicalizePhp`; two cases in
  `canonicalize.test.mjs`. No checked member hits either yet - the only
  `is_null()` in the port is in `tap()`, a free function.
- `aggregate.mjs` header: `helpers.ts` is no longer "project-invented TS
  infrastructure with no Laravel file to mirror" now that `tap()` mirrors
  upstream's `helpers.php`; the comment says so.

**Friction:**
- SKILL.md §0 ("The only two exceptions are already documented in
  CONVENTIONS.md (the mixin AnyConstructor ...)") was wrong about the
  first one - grep found `AnyConstructor` only in `Conditionable.ts` and
  the skill itself. Fixed by the new "Traits" section.
- `tap(this, callback)` inside the mixin, with `callback?: (instance:
  this) => unknown`, matches neither a `tap(value)` nor a `tap(value,
  callback)` overload on the helper (an optional parameter's type is
  `F | undefined`, not assignable to `F`). Solved with a third overload on
  both the helper and the trait (`callback?: ...` ->
  `HigherOrderTapProxyView<T> | T`), which is also exactly PHP's own
  `($callback is null ? HigherOrderTapProxy : $this)` for a nullable
  argument - not with `callback!`, which would have lied about the runtime.
- A union containing a magic view (`HigherOrderTapProxyView<T> | T`) is
  not rewritten by the transform: `isMagicDispatchType` asks
  `getPropertyOfType(type, '__magicDispatch')`, which on a union only
  returns a property present in every constituent. Correct (the call could
  not be routed either way), but a caller of the optional-callback overload
  must narrow or cast before touching the result; the specs cast to
  `HigherOrderTapProxy<T>` and read `.target`.
- Mid-session the harness reported `HigherOrderTapProxy.ts` "changed on
  disk" with a diff showing `public target: T & Record<string, unknown>`;
  `git status` was clean and the file matched HEAD (`public target: T`).
  A stale notice, not a real change - worth knowing so the next agent does
  not "restore" a file that never moved.

**Proposed:**
- Translation-table rows: `is_null($x)` -> `x === undefined`; `null`
  (value) -> `undefined`; `trait Foo` -> see CONVENTIONS.md "Traits".
- SKILL.md §2.2: the `const _class = ...; return _class;` shape is only
  needed when something (`decoratePackedArgs`) must be attached; a trait
  with nothing to attach returns the class expression directly
  (`Tappable.ts`). Worth one sentence so the next port does not copy the
  temporary variable for no reason.
