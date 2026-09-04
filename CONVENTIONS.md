# Porting conventions

Rules for carrying Laravel's PHP into this port's TypeScript. The port is
letter-for-letter - same constructs, same variable names - and diverges
only where TypeScript/roblox-ts/Luau genuinely forces it.

## Naming

- **Reserved word**: a PHP identifier that collides with a TS/Luau reserved
  word gets a leading underscore - `_x` spells PHP's `x`. E.g. a PHP
  parameter named `$default` becomes `_default` (`default` is reserved in
  TypeScript).

- **Property/method collision**: PHP allows a property and a method to
  share a name; a TS class can't. The property takes the leading
  underscore, the method keeps the bare name. E.g. PHP's `$value` property
  and `value()` method become `_value` (property) and `value()` (method).

- **`__call` as a member name**: rejected by roblox-ts - it's a real Luau
  metamethod (makes an *instance itself* callable, `instance(...)`),
  unrelated to PHP's `__call` (dispatch on an unknown *method name*,
  `$obj->foo()`). Takes one more leading underscore than PHP's own two:
  `___call`. `__get` has no such collision and keeps its literal name.

## Traits

A PHP `trait` has no TS counterpart - a class can `extends` exactly one
thing, and there is no way to splice a second set of members into it. A
trait is ported as a mixin factory instead: a function taking a base
constructor and returning a class *expression* that extends it, declaring
the trait's members exactly as the PHP does
(`export function Conditionable<TBase extends AnyConstructor>(Base: TBase)
{ return class extends Base { ... }; }`). The consumer spells `use Foo;` as
`class X extends Foo(Base) {}` (or `Foo(class { ... })` when there is no
base of its own). The parity checker treats the returned class expression
as "the class".

The factory's constraint is one of the port's two accepted uses of `any`:
`type AnyConstructor<T = object> = new (...args: any[]) => T;`. TypeScript
requires it literally - a mixin whose base type is constrained to `new
(...args: unknown[]) => T` is refused with `TS2545: A mixin class must have
a constructor with a single rest parameter of type 'any[]'` (confirmed with
a scratch probe through `npm run build`). The alias lives once, in
`Larablox/types.ts` next to `Callable`, and every trait imports it from
there. This section is where the `any` is justified; a trait file does not
restate it.

## `null`

roblox-ts has no `null` at all: `TS roblox-ts: \`null\` is not supported!
Suggestion: Use \`undefined\` instead.` (confirmed with a scratch probe through
`npm run build`). PHP's `null` is `undefined` throughout the port - a `= null`
parameter default is an omitted `?` parameter with no default written
("nullable-default", see `canonicalize.mjs`), a `return null` is `return
undefined`, and `is_null($x)` is `x === undefined` (`tap()` in
`Illuminate/Support/helpers.ts`). The parity checker folds a PHP-side
`is_null(EXPR)` into `EXPR === undefined` and any other bare `null` into
`undefined`, so neither spelling costs fidelity.

## `src/Larablox/`: the port's own runtime

`src/Illuminate/` is the mirror of upstream's `src/Illuminate/` and holds
nothing Laravel doesn't have. Everything the port itself needs and Laravel
has no file for lives under `src/Larablox/` (specs under `tests/Larablox/`,
import path `Larablox/...`), so the mirror never carries a file with no
upstream twin and the parity walk never has to skip one:

- `Larablox/php.ts` - stand-ins for PHP *language* built-ins: `truthy()`
  for the implicit bool coercion of `if ($x)`, `func_num_args()`/
  `func_get_arg()`/`func_get_args()` for the call-frame introspection
  below. `Illuminate/Support/helpers.ts` holds ported Laravel helpers only
  (`tap()`, ...), mirroring `Support/helpers.php`.
- `Larablox/types.ts` - `Callable`, `AnyConstructor`.
- `Larablox/MagicDispatch.ts` - the `MagicDispatch<T>` brand.
- `Larablox/TableArgs.luau` + `.d.ts` - `decoratePackedArgs()`.

A type derived from one specific Laravel class (`HigherOrderTapProxyView`,
`PendingHigherOrderWhenProxy`) stays in that class's own file: it is part
of porting that class, not shared runtime.

## Magic dispatch (`__get`/`__call`)

PHP decides between `__get` (property read) and `__call` (method call) from
parentheses in the *source* - something the compiled output has no way to
see: `obj.foo` and `obj.foo(x)` both reach the same Luau `__index`
metamethod the same way, with nothing telling it a call is about to follow.
No runtime check is general enough to stand in for that (a class whose
`__get` reads an attributes map and whose `__call` forwards to a query
builder shares nothing between the two a value could be inspected for).

