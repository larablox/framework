/**
 * Marks a type as PHP-style magic dispatch: reading or calling any member on
 * a value typed this way has no direct TypeScript/Luau counterpart -- PHP
 * decides between `__get`/`__call` from parentheses in the *source*, which
 * `rbxtsc`'s output cannot see (a `.foo` read and a `.foo()` call reach the
 * same `__index` metamethod the same way, with no signal telling it a call
 * is about to follow). There is no runtime workaround general enough to
 * cover every shape __get/__call might take -- unlike `HigherOrderWhenProxy`,
 * which forwards 1:1 onto a `target` object a runtime `typeIs()` check can
 * inspect, a class like `Model` resolves `__get` (read an attribute) and
 * `__call` (forward to a new query builder) in ways that share nothing to
 * check.
 *
 * `scripts/build/transform-magic-dispatch.mjs` reads the parentheses while
 * they still exist, at the TypeScript AST level, and rewrites each access
 * on a `MagicDispatch<T>`-typed value into an explicit call before `rbxtsc`
 * ever sees it: `view.name` -> `view.__get('name')`, `view.touch(x)` ->
 * `view.___call('touch', [x])`. The class itself still needs literal
 * `__get(key: string)`/`___call(method: string, parameters: unknown[])`
 * methods -- this only recovers the routing decision the language itself
 * has no way to make.
 *
 * The brand exists purely at the type level; casting to it
 * (`target as unknown as MagicDispatch<View>`) costs nothing at runtime.
 */
export type MagicDispatch<T> = T & { readonly __magicDispatch?: never };

/**
 * The shape a `___call` implementation's dynamically-resolved method value
 * has: the method name is only a runtime string, so arity and argument/
 * return types can't be known statically -- this is as much of a call
 * signature as there is to promise up front. The TS analogue of PHP's own
 * `callable` type hint, which carries exactly as little.
 */
export type Callable = (...args: unknown[]) => unknown;
