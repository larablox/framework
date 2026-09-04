---
name: port-upstream
description: Port a Laravel PHP class/trait/interface (or a whole component directory) from .upstream/ into src/Illuminate/ as roblox-ts TypeScript, letter-for-letter, to 100% mirror fidelity per scripts/parity/check.mjs. Use whenever asked to port, mirror, bring over, or "add" an upstream Laravel file or directory to this framework.
argument-hint: '<PHP FQCN | path under .upstream | directory>'
---

# Port from upstream

Target: $ARGUMENTS

The bar is not "it works". The bar is **100% mirror fidelity for every member**,
as measured by `scripts/parity/check.mjs`, with every remaining divergence
written down in `CONVENTIONS.md` and folded into the checker. A port that
works but scores 94% is unfinished.

## 0. Before touching anything

1. Read `CONVENTIONS.md` in full. Every difference between the PHP and your
   TS is either already listed there or you add it there - there is no
   third option.
2. Read `.claude/skills/port-upstream/FEEDBACK.md`. Previous agents' entries
   are the freshest list of traps; the last one may describe exactly the
   construct you are about to hit.
3. Read the golden references end to end, source and spec:
   - `src/Illuminate/Support/HigherOrderWhenProxy.ts` (a class with magic
     `__get`/`__call`, a `protected` target, two view states) and
     `tests/Illuminate/Support/HigherOrderWhenProxy.spec.ts`
   - `src/Illuminate/Support/HigherOrderTapProxy.ts` (`__call` only, a
     `public` target, one view state) and
     `tests/Illuminate/Support/HigherOrderTapProxy.spec.ts` (also the
     reference for type-level assertions, §3.1)
   - `src/Illuminate/Support/Traits/Conditionable.ts` (a trait as a mixin,
     overloads, `func_num_args()`) and
     `tests/Illuminate/Support/Traits/Conditionable.spec.ts`
   Match their layout, brace style, docblock style, naming - exactly.
4. Ground rules that are not negotiable:
   - Everything in English: code, identifiers, comments, commit messages.
   - Prose dashes are a single `-`, never `--` or `—` (`--` in a `.luau`
     file is Lua's comment marker and stays).
   - No `any` in `src/`. The only two exceptions are already documented in
     `CONVENTIONS.md` (the mixin `AnyConstructor` and a packed-args
     implementation signature). If you think you need a third, you are
     missing a type-level solution - see §3.
   - Do not DRY, simplify, reorder, rename, or "improve" upstream. If
     `when()` and `unless()` are near-duplicates in PHP, they are
     near-duplicates in TS. Duplication that mirrors upstream is correct.
   - Do not add members the PHP class doesn't have (helper getters,
     private methods, extra fields). Every extra member costs fidelity and
     is a divergence to justify. Solve typing problems with types, not
     runtime code (§3).
   - Verify empirically. Never report "compiles"/"passes"/"100%" you did
     not observe in a command's output in this session.

## 1. Locate and map

**Find the PHP.** `.upstream/` is a `composer install` of the
`laravel/framework` package only - there are no PHPUnit tests in it.

```bash
find .upstream/vendor/laravel/framework/src -name 'Name.php'
```

**Derive the TS path from the namespace, not the physical path.** The
checker computes the FQCN from the TS file's path under `src/`
(`src/Illuminate/Support/Foo.ts` -> `Illuminate\Support\Foo`) and resolves
it through Composer's autoloader, so the TS file must sit where the PHP
`namespace` line says, even when the PHP file physically lives elsewhere:

| PHP file (physical)                                | `namespace`                      | TS file                                             |
|----------------------------------------------------|----------------------------------|-----------------------------------------------------|
| `Illuminate/Conditionable/HigherOrderWhenProxy.php` | `Illuminate\Support`             | `src/Illuminate/Support/HigherOrderWhenProxy.ts`     |
| `Illuminate/Conditionable/Traits/Conditionable.php` | `Illuminate\Support\Traits`      | `src/Illuminate/Support/Traits/Conditionable.ts`     |

