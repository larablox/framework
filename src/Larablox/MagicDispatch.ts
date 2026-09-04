/**
 * Marks a type as PHP-style magic dispatch: reading or calling any member on
 * a value typed this way has no direct TypeScript/Luau counterpart - PHP
 * decides between `__get`/`__call` from parentheses in the *source*, which
 * `rbxtsc`'s output cannot see (a `.foo` read and a `.foo()` call reach the
 * same `__index` metamethod the same way, with no signal telling it a call
 * is about to follow). There is no runtime workaround general enough to
 * cover every shape __get/__call might take - unlike `HigherOrderWhenProxy`,
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
 * methods - this only recovers the routing decision the language itself
 * has no way to make.
 *
 * The `__get`/`___call` members declared here are what the rewritten call
 * resolves against when `rbxtsc` re-typechecks the shadow tree: typed off
 * the view's own member `K`, so `view.___call('touch', [x])` keeps exactly
 * the return type `view.touch(x)` had, and whatever the source chained on
 * that result (`tap(user).save().name`) still typechecks after the rewrite.
 * They only ever describe the class's real methods (whose own signatures
 * are the untyped `string`/`unknown[]` form above) - nothing here exists at
 * runtime, and casting to this type (`target as unknown as
 * MagicDispatch<View>`) costs nothing there either.
 */
export type MagicDispatch<T> = T & {
    readonly __magicDispatch?: never;
    __get<K extends keyof T & string>(key: K): T[K];
    ___call<K extends keyof T & string>(method: K, parameters: MagicDispatchParameters<T[K]>): MagicDispatchReturn<T[K]>;
};

type MagicDispatchParameters<TMember> = TMember extends (...args: infer TArgs) => unknown ? TArgs : never;

type MagicDispatchReturn<TMember> = TMember extends (...args: never[]) => infer TReturn ? TReturn : never;
