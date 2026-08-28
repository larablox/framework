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
5. `node scripts/parity/run.mjs --component <X> --check` must end green: everything
   proposed (pending), approved, or excluded — nothing stale, nothing unreviewed left
   unexplained.
6. Commit per meaningful change (English message telling the story, not a list), push to
   the open PR branch.

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

**Formatting.** Mechanics are enforced (dprint: PSR-12 braces, quotes, width; eslint
expands array literals of 2+ elements). Argument-list line breaks and import order are
authored: copy upstream's breaks along with its names. `npm run format` and `npm run lint`
are CI gates.

**Comments.** Match upstream's comment density. Reasoning about a change goes in the commit
message and the approval note, not the code. Genuinely load-bearing platform notes go in
file-level docblocks. A file that mirrors upstream verbatim does not need a `PHP:` header;
a renamed file (`MemoryStoreQueue` ← `RedisQueue`) keeps it — it is the only in-file link
to upstream.

**Try/catch shape.** Match what is *inside* the protected region, not just that one exists.
`carry()`'s bug: `handleCarry` ran outside the pcall, so a throwing override (Routing's
`toResponse`) skipped `handleException`. Overridable hooks make this observable — check the
subclasses that override before calling shapes equivalent.

**Magic methods.** Not automatically impossible: `toString` compiles to `__tostring`,
facades replace `__callStatic` with metatables. Only claim impossibility for a specific
magic use after checking what the port already does elsewhere.

**Trait mixins.** No status catches a missing mixin — the `uses:` list appears only as a
note in files.csv, and a component can read green while the port class lacks a trait
upstream mixes in. Explicitly compare each file's `uses:` traits against the port class's
extends/mixin chain; a trait the port has already built elsewhere (`Conditionable` is
mixed into Stringable, Request and others) is a finding, not a waiver.

**Extra port-only members** inside a matched pair (`asList`, `callPipe`) have no waiver
mechanism — record the judgment about them in the notes of the upstream members whose
logic they carry, and in the session report.

## Proposal and approval rules

Review verdicts are two-stage. **Claude's review ends at `pending`**: `--propose "<key>"`
(or `--propose-file`) records the hashes and the judgment. **Promotion to `approved` is a
person's call** — the user runs `--approve` themselves after looking, or explicitly
instructs Claude to run it for named keys/files. Never promote on your own initiative, and
never treat a general "закончи ревью" as that instruction.

- Propose only after reading both bodies.
- **A dismissed difference must be written into the proposal's note** — an unrecorded
  judgment cannot be challenged, and unchallengeable judgments is how the closure-capture
  bug got through. Add notes by editing `scripts/parity/approvals.json` (the field is
  `note`); re-proposing keeps the existing entry's note and `proposed_at`.
- `n/a` members (properties, consts, bodiless methods) carry no approval; their parity is
  presence + visibility, already in the CSV.
- After a mechanical reformat that flips approvals stale: verify `php_hash` unchanged, then
  refresh `ts_hash` in place (keep notes) — no content re-review is owed for whitespace.
  A stale with a *changed* `php_hash` is an upstream change and gets a real re-review.

## Waivers and aliases

- Every waiver starts as `kind: "deferred"`. `impossible` is written per case, by hand,
  with the proof in its reason — never presumed. `port-only` marks the port's own
  additions.
- Deliberate renames go in `aliases.json`: file-level (`RedisQueue.php` →
  `MemoryStoreQueue.ts`), member-level with `@kind` for collisions
  (`delay@property` → `delaySeconds`). Underscore renames need no alias.
- A waived member's reason should say **what would reopen it** ("revisit if a database
  lands on DataStore"), not just what blocks it.
- `--exclude` accepts `key@kind` and pins the hash of that specific member. Properties
  have no body hash, so a property waiver never goes stale on upstream changes — pair it
  with the method's waiver when the two travel together.

## When a review finds a bug

Report the finding with the failure scenario before fixing (the user decides scope), unless
the session's instruction was to fix as you go. A fix follows the repo rules: regression
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
surface, adding dependencies, and anything that changes CLAUDE.md-documented behavior.
When a difference survives interrogation but the fix would be a scope jump, leave the
member unapproved with the finding recorded and surface it — an honest `unreviewed` beats
a hollow `approved`.