The fix recovers the parentheses before they're gone: `MagicDispatch<T>`
(`src/Larablox/MagicDispatch.ts`) marks a type as magic-dispatched,
and `scripts/build/transform-magic-dispatch.mjs` - run automatically by
`npm run build`/`watch`, since `rbxtsc` has no transformer hook to run
inside - reads the real TypeScript AST and rewrites every access on a
`MagicDispatch<T>`-typed value into an explicit call before `rbxtsc` ever
sees it: `view.name` -> `view.__get('name')`, `view.touch(x)` ->
`view.___call('touch', [x])`. The class itself still needs literal
`__get(key: string)`/`___call(method: string, parameters: unknown[])`
methods - the transform only recovers the routing decision, not the bodies.

The rewritten call is typed, not just routed: `MagicDispatch<T>` itself
declares `__get<K>(key: K): T[K]` and `___call<K>(method: K, parameters):
...` off the view's own member `K`, so `view.___call('touch', [x])` keeps
exactly the return type `view.touch(x)` had and anything the source chained
or assigned from it (`tap(user).save().name`) still typechecks once
`rbxtsc` re-checks the shadow tree. The transform used to cast the receiver
to a throwaway `{ ___call(...): unknown }` instead, which typed every result
`unknown` - invisible as long as no result was ever used as anything but an
`expect()` argument, and caught the first time one was (`HigherOrderTapProxy`,
whose only job is handing the target back for further use). A `__get`/
`___call` written out by hand on a magic-dispatch value is already the
explicit form and is left alone rather than re-routed into a magic call
*named* `___call`.

The transform routes exactly two shapes, `view.key` and `view.method(args)`,
and refuses the others at build time (a `file:line:col` error, the build
fails) rather than passing them through: element access (`view['key']`),
a parenthesized callee (`(view.m)(x)`), optional chaining (`view?.key`,
`view?.m(x)`), and any access on a union with a magic constituent
(`HigherOrderTapProxyView<T> | T`, which `tap(value, callback?)` returns -
a union is not magic itself, since `getPropertyOfType()` only reports a
property every constituent has). Passed through, each would compile to a
plain Luau access on the proxy, which has no such member, and fail as a
`nil` call at runtime with nothing pointing back at the source. The fix is
always to write the plain form, or to narrow/cast the union first.

`HigherOrderWhenProxy` uses it too, even though its `__get`/`___call` both
forward 1:1 onto a `target` object and a plain runtime `typeIs()` check on
`target[key]` would have been enough on its own: the compile-time rewrite
made an actual runtime proxy (`setmetatable`, a hand-rolled `__index`,
swapping `this` back in for the wrapper on every "keep chaining" return)
unnecessary, not just an alternative - `when()`/`unless()` return a plain
`new HigherOrderWhenProxy(target)` and the transform makes `.save()`/
`.isAdmin` on it route to the real methods directly. Reach for it any time a
`MagicDispatch<T>`-typed value needs the same, whether or not a runtime
check happens to be available - it's simpler either way.

`___call`'s own body has one further forced divergence: PHP's
`$this->target->{$method}(...$parameters)` binds `$method`'s receiver
implicitly, the same way Luau's own `:` self-call syntax would for a
*literal* method name - but `:` requires that literal, so a call whose
method name is only known at runtime (`method` is a parameter here) can
only ever compile to a plain, non-self Luau function call. Confirmed
against the compiled output: `(self.target)[method](self.target,
unpack(parameters))`, not `(self.target):[method](unpack(parameters))`
(not even valid Luau grammar). The port has to re-pass `this.target` as an
explicit first call argument to get the binding PHP/Luau give for free
with a literal name. `__get` has no such divergence - it only *reads*
`target[key]`, never calls it, so there's no receiver to bind in the first
place.

Where the cast that makes `this.target[method]` legal lives depends on the
PHP field's visibility. A target that is `protected`/`private` upstream
(`HigherOrderWhenProxy`) is typed `T & Record<string, unknown>` and cast
once, in the constructor, so no body-level `as` is needed. A target that is
`public` upstream (`HigherOrderTapProxy`) stays `T` and casts at its one
use site (`(this.target as T & Record<string, unknown>)[method]`): declared
on a public field, the intersection becomes part of the class's API, and
while reading `proxy.target` as a `Subject` still works, assigning one back
does not - `proxy.target = new Subject()` fails with `TS2322: Type 'Subject'
is not assignable to type 'Subject & Record<string, unknown>'` (confirmed
with a scratch probe). Type assertions are stripped before the parity
comparison, so both spellings score the same; only the public surface
differs.

## `func_num_args()` (`Conditionable::when`/`unless`)

PHP's `func_num_args()` distinguishes an omitted argument from an explicit
`null` one - `when()` (0 arguments) and `when(null)` (1 argument) reach
different branches upstream, even though `$value` is falsy either way. No
TypeScript-compiled function body can recover this: `rbxtsc` always lowers a
`...args: T[]` rest parameter to `local args = { ... }` before any of that
body's own code runs, and a Luau table built that way has the same length
(`#`) whether it was built from a trailing `nil` vararg or from none at all
- confirmed by direct compilation, and true of every counting method tried
(`args.size()`, `select('#', unpack(args))`, `table.pack(...)` called from
inside the already-collapsed body). The count is only ever recoverable by
running `select('#', ...)` on the *original*, still-live varargs, before any
TS-compiled body gets a chance to collapse them.

