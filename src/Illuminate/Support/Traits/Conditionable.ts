import { HigherOrderWhenProxy, truthy } from 'Illuminate/Support/HigherOrderWhenProxy';

// TS2545: a mixin base's constructor must accept a single `any[]` rest parameter.
type AnyConstructor<T = object> = new (...args: any[]) => T;

export function Conditionable<TBase extends AnyConstructor>(Base: TBase)
{
    return class extends Base
    {
        public when(): HigherOrderWhenProxy<this>;
        public when(value: unknown): HigherOrderWhenProxy<this>;
        public when(
            value: unknown,
            callback: (instance: this, value: unknown) => unknown,
            _default?: (instance: this, value: unknown) => unknown,
        ): unknown;
        public when(...args: unknown[]): unknown
        {
            let value = args[0];
            value = typeIs(value, 'function') ? (value as (instance: this) => unknown)(this) : value;

            if (args.size() === 0) {
                return new HigherOrderWhenProxy(this);
            }

            if (args.size() === 1) {
                return new HigherOrderWhenProxy(this).condition(value);
            }

            const callback = args[1] as (instance: this, value: unknown) => unknown;
            const _default = args[2] as ((instance: this, value: unknown) => unknown) | undefined;

            if (truthy(value)) {
                return callback(this, value) ?? this;
            } else if (truthy(_default)) {
                return (_default as (instance: this, value: unknown) => unknown)(this, value) ?? this;
            }

            return this;
        }

        public unless(): HigherOrderWhenProxy<this>;
        public unless(value: unknown): HigherOrderWhenProxy<this>;
        public unless(
            value: unknown,
            callback: (instance: this, value: unknown) => unknown,
            _default?: (instance: this, value: unknown) => unknown,
        ): unknown;
        public unless(...args: unknown[]): unknown
        {
            let value = args[0];
            value = typeIs(value, 'function') ? (value as (instance: this) => unknown)(this) : value;

            if (args.size() === 0) {
                return new HigherOrderWhenProxy(this).negateConditionOnCapture();
            }

            if (args.size() === 1) {
                return new HigherOrderWhenProxy(this).condition(!truthy(value));
            }

            const callback = args[1] as (instance: this, value: unknown) => unknown;
            const _default = args[2] as ((instance: this, value: unknown) => unknown) | undefined;

            if (!truthy(value)) {
                return callback(this, value) ?? this;
            } else if (truthy(_default)) {
                return (_default as (instance: this, value: unknown) => unknown)(this, value) ?? this;
            }

            return this;
        }
    };
}
