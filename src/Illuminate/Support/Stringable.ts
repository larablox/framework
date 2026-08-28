/**
 * PHP: `Illuminate\Support\Stringable`.
 *
 * The class itself is declared in `Str.ts`. `Str::of()` builds a `Stringable`
 * and every `Stringable` method calls back into `Str`; PHP closes that circle
 * with autoloading, and Luau cannot -- a cyclic *value* import does not fail
 * at the line that makes it, it kills the whole module (see
 * `agent_docs/roblox-ts-constraints.md`). One module holds both classes, and
 * this one keeps the import path PHP would use.
 */
export { Stringable } from 'Illuminate/Support/Str';
export type { WhenCallback } from 'Illuminate/Support/Str';
