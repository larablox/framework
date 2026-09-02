import { HigherOrderWhenProxy, makeHigherOrderWhenProxy, ResolvedHigherOrderWhenProxy, truthy } from 'Illuminate/Support/HigherOrderWhenProxy';

// TS2545: a mixin base's constructor must accept a single `any[]` rest parameter.
type AnyConstructor<T = object> = new (...args: any[]) => T;

/** Add conditional applicability to any class. */
export function Conditionable<TBase extends AnyConstructor>(Base: TBase)
{
    return class extends Base
    {
        /** Get a higher order proxy that applies the next call only if the given "value" is truthy. */
        public when(): HigherOrderWhenProxy<this>;
        /** Get a higher order proxy that applies the next call only if the given "value" resolves to truthy. */
        public when<TValue>(value: TValue | ((instance: this) => TValue)): ResolvedHigherOrderWhenProxy<this>;
        /** Apply the callback if the given "value" is (or resolves to) truthy. */
        public when<TValue, TReturn = this>(
            value: TValue | ((instance: this) => TValue),
            callback: (instance: this, value: TValue) => TReturn | void,
            defaultCallback?: (instance: this, value: TValue) => TReturn | void,
        ): this | TReturn;
        public when(...args: unknown[]): unknown
        {
            if (args.size() === 0) {
                return makeHigherOrderWhenProxy(this, {
                    hasCondition: false,
                    condition: false,
                    negateConditionOnCapture: false,
                });
            }

            const resolved = resolveConditionValue(this, args[0]);

            if (args.size() === 1) {
                return makeHigherOrderWhenProxy(this, {
                    hasCondition: true,
                    condition: truthy(resolved),
                    negateConditionOnCapture: false,
                });
            }

            return applyCondition(this, truthy(resolved), resolved, args[1] as ConditionCallback, args[2] as ConditionCallback | undefined);
        }

        /** Get a higher order proxy that applies the next call only if the given "value" is falsy. */
        public unless(): HigherOrderWhenProxy<this>;
        /** Get a higher order proxy that applies the next call only if the given "value" resolves to falsy. */
        public unless<TValue>(value: TValue | ((instance: this) => TValue)): ResolvedHigherOrderWhenProxy<this>;
        /** Apply the callback if the given "value" is (or resolves to) falsy. */
        public unless<TValue, TReturn = this>(
            value: TValue | ((instance: this) => TValue),
            callback: (instance: this, value: TValue) => TReturn | void,
            defaultCallback?: (instance: this, value: TValue) => TReturn | void,
        ): this | TReturn;
        public unless(...args: unknown[]): unknown
        {
            if (args.size() === 0) {
                return makeHigherOrderWhenProxy(this, {
                    hasCondition: false,
                    condition: false,
                    negateConditionOnCapture: true,
                });
            }

            const resolved = resolveConditionValue(this, args[0]);

            if (args.size() === 1) {
                return makeHigherOrderWhenProxy(this, {
                    hasCondition: true,
                    condition: !truthy(resolved),
                    negateConditionOnCapture: false,
                });
            }

            return applyCondition(this, !truthy(resolved), resolved, args[1] as ConditionCallback, args[2] as ConditionCallback | undefined);
        }
    };
}

type ConditionCallback = (instance: unknown, value: unknown) => unknown;

function resolveConditionValue(instance: unknown, value: unknown): unknown
{
    return typeIs(value, 'function') ? (value as (instance: unknown) => unknown)(instance) : value;
}

function applyCondition(
    instance: unknown,
    matched: boolean,
    resolved: unknown,
    callback: ConditionCallback,
    defaultCallback: ConditionCallback | undefined,
): unknown
{
    if (matched) {
        return callback(instance, resolved) ?? instance;
    } else if (defaultCallback !== undefined) {
        return defaultCallback(instance, resolved) ?? instance;
    }

    return instance;
}
