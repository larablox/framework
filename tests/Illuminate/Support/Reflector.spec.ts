/// <reference types="@rbxts/testez/globals" />

/**
 * PHP: `Illuminate\Tests\Support\SupportReflectorTest` and
 * `Illuminate\Tests\Support\SupportReflectsClosuresTest` -- neither has a
 * portable test in it, so this file intentionally carries none either. Both
 * are documented here rather than silently omitted.
 *
 * `Illuminate\Support\Reflector.ts`'s own class comment explains the
 * mismatch: PHP's `Reflector` wraps `ReflectionClass`/`ReflectionParameter`
 * to resolve constructor and method parameter types at runtime. Compiling to
 * Luau erases all of that -- a compiled class is just a table whose metatable
 * carries `__tostring` and `__index`, with no reflection API describing a
 * method's parameters at all. This port's `Reflector` is therefore a
 * different, much smaller tool built on that metatable shape instead:
 * `classOf`, `className`, `parentClass`, `isSubclassOf`, `isInstance`,
 * `isInstanceOf`. It answers "what class is this / is A a B", never "what
 * type does parameter N of this callable expect".
 *
 * Every PHP test in `SupportReflectorTest` exercises the parameter/attribute
 * side that has no counterpart here at all:
 *
 * - `testGetClassName`, `testEmptyClassName`, `testStringTypeName`,
 *   `testSelfClassName`, `testParentClassName`, `testUnionTypeName` --
 *   `Reflector::getParameterClassName($parameter)`, reading the declared type
 *   of a `ReflectionParameter`. No such method exists here; there is no
 *   `ReflectionParameter` to read one from.
 * - `testParameterSubclassOfInterface` -- `Reflector::isParameterSubclassOf()`,
 *   same parameter-reflection dependency.
 * - `testIsCallable` -- `Reflector::isCallable()`, checking PHP callable
 *   shapes (`[Class, 'method']` strings, `__call`/`__callStatic` magic
 *   methods). Not ported; nothing in this codebase resembles a PHP callable
 *   string, and `__call`/`__callStatic` do not exist in Luau (see
 *   `laravel-parity.md`'s note on `Log`'s un-ported `__call`-forwarding for
 *   the same gap elsewhere).
 * - `testGetClassAttributes`, `testGetClassAttribute` --
 *   `Reflector::getClassAttributes()`/`::getClassAttribute()`, reading PHP 8
 *   attributes off a class via reflection. Not ported; this codebase's
 *   equivalent -- parameter-attribute decorators for the container (see
 *   `laravel-parity.md`'s "Контекстные атрибуты параметров") -- lives on the
 *   container's own registry, not on `Reflector`, and exposes no
 *   PHP-attribute-shaped read-back API to test here.
 *
 * `SupportReflectsClosuresTest::testReflectsClosures` is the same story one
 * level up: it exercises `Illuminate\Support\Traits\ReflectsClosures`, which
 * inspects a `Closure`'s parameter types via `ReflectionFunction` to decide
 * what to pass it. That trait was not ported (parameter types are erased the
 * same way), so there is nothing here to call.
 *
 * None of `Reflector.ts`'s actual ported methods (`classOf`, `className`,
 * `parentClass`, `isSubclassOf`, `isInstance`, `isInstanceOf`) have a PHP
 * `SupportReflectorTest` counterpart to port from -- PHP's `Reflector` never
 * had methods shaped like these, they're this port's own addition to cover
 * what the container actually needs. Inventing new test cases for them here
 * would violate the "don't invent cases absent from the PHP reference" rule,
 * so this file stays empty of `it()`s rather than fabricate coverage.
 */
export = (): void => {
    describe('Reflector', () => {
        // Intentionally no it() blocks -- see the file-level comment above.
    });
};
