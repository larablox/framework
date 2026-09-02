# Porting conventions

Decisions about how Laravel's PHP is carried over into this port's
TypeScript, recorded as they're made so they don't need re-litigating.
The port aims to be letter-for-letter -- same constructs, same variable
names -- and diverges only where the platform (TypeScript/roblox-ts/Luau)
genuinely forces it. Each entry below is one such forced divergence.

## Naming

- **Reserved word**: a PHP identifier that collides with a TypeScript/Luau
  reserved word gets a leading underscore in the port -- `_x` spells PHP's
  `x`. Example: `Conditionable::when()`/`unless()`'s third parameter,
  PHP's `$default`, becomes `_default`, since `default` is a reserved
  word in TypeScript (confirmed by compiling: `TS1359: 'default' is a
  reserved word that cannot be used here`).

- **Property/method name collision**: PHP allows a class to have a property
  and a method with the same name (separate namespaces: `$obj->x` vs
  `$obj->x()`); a TypeScript class has one flat member table and cannot.
  The *property* takes the leading underscore, the method keeps the bare
  name -- the method is the class's active/callable API, the property is
  its backing state. Example: `HigherOrderWhenProxy`'s `$condition`
  property (read at several call sites) and its `condition($condition)`
  builder method become `_condition` (property) and `condition()`
  (method); same for `$negateConditionOnCapture` / `negateConditionOnCapture()`
  -> `_negateConditionOnCapture` / `negateConditionOnCapture()`.

- **`__call` as a class member name**: rejected outright by roblox-ts
  ("Metamethods cannot be used in class definitions!") since `__call` is
  a real Luau metamethod name reserved for making an *instance itself*
  callable (`instance(...)`) -- an unrelated meaning to PHP's `__call`
  (dispatch on an unknown *method name*, `$obj->foo(...)`). Takes the
  reserved-word convention one step further: `___call` (one more
  underscore on top of PHP's own two). `__get` has no such collision --
  it compiles as an ordinary method, since PHP's magic-getter name isn't
  a Luau metamethod at all -- and keeps its literal name.
