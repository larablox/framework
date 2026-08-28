import type { RewindableGenerator } from 'Illuminate/Container/RewindableGenerator';
import type {
    Abstract,
    AbstractClass,
    BeforeResolvingCallback,
    BuildStackEntry,
    Binding,
    CallableTarget,
    Concrete,
    ContextualImplementation,
    ExtenderClosure,
    MethodBindingClosure,
    ParameterList,
    ResolvingCallback,
} from 'Illuminate/Container/Types';
import type { ContextualBindingBuilder } from 'Illuminate/Contracts/Container/ContextualBindingBuilder';
import { Contract } from 'Illuminate/Container/Contract';

export interface Container {
    /** Resolve the given type from the container. */
    get<T extends object>(id: AbstractClass<T>): T;
    get<T>(id: Contract<T>): T;
    get<T = unknown>(id: string): T;
    get(id: Abstract): unknown;

    /** Determine if the given abstract type has been bound. */
    bound(abstract: Abstract): boolean;

    /** Determine if the given abstract type has been bound. */
    has(id: Abstract): boolean;

    /** Alias a type to a different name. */
    alias(abstract: Abstract, alias: Abstract): void;

    /** Assign a set of tags to a given binding. */
    tag(abstracts: Abstract | Array<Abstract>, tags: string | Array<string>): void;

    /** Resolve all of the bindings for a given tag. */
    tagged(tag: string): RewindableGenerator;

    /** Register a binding with the container. */
    bind(abstract: Abstract, concrete?: Concrete, shared?: boolean): void;

    /** Bind a callback to resolve with Container::call. */
    bindMethod(method: string | [Abstract, string], callback: MethodBindingClosure): void;

    /** Register a binding if it hasn't already been registered. */
    bindIf(abstract: Abstract, concrete?: Concrete, shared?: boolean): void;

    /** Register a shared binding in the container. */
    singleton(abstract: Abstract, concrete?: Concrete): void;

    /** Register a shared binding if it hasn't already been registered. */
    singletonIf(abstract: Abstract, concrete?: Concrete): void;

    /** Register a scoped binding in the container. */
    scoped(abstract: Abstract, concrete?: Concrete): void;

    /** Register a scoped binding if it hasn't already been registered. */
    scopedIf(abstract: Abstract, concrete?: Concrete): void;

    /** "Extend" an abstract type in the container. */
    extend(abstract: Abstract, closure: ExtenderClosure): void;

    /** Register an existing instance as shared in the container. */
    instance<T extends defined>(abstract: Abstract, instance: T): T;

    /** Add a contextual binding to the container. */
    addContextualBinding(concrete: BuildStackEntry, abstract: Abstract, implementation: ContextualImplementation): void;

    /** Define a contextual binding. */
    when(concrete: Abstract | Array<Abstract>): ContextualBindingBuilder;

    /** Get a closure to resolve the given type from the container. */
    factory(abstract: Abstract): () => unknown;

    /** Flush the container of all bindings and resolved instances. */
    flush(): void;

    /** Resolve the given type from the container. */
    make<T extends object>(abstract: AbstractClass<T>, parameters?: ParameterList): T;
    make<T>(abstract: Contract<T>, parameters?: ParameterList): T;
    make<T = unknown>(abstract: string, parameters?: ParameterList): T;
    make(abstract: Abstract, parameters?: ParameterList): unknown;

    /** Call the given Closure / class@method and inject its dependencies. */
    call(callback: CallableTarget, parameters?: ParameterList, defaultMethod?: string): unknown;

    /** Determine if the given abstract type has been resolved. */
    resolved(abstract: Abstract): boolean;

    /** Register a new before resolving callback. */
    beforeResolving(abstract: Abstract | BeforeResolvingCallback, callback?: BeforeResolvingCallback): void;

    /** Register a new resolving callback. */
    resolving(abstract: Abstract | ResolvingCallback, callback?: ResolvingCallback): void;

    /** Register a new after resolving callback. */
    afterResolving(abstract: Abstract | ResolvingCallback, callback?: ResolvingCallback): void;

    /** Get the container's bindings. */
    getBindings(): Array<[Abstract, Binding]>;
}

/** PHP: `Container::class` -- the interface name as a container key. */
export const ContainerContract = new Contract<Container>('Illuminate\\Contracts\\Container\\Container');
