import { MagicDispatch } from 'Illuminate/Support/MagicDispatch';
import { Callable } from 'Illuminate/Support/types';

export class HigherOrderTapProxy<T extends object>
{
    /** The target being tapped. */
    public target: T & Record<string, unknown>;

    /** Create a new tap proxy instance. */
    public constructor(target: T)
    {
        this.target = target as T & Record<string, unknown>;
    }

    /** Dynamically pass method calls to the target. */
    public ___call(method: string, parameters: unknown[]): unknown
    {
        (this.target[method] as Callable)(this.target, ...parameters);

        return this.target;
    }
}

type TapMemberResult<T, K extends keyof T> = T[K] extends (...args: infer TArgs) => unknown
    ? (...args: TArgs) => T
    : never;

/**
 * The view the proxy's callers see: any method on the target can be called
 * with its real arguments, and what comes back is always the target itself,
 * never the method's own result. Methods only: the proxy has no `__get`, so
 * a bare property read has nothing to route to and is left out of the view
 * rather than rewritten into a call that doesn't exist.
 */
export type HigherOrderTapProxyView<T extends object> = MagicDispatch<{
    [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: TapMemberResult<T, K>;
}>;
