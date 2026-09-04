import { HigherOrderWhenProxy, PendingHigherOrderWhenProxy, ResolvedHigherOrderWhenProxy } from 'Illuminate/Support/HigherOrderWhenProxy';
import { func_num_args, truthy } from 'Larablox/php';
import { decoratePackedArgs } from 'Larablox/TableArgs';
import { AnyConstructor } from 'Larablox/types';

export function Conditionable<TBase extends AnyConstructor>(Base: TBase)
{
    const _class = class extends Base
    {
        /** Apply the callback if the given "value" is (or resolves to) truthy. */
        public when(): PendingHigherOrderWhenProxy<this>;
        public when<TWhenParameter>(value: (instance: this) => TWhenParameter): ResolvedHigherOrderWhenProxy<this>;
        public when(value: unknown): ResolvedHigherOrderWhenProxy<this>;
        public when<TWhenParameter, TWhenReturnType>(
            value: (instance: this) => TWhenParameter,
            callback: (instance: this, value: TWhenParameter) => TWhenReturnType,
            _default?: (instance: this, value: TWhenParameter) => TWhenReturnType,
        ): this | TWhenReturnType;
        public when<TWhenParameter, TWhenReturnType>(
            value: TWhenParameter,
            callback: (instance: this, value: TWhenParameter) => TWhenReturnType,
            _default?: (instance: this, value: TWhenParameter) => TWhenReturnType,
        ): this | TWhenReturnType;
        public when(
            _args?: any,
            value?: unknown,
            callback?: (instance: this, value: unknown) => unknown,
            _default?: (instance: this, value: unknown) => unknown,
        ): unknown
        {
            value = typeIs(value, 'function') ? value(this) : value;

            if (func_num_args(_args) === 0) {
                return new HigherOrderWhenProxy(this);
            }

            if (func_num_args(_args) === 1) {
                return new HigherOrderWhenProxy(this).condition(value);
            }

            if (truthy(value)) {
                return callback!(this, value) ?? this;
            } else if (truthy(_default)) {
                return _default!(this, value) ?? this;
            }

            return this;
        }

        /** Apply the callback if the given "value" is (or resolves to) falsy. */
        public unless(): PendingHigherOrderWhenProxy<this>;
        public unless<TUnlessParameter>(value: (instance: this) => TUnlessParameter): ResolvedHigherOrderWhenProxy<this>;
        public unless(value: unknown): ResolvedHigherOrderWhenProxy<this>;
        public unless<TUnlessParameter, TUnlessReturnType>(
            value: (instance: this) => TUnlessParameter,
            callback: (instance: this, value: TUnlessParameter) => TUnlessReturnType,
            _default?: (instance: this, value: TUnlessParameter) => TUnlessReturnType,
        ): this | TUnlessReturnType;
        public unless<TUnlessParameter, TUnlessReturnType>(
            value: TUnlessParameter,
            callback: (instance: this, value: TUnlessParameter) => TUnlessReturnType,
            _default?: (instance: this, value: TUnlessParameter) => TUnlessReturnType,
        ): this | TUnlessReturnType;
        public unless(
            _args?: any,
            value?: unknown,
            callback?: (instance: this, value: unknown) => unknown,
            _default?: (instance: this, value: unknown) => unknown,
        ): unknown
        {
            value = typeIs(value, 'function') ? value(this) : value;

            if (func_num_args(_args) === 0) {
                return new HigherOrderWhenProxy(this).negateConditionOnCapture();
            }

            if (func_num_args(_args) === 1) {
                return new HigherOrderWhenProxy(this).condition(!truthy(value));
            }

            if (!truthy(value)) {
                return callback!(this, value) ?? this;
            } else if (truthy(_default)) {
                return _default!(this, value) ?? this;
            }

            return this;
        }
    };

    // Not a decorator: `_class` is a class *expression* (every mixin
    // factory produces one), and TypeScript's legacy decorators cannot
    // target a method inside one - only inside a class declaration.
    decoratePackedArgs(_class, 'when');
    decoratePackedArgs(_class, 'unless');

    return _class;
}
