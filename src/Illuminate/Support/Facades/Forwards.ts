import { RuntimeException } from 'Illuminate/Exception';

/**
 * The type of a method as forwarded by a facade.
 *
 * Declaring a facade member directly as `Repository["get"]` keeps the type's
 * method nature, and roblox-ts then compiles the call with a colon, handing the
 * forwarder the facade class as a stray first argument. Rebuilding the
 * signature through this alias yields a plain function type, which is always
 * compiled as a dot call.
 */
export type Forwarded<T> = T extends (...args: infer A) => infer R ? (...args: A) => R : never;

/**
 * Stand-in for `Facade::__callStatic()`.
 *
 * PHP resolves an unknown static call on a facade to a method on the facade
 * root. Luau has no `__callStatic`, but a class table is an ordinary table:
 * replacing `__index` on its metatable with a function intercepts exactly the
 * lookups PHP would have handed to `__callStatic`, while keys the class or its
 * parents really own keep resolving as before.
 *
 * The forwarded methods themselves are declared on the facade with
 * `public static declare`, which emits no code -- the TypeScript equivalent of
 * the `@method static` docblocks Laravel carries for the same purpose.
 */
export function Forwards()
{
    return (target: object): void => {
        const metatable = getmetatable(target) as object | undefined;

        if (metatable === undefined) {
            throw new RuntimeException('A facade must extend Facade to forward calls.');
        }

        const inherited = rawget(metatable, '__index') as Record<string, unknown> | undefined;

        rawset(metatable, '__index', (_receiver: unknown, key: string) => {
            const owned = inherited?.[key];

            // Anything the facade or Facade itself declares wins; only the rest
            // is forwarded, which is what PHP's __callStatic sees.
            if (owned !== undefined) {
                return owned;
            }

            // roblox-ts compiles a call through a function-valued property as a
            // dot call, so this closure is never handed a `self` argument.
            return (...args: Array<unknown>) => {
                const facade = target as unknown as Record<string, Callback>;
                const root = facade.getFacadeRoot(target) as Record<string, unknown> | undefined;

                if (root === undefined) {
                    throw new RuntimeException('A facade root has not been set.');
                }

                const method = root[key];

                if (!typeIs(method, 'function')) {
                    throw new RuntimeException(`Method [${key}] does not exist on the facade root.`);
                }

                return (method as Callback)(root, ...args);
            };
        });
    };
}
