---
name: parity-review
description: Run a Laravel-parity review session for a component of src/Illuminate — compare every method against the pinned laravel/framework upstream, interrogate every visible difference, fix what can be mirrored, waive what cannot, and approve implementations in the parity registry. Use this whenever the user asks to review a component ("ревью Config", "проверь паритет Queue", "сверь с апстримом"), to approve or re-approve parity methods, to handle stale approvals after an edit or a Laravel bump, or to decide whether a divergence from Laravel is acceptable. Also use it when porting new Laravel code, so the port lands at the etalon bar from the start.
---

# Laravel-parity review

The goal of a review session is not "does the port behave like upstream given the port's
conventions" — it is **minimal distance to upstream**. An approval asserts that every
difference visible in a side-by-side diff is either eliminated or *proven* forced, with the
proof written down. "Documented divergence" is a hypothesis to re-test, never an answer by
itself: most of the port's original "platform-forced" divergences fell when interrogated
(erased interfaces → `Contract<T>` tokens, no reflection → `@Inject`, marker interfaces →
validating decorators, `func_get_args` → rest parameters, formatter limits → a different
formatter).

The etalon is `src/Illuminate/Pipeline/PipelineServiceProvider.ts` next to its upstream
twin — format, naming, directives, keys and bodies all line up. Every reviewed file should
end up that close, or carry a note proving why it cannot.

## Session mechanics

The tool is `npm run parity` (`scripts/parity/run.mjs`); registries live next to it and are
committed. `reports/parity/` is generated output. CLAUDE.md's "Parity tooling" section is
the shorter reference.

Work one component at a time:

1. `node scripts/parity/run.mjs --list unreviewed --component <X>` — the queue.
2. For each pair of files, read **both files whole** (upstream lives under
   `.upstream/vendor/laravel/framework/src/Illuminate/`), not just the flagged members —
   member-level `--show "<path>#<Decl>#<member>"` is for spot checks and re-reviews (it
   prints the recorded review note and waiver under the bodies; `members.csv` carries the
   note in its `note` column).
3. Interrogate every difference (checklist below). Fix, waive, or propose with a note.
4. After any `src/` edit: `npm run analyze`, `npm test`, `npm run lint`, `npm run format`.
5. `node scripts/parity/run.mjs --component <X> --check` must end green, and every member
   must hold a verdict: `pending`, `decision`, `rejected`, `approved` or excluded —
   nothing stale, nothing left `unreviewed`.
6. Commit per meaningful change (English message telling the story, not a list). Do not
   push after every commit — push only when the user asks, or at a milestone they name.

Approvals pin body hashes of **both** sides; editing the port or bumping Laravel flips them
to stale. That is the design, not a failure: approvals are checkpoints, and reworking an
approved method is the normal path when a shorter distance to upstream is found.

## The interrogation checklist

For every difference the diff shows, ask "is this forced, or inherited?" These are the
classes of difference that looked forced and were not — check each before accepting:

**Closures: captured variable vs call parameter.** Never cosmetic in container code.
Upstream's `fn ($app) =>` receives the *resolving* container; a captured `this.app` is the
*registering* one. With per-request sandboxes (`Foundation/Runtime/Worker.ts`) the two
differ, and a captured root leaks request isolation. The port's `ContainerClosure` passes
the resolving container as the first argument — use it.

**Binding keys.** An interface name as a key is expressible: a `Contract<T>` token declared
next to the interface (`Container/Contract.ts`; see `HubContract`, `ContainerContract`).
Class-as-key is the fallback, not the ceiling. A contract that PHP aliases into the core
alias table belongs there too (`registerCoreContainerAliases`).

**Class-as-concrete.** `singleton(Contract::class, Impl::class)` is expressible: declare
the constructor dependency with `@Inject(...)` — the port's spelling of a PHP type hint —
and pass the class itself. A hand-written closure standing in for reflection is a longer
distance than the documented `@Inject` convention.

**Erased marker interfaces.** `instanceof SomeMarker` maps to a validating class decorator
in the `ShouldQueue` genre (see `@DeferrableProvider()`, which refuses a class that does
not declare its own `provides()` — restoring the guarantee PHP got from the interface).
Before inventing detection heuristics, check whether a decorator can carry the mark and
validate the obligation at load time.

**Naming.** Reproduce upstream literally, including *import aliases*
(`import { HubContract as PipelineHubContract }` mirrors `use Hub as PipelineHubContract`).
Where TS cannot use a PHP name as-is — reserved word, or PHP's property/method name
collision (`$pipes` beside `pipes()`) — the convention is a leading underscore (`_pipes`,
`_finally`, `_with`); the comparator matches `_x` to `x` automatically, no alias needed.
Never invent a descriptive name where a minimal-distance name exists.