`Larablox/php.ts` exports a `func_num_args(args: PackedArgs): number`
wrapper (just `args.n`) so call sites read closer to PHP's own
`func_num_args()` - it still has to take `args` as a real parameter, unlike
PHP's zero-argument, ambient-call-frame version, since nothing here can
introspect "the current call" without being handed it explicitly.

`src/Larablox/TableArgs.luau` - the only hand-written Luau in the
framework, everything else here is TS compiled by `rbxtsc` - supplies
that missing earlier step: `installTableArgs(cls, methodName)` wraps the
already-compiled method in a raw function that receives the real call
untouched, packs it itself (`table.pack(...)`, whose `.n` field is exactly
`func_num_args()`), and hands off to the original method with the packed
table prepended as a hidden first parameter. `Conditionable`'s `when`/
`unless` call it themselves, right after building their class, rather than
via `@decorator` syntax: both are mixin factories returning a class
*expression* (`return class extends Base {...}`), and TypeScript's legacy
decorators (`experimentalDecorators`) can only target a method inside a
class *declaration* - confirmed by direct compilation (`TS1206: Decorators
are not valid here`).

The wrapped method's own implementation signature types its parameters
`any`, not their real types: TypeScript requires an implementation to be
assignable-compatible with every overload above it, and a closure-typed
overload (`when(value: (instance: this) => unknown)`) isn't satisfiable by
a plainly-`unknown`-typed parameter (checked contravariantly) once `value`
stops being folded into a rest parameter's untyped array - `any`
sidesteps that check the same way casting a rest-parameter array with `as`
already did. `rbxtsc` itself then refuses to let an `any`-typed value be
*used* (only declared), so the body immediately re-destructures into
properly typed locals before doing anything else - see `Conditionable.ts`.

A hand-authored `.luau` file (paired with a `.d.ts` twin for the TS side)
sits under `src/Larablox/` like any other file here and gets pulled into
the build the same way: `rbxtsc` copies any non-`.ts` file
under its own project root straight through to `out/` unchanged.
`scripts/build/transform-magic-dispatch.mjs` needed a matching fix to copy
such files into its `.magic-dispatch/` shadow tree too, since its main pass
only walks `ts.Program.getSourceFiles()` - which a `.luau` file was never
part of, and which explicitly skips `.d.ts` files (loaded only to resolve
types from, never meant to be re-emitted).

Any method reading `func_num_args(args)` must be wrapped by
`decoratePackedArgs(cls, methodName)` right after the class is built -
forgetting to is invisible to TypeScript (the method compiles fine, it just
can't tell `when()` from `when(undefined)` at runtime any more). Enforced
automatically on every build by `scripts/lint/check-packed-args.mjs`, which
also catches the opposite mistake - a `decoratePackedArgs()` call naming a
method that doesn't exist (a rename typo, most likely).

## Testing under Lune

`rbxtsc`'s compiled output always resolves other modules the Roblox way -
`TS.import(script, ancestor, ...segments)`, itself built on `local TS =
_G[script]` and, transitively, on `require(instance)`. That is correct for
`out/` (a real Roblox DataModel gives every script a `script` global, and
Roblox's own `require` accepts an Instance) and unusable for `npm test`:
Lune has no `script` global, and its `require` rejects an Instance outright
(confirmed empirically - `bad argument #1 to 'require' (string expected,
got userdata)`). There is no `rbxtsc` flag for a different import style;
Roblox-shaped output is the only kind it produces.

Two things patch around that gap, both Lune-only - `out/` is never touched
by either:

- `@rbxts/testez`'s own runtime has the identical problem one level down
  (`require(script.Parent.X)` inside the library itself), so the pieces
  this project needs are vendored into `scripts/lune/testez/` with just
  those `require` calls rewritten to plain relative paths - see that
  directory's own README for exactly what changed and why.
- `scripts/lune/patch-requires.mjs` runs after `rbxtsc` (`npm run
  test:build`) and rewrites every `TS.import(...)` call under `out-tests/`
  into the equivalent `require("...")`, computed from `test.project.json`'s
  own mount points (`Illuminate` -> `out-tests/src/Illuminate`,
  `IlluminateTests` -> `out-tests/tests/Illuminate`). `scripts/lune/
  RunTests.luau` then discovers specs by walking `out-tests/` on disk and
  feeds them to `TestPlanner.createPlan()` directly - not TestEZ's own
  `TestBootstrap:run()`, which (like the library internals above) expects
  to scan a real Instance tree.
