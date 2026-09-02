# Porting conventions

Rules for carrying Laravel's PHP into this port's TypeScript. The port is
letter-for-letter -- same constructs, same variable names -- and diverges
only where TypeScript/roblox-ts/Luau genuinely forces it.

## Naming

- **Reserved word**: a PHP identifier that collides with a TS/Luau reserved
  word gets a leading underscore -- `_x` spells PHP's `x`. E.g. a PHP
  parameter named `$default` becomes `_default` (`default` is reserved in
  TypeScript).

- **Property/method collision**: PHP allows a property and a method to
  share a name; a TS class can't. The property takes the leading
  underscore, the method keeps the bare name. E.g. PHP's `$value` property
  and `value()` method become `_value` (property) and `value()` (method).

- **`__call` as a member name**: rejected by roblox-ts -- it's a real Luau
  metamethod (makes an *instance itself* callable, `instance(...)`),
  unrelated to PHP's `__call` (dispatch on an unknown *method name*,
  `$obj->foo()`). Takes one more leading underscore than PHP's own two:
  `___call`. `__get` has no such collision and keeps its literal name.

## Magic dispatch (`__get`/`__call`)

PHP decides between `__get` (property read) and `__call` (method call) from
parentheses in the *source* -- something the compiled output has no way to
see: `obj.foo` and `obj.foo(x)` both reach the same Luau `__index`
metamethod the same way, with nothing telling it a call is about to follow.
No runtime check is general enough to stand in for that (a class whose
`__get` reads an attributes map and whose `__call` forwards to a query
builder shares nothing between the two a value could be inspected for).

The fix recovers the parentheses before they're gone: `MagicDispatch<T>`
(`src/Illuminate/Support/MagicDispatch.ts`) marks a type as magic-dispatched,
and `scripts/build/transform-magic-dispatch.mjs` -- run automatically by
`npm run build`/`watch`, since `rbxtsc` has no transformer hook to run
inside -- reads the real TypeScript AST and rewrites every access on a
`MagicDispatch<T>`-typed value into an explicit call before `rbxtsc` ever
sees it: `view.name` -> `view.__get('name')`, `view.touch(x)` ->
`view.___call('touch', [x])`. The class itself still needs literal
`__get(key: string)`/`___call(method: string, parameters: unknown[])`
methods -- the transform only recovers the routing decision, not the bodies.

`HigherOrderWhenProxy` uses it too, even though its `__get`/`___call` both
forward 1:1 onto a `target` object and a plain runtime `typeIs()` check on
`target[key]` would have been enough on its own: the compile-time rewrite
made an actual runtime proxy (`setmetatable`, a hand-rolled `__index`,
swapping `this` back in for the wrapper on every "keep chaining" return)
unnecessary, not just an alternative -- `when()`/`unless()` return a plain
`new HigherOrderWhenProxy(target)` and the transform makes `.save()`/
`.isAdmin` on it route to the real methods directly. Reach for it any time a
`MagicDispatch<T>`-typed value needs the same, whether or not a runtime
check happens to be available -- it's simpler either way.