**Statement shape.** Upstream's control-flow spelling is part of the letter: an if/else
stays an if/else (not a ternary), a single return stays single, a `function` closure stays
a function expression unless it touches `$this` (then the arrow is forced by lexical
binding). Before writing any shape upstream does not have, exhaust the mirrored encodings
— and when only a non-mirror encoding remains, propose it to the user first instead of
committing it. Port-added guards are shape too: a condition upstream does not test (the
`typeIs string ||` that once sat in front of the `is_object` check) must be individually
owed, or dropped.

**Impossibility is proven by the toolchain, not by reasoning.** Every "cannot be spelled"
verdict in a note must cite evidence produced in-session: the compiler error from actually
trying the encoding, or a grep of the actual API (`reduce` exists in
`@rbxts/compiler-types`, `reverse` does not). Type-system intuition here has been wrong in
both directions — "no variadic form" fell to a rest parameter, and a cast dismissed as
illegal compiled fine the moment it was tried. When the user offers a counter-encoding,
compile it before judging it.

**Formatting.** Mechanics are enforced (dprint: PSR-12 braces, quotes, width; eslint
expands array literals of 2+ elements). Argument-list line breaks and import order are
authored: copy upstream's breaks along with its names. `npm run format` and `npm run lint`
are CI gates.

**Comments.** Match upstream's comment density. Reasoning about a change goes in the commit
message and the approval note, not the code. Genuinely load-bearing platform notes go in
file-level docblocks. A file that mirrors upstream verbatim does not need a `PHP:` header;
a renamed file (`MemoryStoreQueue` ← `RedisQueue`) keeps it — it is the only in-file link
to upstream. Method docblocks never narrate the port ("PHP does X, here we do Y") — the
framework's consumer does not care; a compensation helper gets a one-line summary plus at
most one sentence of behavioral fact, and the porting rationale lives in the note.

**Try/catch shape.** Match what is *inside* the protected region, not just that one exists.
`carry()`'s bug: `handleCarry` ran outside the pcall, so a throwing override (Routing's
`toResponse`) skipped `handleException`. Overridable hooks make this observable — check the
subclasses that override before calling shapes equivalent.

**Magic methods.** Not automatically impossible: `toString` compiles to `__tostring`,
facades replace `__callStatic` with metatables. Only claim impossibility for a specific
magic use after checking what the port already does elsewhere.

**Trait mixins.** Every `uses:` trait is a `kind: trait` row in members.csv — `both` when
mixed in, `missing_mixin` when absent (also flagged `[missing mixin: X]` in the file's
note), `excluded/deferred` when waived with a reason in `exclusions.json`'s `traits`
section (e.g. Macroable). Treat the flag
as a finding: a trait the port has already built elsewhere (`Conditionable` is mixed into
Stringable, Request and others) is work, not a waiver.

**Extra port-only members** inside a matched pair (`isPipeInstance`, the port's
`is_object`) have no waiver mechanism — record the judgment about them in the notes of the
upstream members whose logic they carry, and in the session report. An extra member is
also where divergence *hides*: `callPipe`, split out of `carry()`, quietly fed
closure-pipe results through `handleCarry` that upstream's early return bypasses, and
threw a port-invented RuntimeException where upstream falls back to an invokable call.
Dissolve the split back into the upstream body first; judge only what refuses to dissolve.

