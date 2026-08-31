import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Contract } from 'Illuminate/Container/Contract';

/**
 * A concrete, instantiable class.
 *
 * The parameter list is `never[]` so that any class is assignable regardless of
 * its constructor signature; the container rebuilds the argument list from the
 * `Inject` metadata rather than from the type.
 */
export type Constructor<T extends object = object> = new(...args: Array<never>) => T;

/** A class that may be abstract -- usable as a key, but never instantiated. */
export type AbstractClass<T extends object = object> = abstract new(...args: Array<never>) => T;

/**
 * PHP: `string`, in practice either a plain key such as `"config"`, a
 * `Foo::class` string, or a `SomeContract::class` interface name. Luau has no
 * class-strings, so the class itself stands in for `::class`, and a `Contract`
 * token stands in for an interface name; all three spellings key bindings.
 */
export type Abstract = string | AbstractClass | Contract;

/** PHP: the `\Closure` a binding resolves through. */
export type ContainerClosure = (container: Container, parameters: ParameterOverrides) => unknown;

/** PHP: `\Closure|string $concrete`. */
export type Concrete = Abstract | ContainerClosure;

/** PHP: the `\Closure` passed to `Container::extend()`. */
export type ExtenderClosure = (service: never, container: Container) => unknown;

/** PHP: the `\Closure` passed to `Container::bindMethod()`. */
export type MethodBindingClosure = (instance: never, container: Container) => unknown;

/** PHP: the `\Closure` passed to `beforeResolving()`. */
export type BeforeResolvingCallback = (
    abstract: Abstract,
    parameters: ParameterOverrides,
    container: Container,
) => void;

/** PHP: the `\Closure` passed to `resolving()` and `afterResolving()`. */
export type ResolvingCallback = (instance: never, container: Container) => void;

/** PHP: `callable|string $callback` accepted by `Container::call()`. */
export type CallableTarget = Callback | [object | Abstract, string] | string;

/**
 * PHP: `array<string, mixed> $parameters`, keyed by constructor parameter name.
 *
 * Parameter names do not survive compilation, so an override is keyed by the
 * abstract the parameter asks for, or by its position in the argument list.
 */
export type ParameterOverrides = Map<Abstract | number, unknown>;

/**
 * An entry on the build stack. Laravel pushes the class name being built, or
 * `spl_object_hash($closure)` for a closure; here the class or the closure
 * itself is pushed, since a Luau table keys on any value.
 */
export type BuildStackEntry = Abstract | ContainerClosure;

/** A binding as stored in `Container::$bindings`. */
export interface Binding
{
    readonly concrete: ContainerClosure;
    readonly shared: boolean;
}

/**
 * What the public API accepts for `$parameters`: either the keyed override map
 * or a plain list, which is read as index-keyed overrides.
 */
export type ParameterList = ParameterOverrides | Array<unknown>;

/** PHP: `(callable(array<int, string>|string): bool|string)|null`. */
export type EnvironmentResolver = (environments: Array<string> | string) => boolean | string;

/**
 * PHP: `\Closure|string|array $implementation` handed to a contextual binding.
 *
 * The array form only makes sense for a variadic parameter, which resolves each
 * entry in turn.
 */
export type ContextualImplementation = Concrete | Array<Abstract>;
