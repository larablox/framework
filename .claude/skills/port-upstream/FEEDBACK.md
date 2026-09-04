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
  covers enough files to feel slow. Not worth it at three.
- A fold in `canonicalize.mjs` whose rule no current port hits is invisible
  to `npm run parity`; an automated check that every pass has a case in
  `canonicalize.test.mjs` would keep the "every fold has a test" rule from
  drifting. Held by review discipline for now.
