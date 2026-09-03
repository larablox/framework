/**
 * The result of Luau's `table.pack(...)` on a method's real call-time
 * arguments -- `n` is the true argument count (from `select('#', ...)`),
 * distinguishing a trailing explicit `undefined` from an omitted argument
 * the way PHP's `func_num_args()` does. See TableArgs.luau.
 */
export interface PackedArgs extends Array<unknown>
{
    readonly n: number;
}

/**
 * Wraps `cls[methodName]` so its true call-time argument count (see
 * `PackedArgs`) is supplied as an extra first parameter, ahead of the
 * method's own declared parameters. A plain function call, not a
 * decorator: `Conditionable` (like any mixin) returns a class *expression*,
 * and TypeScript's legacy decorators (`experimentalDecorators`) cannot
 * target a method inside one -- only inside a class declaration.
 * Implemented in TableArgs.luau, not TypeScript -- see that file for why.
 */
export function decoratePackedArgs(cls: unknown, methodName: string): void;
