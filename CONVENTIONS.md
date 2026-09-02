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