Get this wrong and `check.mjs` reports "Could not autoload" instead of a
score.

**For a directory:** list every `.php` in it, read each file's `use`
imports, and port in dependency order - leaves first (e.g.
`HigherOrderWhenProxy` before `Conditionable`). A dependency that lives
outside the requested directory:
- small (a helper, a proxy, an interface): port it as part of this task
  and say so in your report;
- large (its own subsystem, hundreds of lines) or one that forces a new
  data-model decision (PHP arrays, exceptions, enums - see §2.4): stop and
  report before expanding scope.

**Check the kind of declaration.** `class`, `trait`, and a class with
`__get`/`__call` have established conventions (§2). `interface`, `abstract
class`, `enum`, class constants, static properties, exceptions do not yet -
see §2.4 before inventing one.

## 2. Write the port

### 2.1 Mechanical translation

Same member order as the PHP. Same names (modulo the underscore rule).
Same control flow, same variable names, same blank lines and statement
grouping inside bodies. Allman braces for class/method/function bodies
(brace on its own line), same-line braces for `if`/`else`/loops - exactly
as PSR-12 upstream does. 4-space indent.

| PHP                                          | TS                                                      | Note |
|----------------------------------------------|---------------------------------------------------------|------|
| `namespace X;` / `use Y;`                    | `import { Y } from 'Illuminate/.../Y';`                 | `baseUrl` is `src/`; import path = namespace path. `use Closure;` needs no import. |
| `class Foo`                                  | `export class Foo`                                      | |
| `trait Foo`                                  | mixin factory - see §2.2                                | |
| `public function __construct($x)`            | `public constructor(x: T)`                              | |
| `public`/`protected`/`private`               | keep the same keyword                                   | |
| `protected $target;` (uninitialized)         | `protected target?: T;` or `protected target: T;` if the ctor always sets it | a bare `?` is invisible to the checker |
| `protected $flag = false;`                   | `protected flag = false;`                               | |
| type hints (`callable $cb`, `?string`, `mixed`, `ReflectionParameter $p`) | TS annotation; never a runtime check | all type syntax is stripped before comparing |
| `$cb = null` parameter default               | `cb?: T` - no default written                           | "nullable-default" in CONVENTIONS.md |
| `$this->x` / `X::y` / `self::y`              | `this.x` / `X.y`                                        | both spell as `.` |
| `$this->target->{$key}`                      | `this.target[key]`                                      | see §2.3 for the call form |
| `elseif`                                     | `else if`                                               | |
| `(new X($a))->m()`                           | `new X(a).m()`                                          | outer parens dropped |
| `$x instanceof Closure`                      | `typeIs(x, 'function')`                                 | |
| `if ($x)` / `$x ? a : b` / `! $x` (PHP truthiness) | `if (truthy(x))` / `truthy(x) ? a : b` / `!truthy(x)` | `truthy` from `Illuminate/Support/helpers`; scalar cases only - an empty table is truthy, unlike PHP |
| `$a ?? $b`                                   | `a ?? b`                                                | |
| `$cb($this, $v)` on a callable param         | `cb!(this, v)`                                          | `!` is stripped |
| `return $this;`                              | `return this;` with return type `this`                  | |
| `func_num_args()`                            | `func_num_args(_args)` + `decoratePackedArgs(cls, 'm')` | full story in CONVENTIONS.md; `scripts/lint/check-packed-args.mjs` enforces the wiring on every build |
| `"{$x}"`                                     | `` `${x}` ``                                            | canonicalize the same |
| `__call`                                     | `___call` (three underscores)                           | Luau metamethod collision |
| `__get`                                      | `__get` (unchanged)                                     | |
| name collides with a TS/Luau reserved word   | leading `_`: `$default` -> `_default`                   | |
| property and method share a name             | property gets `_`: `$condition` -> `_condition`, `condition()` stays | |