**Language compensations** are the sanctioned way to close a builtin-shaped gap: helpers
standing in for what PHP gets from the language, user-approved, never inventing Laravel
API a PHP developer would expect upstream. The kit so far: `Arr.reverse`/`Arr.pad`/
`Arr.merge` for the array builtins, `Str.explode` for `explode` (with PHP's limit
semantics), `Pipeline/helpers`' `call`/`callMethod`/`methodExists`/`isCallable` for
PHP's dynamic calls and capability checks, and `Container/Util`'s `truthy`/`elvis` for
PHP truthiness and the `?:` operator. Check this kit before spelling a builtin as a
loop, and extend it (with the user's approval) rather than casting at the site — a call
site needing the same type assertion more than once is the smell of a missing
compensation.

## Proposal and approval rules

A review verdict is one of three registry states, and the split is what makes the user's
pass fast — `pending` is trusted, the other two are flagged:

- **`pending` (`--propose`) is the agent's approval of a *perfect* mirror.** The user
  intends to promote pendings with a glance, eventually automatically — so propose ONLY
  what needs no human judgment: the diff shows nothing beyond enforced mechanics
  (dprint/eslint) and the standing conventions, which live machine-readably in
  `scripts/parity/conventions.json` (renames the verifier folds away, structural rules
  it cannot). The note opens with a one-or-two-word verdict tag — `Verbatim.` for
  letter-for-letter, `Mirrored.` for statement-for-statement through the conventions —
  with at most one short sentence naming which conventions, so the tag is scannable in
  `--list`/`members.csv`. **Run `--verify "<key>"` before tagging**: it diffs the
  normalized token streams — an empty residue is `Verbatim.`; a residue where every run
  matches a `structural` rule from conventions.json is `Mirrored.` (name the rules); any
  other residue means the member is not pending material.
- **`decision` (`--decision`) is a divergence awaiting the user's call.** Anything the
  conventions do not already cover — a surviving dismissal, an encoding with several
  defensible spellings, a scope-jump fix — goes here, never into `pending`. The note
  opens with `DECISION:` and states the question and the options.
- **`rejected` (`--reject`) is a review that found the port wrong** — behavior diverges
  and the port is the side that must change. The note opens with `REJECTED:` and the
  failure scenario. This replaces leaving a member `unreviewed` with the finding only in
  the session report: the problem is visible in the summary's Rejected column at a
  glance.

**Promotion to `approved` is a person's call** — the user runs `--approve` themselves, or
explicitly instructs Claude to run it for named keys/files. `--approve` resolves any of
the three states. Never promote on your own initiative, and never treat a general
"закончи ревью" as that instruction.

- Record a verdict only after reading both bodies.
- **A dismissed difference must be written into the proposal's note** — an unrecorded
  judgment cannot be challenged, and unchallengeable judgments is how the closure-capture
  bug got through. Add notes by editing `scripts/parity/approvals.json` (the field is
  `note`); re-proposing keeps the existing entry's note and `proposed_at`.
- Properties and consts are reviewable like methods: both extractors hash the
  *declaration* (modifiers, type, name, default), so a proposal goes stale when either
  side's declaration changes. Their registry keys carry an `@kind` suffix
  (`...#pipes@property`) so a property lives beside its same-named method; methods keep
  kindless keys. Extra port-only members are reviewable too — the entry records
  `php_hash: null` and stales on port edits. `n/a` remains only for what has no content
  to hash (bodiless signatures, enum cases).
- After a mechanical reformat that flips approvals stale: `--refresh-cosmetic` refreshes
  `ts_hash` in place for every stale whose `php_hash` still matches (notes and status
  kept) — no content re-review is owed for whitespace, but the judgment that the edit
  *was* cosmetic stays with whoever runs it. A stale with a *changed* `php_hash` is an
  upstream change and gets a real re-review.
- `--approve-pending [--component X]` promotes the whole pending queue in one pass — the
  user's command (or Claude's on their explicit instruction), same rule as `--approve`.

## Waivers and aliases

- Every waiver starts as `kind: "deferred"`. `impossible` is written per case, by hand,
  with the proof in its reason — never presumed. `port-only` marks the port's own
  additions.
- Deliberate renames go in `aliases.json`: file-level (`RedisQueue.php` →
  `MemoryStoreQueue.ts`), member-level with `@kind` for collisions
  (`delay@property` → `delaySeconds`). Underscore renames need no alias.
- A waived member's reason should say **what would reopen it** ("revisit if a database
  lands on DataStore"), not just what blocks it.
- A `deferred` waiver whose absence is *visible inside a ported body* (an omitted branch,
  a skipped argument) also gets a `@deferred` docblock at the exact site, naming the
  registry as the tracker, with the verbatim future code in an `@example` fence written
  against the conventions it will land under (see `then()`'s withinTransaction block) —
  `grep '@deferred' src` is the map of what upstream still owes the port. Body hashes
  strip comments, so the marker never stales an approval.
- `--exclude` accepts `key@kind` and pins the hash of that specific member. Properties
  have no body hash, so a property waiver never goes stale on upstream changes — pair it
  with the method's waiver when the two travel together.

## When a review finds a bug

Record it as `rejected` with the failure scenario in the note, and report it before
fixing (the user decides scope), unless the session's instruction was to fix as you go. A fix follows the repo rules: regression
spec where the suite's conventions allow one (several spec files pin "don't invent cases
absent from the PHP reference" — respect the file's own header), `npm run analyze` and a
read of the emitted Luau, full suite, then re-propose the stales the fix caused (a
promoted `approved` that went stale returns to the human for promotion again).

## What to ask the user vs decide

Decide yourself: proposing, mechanical hash refreshes after verified-cosmetic changes,
notes, waiver reasons, fixing clear bugs found in review when asked to review-and-fix.

Approving is never yours to decide: `--approve`/`--approve-file` run only on the user's
explicit, named instruction.

Ask first: introducing a new convention (a new token, decorator, or naming pattern —
these ripple), reclassifying a waiver to `impossible`, renaming anything on the public
surface, adding dependencies, anything that changes CLAUDE.md-documented behavior, and
any cleanup or encoding with more than one defensible spelling — write the variants into
the chat and let the user pick (the `_parameters` compromise and the `call()` helper were
both chosen that way, and the user's counter-proposals have repeatedly beaten the first
draft).
When a difference survives interrogation but the fix would be a scope jump, record it as
`decision` (or `rejected` when the port is wrong) with the finding in the note, and
surface it — an honest flag beats a hollow `pending`.
