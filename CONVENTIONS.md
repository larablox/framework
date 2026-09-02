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