Docblocks: keep the summary sentence as a one-line `/** ... */` on the
member; drop `@param`/`@var`/`@return` (types live in the signature).

```php
/**
 * The target being conditionally operated on.
 *
 * @var mixed
 */
protected $target;
```
```ts
/** The target being conditionally operated on. */
protected target: T;
```

Overload signatures are free: the checker skips bodiless signatures and
compares only the implementation, so use overloads generously to give
callers real types (see `when()`'s five overloads).

### 2.2 A trait is a mixin factory

```ts
// TS2545: a mixin base's constructor must accept a single `any[]` rest parameter.
type AnyConstructor<T = object> = new (...args: any[]) => T;

export function Conditionable<TBase extends AnyConstructor>(Base: TBase)
{
    const _class = class extends Base
    {
        // members, exactly as the PHP trait declares them
    };

    // Not a decorator: `_class` is a class *expression*, and TypeScript's
    // legacy decorators cannot target a method inside one.
    decoratePackedArgs(_class, 'when');

    return _class;
}
```

The checker finds the class expression the factory returns and treats it
as "the class". Anything you must attach after construction
(`decoratePackedArgs`) goes between the expression and the `return`.

### 2.3 Magic dispatch (`__get`/`__call`)

Follow `HigherOrderWhenProxy.ts` exactly; `HigherOrderTapProxy.ts` is the
reference for the two places a proxy can legitimately differ from it (a
`public` target, a one-state view):
- literal `__get(key: string): unknown` and `___call(method: string,
  parameters: unknown[]): unknown` methods;
- a target field that is `protected`/`private` in the PHP is typed
  `T & Record<string, unknown>` and cast **once, in the constructor** -
  then `this.target[key]` needs no cast anywhere else. A field that is
  `public` in the PHP keeps its declared type `T`: on a public field the
  intersection leaks into the API, and `proxy.target = new Subject()`
  against `public target: T & Record<string, unknown>` fails with
  `TS2322: Type 'Subject' is not assignable to type 'Subject &
  Record<string, unknown>'` (scratch probe, FEEDBACK.md). Cast at the
  single use site instead:
  `((this.target as T & Record<string, unknown>)[method] as Callable)(this.target, ...parameters)`.
  Type assertions are stripped by the checker, so this costs no fidelity.
  `HigherOrderWhenProxy` (`protected`) and `HigherOrderTapProxy` (`public`)
  are the two references;
- a dynamically-named call must re-pass its receiver:
  `(this.target[method] as Callable)(this.target, ...parameters)`. Luau's
  `:` self-call syntax needs a literal method name, so `obj[name](...)`
  compiles to a plain call with no `self`. `Callable` is in
  `Illuminate/Support/types`. The checker already folds this;
- export `MagicDispatch<...>` view types for the proxy's callers so
  `scripts/build/transform-magic-dispatch.mjs` can rewrite `.foo`/`.foo()`
  on them into `__get`/`___call` calls. Name them by how many states the
  proxy has: two states export `Pending<Class><T>` and `Resolved<Class><T>`
  (`PendingHigherOrderWhenProxy`, `ResolvedHigherOrderWhenProxy`); one
  state exports `<Class>View<T>` (`HigherOrderTapProxyView`). A view for a
  proxy that has `___call` but no `__get` keeps only function-typed members
  (the `as` clause on `HigherOrderTapProxyView`'s mapped type), so a bare
  property read has nothing to route to and is left out of the view rather
  than rewritten into a `__get` that does not exist.

Do **not** widen the class's generic constraint to `Record<string,
unknown>` to avoid the cast - class instances have no index signature and
every caller stops compiling.

### 2.4 Constructs with no convention yet

`interface`, `abstract`, `enum`, class `const`, `static` properties,
exceptions/`throw`, closures with `use (...)`, `fn() =>`, `match`, `?->`,
`yield`, `&$ref`, `parent::`, `static::`, `list()`, and above all **PHP
arrays** (ordered maps that are also lists) have not been ported yet, so
nothing in `CONVENTIONS.md` or the checker covers them.

For a syntactic construct: choose the most literal TS spelling, run the
checker, and if the residue is a spelling difference the platform forces,
go through §3 to add the fold + test + `CONVENTIONS.md` entry. Record the
decision in FEEDBACK so this table grows a row.

For a **data-model** decision (arrays, exceptions, enums): stop and report
before choosing a representation. It will ripple through every later port
and is not yours to make inside one file.

## 3. Reach 100%

```bash
node scripts/parity/check.mjs src/Illuminate/X/Y.ts            # per-member scores
node scripts/parity/check.mjs src/Illuminate/X/Y.ts --show=m   # residue for member m
```

Never reason from the percentage alone. `--show=<member>` prints the
tokens present on only one side, aligned:

```
--- residue for __call ---
  ts : this . target ,
  ts : this . target ,
```

`php:` lines are tokens only the PHP has; `ts :` lines only the TS has.
Read them and classify every run:

1. **A porting mistake** (wrong name, missing statement, reordered code,
   an extra member): fix the TS.
2. **An accepted convention the checker doesn't fold yet** (it is in
   `CONVENTIONS.md`, but shows as residue): add a pass to
   `scripts/parity/canonicalize.mjs` in the existing fold style, a case in
   `scripts/parity/canonicalize.test.mjs`, and re-run.
3. **A divergence the platform genuinely forces**: prove it before
   documenting it - compile a scratch probe (for a typing claim, §3.1), or
   read the emitted `out/Illuminate/.../Y.luau` and point at the exact
   line. Then, in this order: the `CONVENTIONS.md` entry (what, why,
   evidence), the fold in `canonicalize.mjs`, its unit test. A divergence
   without all three is not done.

Prefer type-level fixes. `as`, `!`, `: Type`, `<T>`, `?` are all stripped
before comparison, so they never cost fidelity; a runtime helper, wrapper
method, or extra field always does. When a typing problem tempts you to
add code, ask first whether a cast at the point of *storage* (the field,
the constructor) removes the need for casts at every point of *use* - that
is how `HigherOrderWhenProxy` lost all of its body-level `as`.

Then run the whole tree - other files must still score what they scored:

```bash
npm run parity          # writes reports/parity/all.csv, prints every member below 100%
```

### 3.1 Type-level checks

A typing claim is proven the way a fidelity claim is - from a command's
output, not from reading the types:

- **Positive** ("this compiles, with these types"): only `npm run build`
  and `npm test`. Both run `rbxtsc` over the `.magic-dispatch/` shadow
  tree, which is the only place the rewritten `__get`/`___call` calls
  exist to be checked at all.
- **Negative** ("this must *not* compile"): NOT `// @ts-expect-error` -
  roblox-ts refuses the directive outright, used or unused (`error TS
  roblox-ts: Usage of @ts-ignore, @ts-expect-error, and @ts-nocheck are not
  supported! roblox-ts needs type and symbol info to compile correctly.`),
  and it only surfaces in `npm test`'s `test:build`, not in `npm run
  build`. Write the negative claim as a type-level assertion the spec
  *positively* compiles instead - a `const` whose annotation collapses to
  `false` the moment the claim stops holding:

  ```ts
  type Same<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false;

  const targetIsExactlySubject: Same<HigherOrderTapProxy<Subject>['target'], Subject> = true;
  const stringIsRejected: string extends HigherOrderTapProxy<Subject>['target'] ? false : true = true;
  ```

  (`HigherOrderTapProxy.spec.ts` is the reference.) Prove it live once,
  in both directions: break the source so the claim is false, watch
  `npm test` fail on exactly that line, restore. A typed `const` fed by a
  rewritten magic call (`const name: string = view.rename('x')`) is the
  same idea for "the result is typed, not `unknown`".
- Never run bare `npx tsc` over `src/`. `tsconfig.json` is `noLib` with
  `@rbxts` typings, and outside `rbxtsc` that reports a dozen errors
  unrelated to anything you changed (`Global type 'Iterable' must have 3
  type parameter(s)`, `Cannot find name 'CustomMatchers'`); a
  "compiles"/"fails" read off that output means nothing. If a scratch
  probe is unavoidable, filter the output on the probe's own path, and
  first inject a deliberate error into the probe to prove it is being
  checked at all - a probe that never made it into the program passes
  silently.

## 4. Tests

Specs live at `tests/Illuminate/<same path>/<Name>.spec.ts`, TestEZ style,
and are discovered automatically (any `*.spec.luau` under `out-tests/`):

```ts
import { Name } from 'Illuminate/.../Name';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `NameTest.php` here to port literally. These cases are reconstructed
// from Name's own behavior, covering the scenarios upstream's real test
// suite is known to name: ...

export = (): void => {
    describe('Name', () => {
        it('does the thing', () => {
            expect(result).to.equal(expected);
        });
    });
};
```

Keep that header honest: say which upstream test names the cases mirror
and which are reconstructed. Cover every branch the PHP has (both `if`
arms, the 0/1/n-argument forms, closures vs plain values, truthy vs falsy
edges the `truthy()` helper is meant to replicate).

Three things about the harness that are not obvious from the template:
- `npm run build` never compiles `tests/`; a spec is type-checked and run
  only by `npm test`. A spec that "builds" has not been checked yet.
- `expect(x).to.equal(y)` is Luau `==` - reference equality for tables. To
  assert what a method was called with, record calls as strings (`'activate:x'`)
  and compare those, not arrays or objects; see the `calls` log in the
  existing specs.
- A magic proxy is single-use by design (one capture hop, then one resolve
  hop, mirroring PHP). Build a fresh proxy per chain in a test; reusing one
  makes the second chain's first access a *resolve* and the failure
  (`attempt to index boolean with '__get'`) looks like a transform bug.

## 5. Finish

```bash
npm run build     # includes scripts/lint/check-packed-args.mjs
npm test          # parity unit tests + TestEZ under Lune (needs `lune` on PATH)
npm run parity    # every member across src/ - must be 100, no unmatched files
git status        # only the files you meant to touch
```

`npm run build` is the only correct compile check. `rbxtsc --noEmit` is not
a flag: it prints "Unknown argument" and exits without type-checking
anything, and `| grep -i error` hides that line. Read the real output.

Do not commit unless asked. If asked: English, one concise subject line
plus short bullets, no `Co-Authored-By` trailer.

## 6. Mandatory feedback

This is part of the task, not an afterthought. Before your final message,
append an entry to `.claude/skills/port-upstream/FEEDBACK.md` using the
template at the top of that file, then summarize it in 3-5 lines in your
final message. "Nothing to report" is acceptable only as an explicit
statement of what you verified went smoothly.

What goes where:
- **Applied directly, by you, as part of the port** (and listed under
  *Applied* in your entry): anything the port *required* to reach 100% -
  a `CONVENTIONS.md` entry, a `canonicalize.mjs` fold with its test, a fix
  to a factually wrong command or path in this skill.
- **Shared infrastructure counts as applied only with a test.** A change
  to `scripts/build/transform-magic-dispatch.mjs`,
  `src/Illuminate/Support/MagicDispatch.ts`, anything under
  `scripts/parity/`, or `src/Illuminate/Support/TableArgs.*` is *Applied*
  only if the same change carries an automated test: a `node:test` file
  (`*.test.mjs`) beside the script under `scripts/` for build/parity
  tooling - and check that `npm run test:parity`'s glob in `package.json`
  actually reaches it - or a spec under `tests/` for runtime or type
  behavior (§3.1). Without the test it is not applied: stop, report, and
  list it under *Proposed*. Every port compiles through these files, so a
  bug in one is a bug in every port: the `unknown`-typed magic-call result
  (FEEDBACK.md, second entry) lived in the transform undetected because
  nothing tested the transform, and was caught only because a tap proxy's
  whole purpose is handing back a typed result.
- **Proposed, for the maintainer** (under *Proposed*): changes to this
  skill's workflow or wording, new translation-table rows, tooling ideas,
  anything you were unsure about. One line of rationale each.
- **Flow friction** (under *Friction*): every command that did not do what
  this skill said it would, every checker residue you could not classify
  at first read, every place you had to guess. Include the exact command
  and output. This section is the whole point - the next agent should not
  rediscover it.

## Definition of done

- [ ] TS file at the namespace-derived path; spec at the mirrored path under `tests/`
- [ ] Every PHP member present, same order, same names modulo `CONVENTIONS.md` renames; no extra members
- [ ] `check.mjs` reports 100 for every member; no unmatched (blank) rows
- [ ] `npm run parity` clean across the whole tree
- [ ] Every new divergence has all three: `CONVENTIONS.md` entry, `canonicalize.mjs` fold, unit test
- [ ] Every change to shared infrastructure (`transform-magic-dispatch.mjs`, `MagicDispatch.ts`, `scripts/parity/`, `TableArgs.*`) ships with its automated test, or is listed under *Proposed* instead of applied
- [ ] No new `any`; prose dashes are `-`
- [ ] `npm run build` and `npm test` green, output actually read
- [ ] FEEDBACK.md entry appended; summary in the final message

## Known traps (each one cost a real session time)

- `rbxtsc --noEmit -p .` does nothing and reports nothing useful. Use
  `npm run build`. Filtering build output through `grep` can hide the
  failure line entirely.
- Bare `npx tsc` over `src/` is noise, not a check: `tsconfig.json` is
  `noLib` with `@rbxts` typings and reports a dozen unrelated errors
  (`Global type 'Iterable' must have 3 type parameter(s)`, `Cannot find
  name 'CustomMatchers'`). Prove types with `npm run build`/`npm test` and
  a `Same<A, B> = true` assertion in the spec (§3.1).
- `// @ts-expect-error` (and `@ts-ignore`, `@ts-nocheck`) is rejected by
  roblox-ts as a whole, used or not - it cannot be a negative type check
  anywhere under `src/` or `tests/`. It only fails in `npm test`, because
  `npm run build` never compiles `tests/` at all.
- Luau `:` calls need a literal name. `obj[name](...)` drops `self`; pass
  the receiver explicitly (already folded by the checker).
- `T extends Record<string, unknown>` as a generic constraint breaks every
  caller (`this` has no index signature). Keep `T extends object`, cast
  the field once.
- `public target: T & Record<string, unknown>` leaks the intersection into
  the API: `proxy.target = new Subject()` fails with `TS2322: Type
  'Subject' is not assignable to type 'Subject & Record<string, unknown>'`.
  Only a `protected`/`private` field takes the cast-once type; a `public`
  one stays `T` and casts at its one use site (§2.3).
- `as unknown as X` is only needed when `X` and the source don't overlap;
  `x as T & Record<string, unknown>` is a single legal cast because the
  intersection is assignable to `T`.
- A comment never affects fidelity (the tokenizer drops comments), so
  fixing a low score by editing comments is a sign you're looking in the
  wrong place.
- The checker only exercises rules that current ports actually hit. A fold
  can silently break without a unit test - that's why every fold has one
  in `canonicalize.test.mjs`. Add yours.
- Reflowed prose wraps `--` onto a line start or end; a `s/ -- / - /`
  pass misses those. Grep `^--` and `--$` too, but not in `.luau` files.
