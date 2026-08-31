import { Arr } from 'Illuminate/Support/Arr';
import { Attributes } from 'Illuminate/Container/Attributes/Attributes';
import { Bind } from 'Illuminate/Container/Attributes/Bind';
import { BindingResolutionException } from 'Illuminate/Contracts/Container/BindingResolutionException';
import { CircularDependencyException } from 'Illuminate/Contracts/Container/CircularDependencyException';
import { BoundMethod } from 'Illuminate/Container/BoundMethod';
import { ContextualBindingBuilder } from 'Illuminate/Container/ContextualBindingBuilder';
import { EntryNotFoundException } from 'Illuminate/Container/EntryNotFoundException';
import { Exception, LogicException } from 'Illuminate/Exception';
import { OrderedMap } from 'Illuminate/Support/OrderedMap';
import { Reflector } from 'Illuminate/Support/Reflector';
import { RewindableGenerator } from 'Illuminate/Container/RewindableGenerator';
import { Scoped } from 'Illuminate/Container/Attributes/Scoped';
import { Singleton } from 'Illuminate/Container/Attributes/Singleton';
import { Util } from 'Illuminate/Container/Util';
import { getInjectedDependencies } from 'Illuminate/Container/Attributes/Inject';
import type { ParameterAttribute, ParameterDependency } from 'Illuminate/Container/Attributes/Inject';
import type {
    AfterResolvingAttributeCallback,
    ContextualAttributeHandler,
} from 'Illuminate/Contracts/Container/ContextualAttribute';
import { isSelfBuilding } from 'Illuminate/Contracts/Container/SelfBuilding';
import { callMethod, methodExists } from 'Illuminate/Container/helpers';
import type {
    Abstract,
    AbstractClass,
    BeforeResolvingCallback,
    Binding,
    BuildStackEntry,
    CallableTarget,
    Concrete,
    ContextualImplementation,
    Constructor,
    ContainerClosure,
    EnvironmentResolver,
    ExtenderClosure,
    MethodBindingClosure,
    ParameterList,
    ParameterOverrides,
    ReboundCallback,
    ResolvingCallback,
} from 'Illuminate/Container/Types';
import type { Container as ContainerContract } from 'Illuminate/Contracts/Container/Container';
import type { Contract } from 'Illuminate/Container/Contract';
import type { ContextualBindingBuilder as ContextualBindingBuilderContract } from 'Illuminate/Contracts/Container/ContextualBindingBuilder';

/** The result of a Singleton / Scoped attribute lookup; `false` is PHP's null. */
type ScopedType = 'singleton' | 'scoped' | false;

export class Container implements ContainerContract
{
    /** The current globally available container (if any). */
    protected static _instance?: Container;

    /** An array of the types that have been resolved. */
    protected _resolved = new Map<Abstract, boolean>();

    /** The container's bindings. */
    protected bindings = new OrderedMap<Abstract, Binding>();

    /** The container's method bindings, nested target -> method. */
    protected methodBindings = new Map<Abstract, Map<string, MethodBindingClosure>>();

    /** The container's shared instances. */
    protected instances = new Map<Abstract, defined>();

    /** The container's scoped instances. */
    protected scopedInstances = new Array<Abstract>();

    /** The registered type aliases. */
    protected aliases = new Map<Abstract, Abstract>();

    /** The registered aliases keyed by the abstract name. */
    protected abstractAliases = new Map<Abstract, Array<Abstract>>();

    /** The extension closures for services. */
    protected extenders = new Map<Abstract, Array<ExtenderClosure>>();

    /** All of the registered tags. */
    protected tags = new Map<string, Array<Abstract>>();

    /** The stack of concretions currently being built. */
    protected buildStack = new Array<BuildStackEntry>();

    /** The parameter override stack. */
    protected with = new Array<ParameterOverrides>();

    /** The contextual binding map. */
    public contextual = new Map<BuildStackEntry, Map<Abstract, ContextualImplementation>>();

    /** The contextual attribute handlers. */
    public contextualAttributes = new Map<Callback, ContextualAttributeHandler>();

    /** All of the after resolving attribute callbacks by attribute type. */
    protected afterResolvingAttributeCallbacks = new Map<Callback, Array<AfterResolvingAttributeCallback>>();

    /** Whether an abstract class has already had its attributes checked for bindings. */
    protected checkedForAttributeBindings = new Map<Abstract, boolean>();

    /** Whether a class has already been checked for Singleton or Scoped attributes. */
    protected checkedForSingletonOrScopedAttributes = new Map<Abstract, ScopedType>();

    /** All of the registered rebound callbacks. */
    protected reboundCallbacks = new Map<Abstract, Array<ReboundCallback>>();

    /** All of the global before resolving callbacks. */
    protected globalBeforeResolvingCallbacks = new Array<BeforeResolvingCallback>();

    /** All of the global resolving callbacks. */
    protected globalResolvingCallbacks = new Array<ResolvingCallback>();

    /** All of the global after resolving callbacks. */
    protected globalAfterResolvingCallbacks = new Array<ResolvingCallback>();

    /** All of the before resolving callbacks by class type. */
    protected beforeResolvingCallbacks = new OrderedMap<Abstract, Array<BeforeResolvingCallback>>();

    /** All of the resolving callbacks by class type. */
    protected resolvingCallbacks = new OrderedMap<Abstract, Array<ResolvingCallback>>();

    /** All of the after resolving callbacks by class type. */
    protected afterResolvingCallbacks = new OrderedMap<Abstract, Array<ResolvingCallback>>();

    /** The callback used to determine the container's environment. */
    protected environmentResolver?: EnvironmentResolver;

    /** Define a contextual binding. */
    public when(concrete: Abstract | Array<Abstract>): ContextualBindingBuilderContract
    {
        const aliases = new Array<Abstract>();

        for (const c of Util.arrayWrap(concrete)) {
            aliases.push(this.getAlias(c));
        }

        return new ContextualBindingBuilder(this, aliases);
    }

    /** Define a contextual binding based on an attribute. */
    public whenHasAttribute(attribute: Callback, handler: ContextualAttributeHandler): void
    {
        this.contextualAttributes.set(attribute, handler);
    }

    /** Register a new after resolving attribute callback for all types. */
    public afterResolvingAttribute(attribute: Callback, callback: AfterResolvingAttributeCallback): void
    {
        Util.pushInto(this.afterResolvingAttributeCallbacks, attribute, callback);
    }

    /** Determine if the given abstract type has been bound. */
    public bound(abstract: Abstract): boolean
    {
        return this.bindings.has(abstract) || this.instances.has(abstract) || this.isAlias(abstract);
    }

    public has(id: Abstract): boolean
    {
        return this.bound(id);
    }

    /** Determine if the given abstract type has been resolved. */
    public resolved(abstract: Abstract): boolean
    {
        if (this.isAlias(abstract)) {
            abstract = this.getAlias(abstract);
        }

        return this._resolved.has(abstract) || this.instances.has(abstract);
    }

    /** Determine if a given type is shared. */
    public isShared(abstract: Abstract): boolean
    {
        if (this.instances.has(abstract)) {
            return true;
        }

        if (this.bindings.get(abstract)?.shared === true) {
            return true;
        }

        if (!Util.isClass(abstract)) {
            return false;
        }

        const scopedType = this.getScopedTyped(abstract);

        if (scopedType === false) {
            return false;
        }

        if (scopedType === 'scoped') {
            if (!this.scopedInstances.includes(abstract)) {
                this.scopedInstances.push(abstract);
            }
        }

        return true;
    }

    /** Determine if a class has scoping attributes applied. */
    protected getScopedTyped(target: Abstract): ScopedType
    {
        const checked = this.checkedForSingletonOrScopedAttributes.get(target);

        if (checked !== undefined) {
            return checked;
        }

        let scopedType: ScopedType = false;

        if (Attributes.has(target, Singleton)) {
            scopedType = 'singleton';
        } else if (Attributes.has(target, Scoped)) {
            scopedType = 'scoped';
        }

        this.checkedForSingletonOrScopedAttributes.set(target, scopedType);

        return scopedType;
    }

    /** Determine if a given string is an alias. */
    public isAlias(name: Abstract): boolean
    {
        return this.aliases.has(name);
    }

    /**
     * Register a binding with the container.
     *
     * PHP also accepts a Closure as `$abstract` and derives the bound types from
     * its return type; return types do not survive compilation, so that overload
     * is not ported.
     */
    public bind(abstract: Abstract, concrete?: Concrete, shared = false): void
    {
        this.dropStaleInstances(abstract);

        // If no concrete type was given, we will simply set the concrete type to the
        // abstract type. After that, the concrete type to be registered as shared
        // without being forced to state their classes in both of the parameters.
        if (concrete === undefined) {
            concrete = abstract;
        }

        // If the factory is not a Closure, it means it is just a class name which is
        // bound into this container to the abstract type and we will just wrap it
        // up inside its own Closure to give us more convenience when extending.
        if (!typeIs(concrete, 'function')) {
            concrete = this.getClosure(abstract, concrete);
        }

        this.bindings.set(abstract, {
            concrete: concrete as ContainerClosure,
            shared,
        });

        // If the abstract type was already resolved in this container we'll fire the
        // rebound listener so that any objects which have already gotten resolved
        // can have their copy of the object updated via the listener callbacks.
        if (this.resolved(abstract)) {
            this.rebound(abstract);
        }
    }

    /** Get the Closure to be used when building a type. */
    protected getClosure(abstract: Abstract, concrete: Abstract): ContainerClosure
    {
        return (container: ContainerContract, parameters: ParameterOverrides) => {
            const target = container as unknown as Container;

            if (abstract === concrete) {
                return target.build(concrete);
            }

            return target.resolve(concrete, parameters, false);
        };
    }

    /** Determine if the container has a method binding. */
    public hasMethodBinding(method: string | [Abstract, string]): boolean
    {
        const [target, name] = this.parseBindMethod(method);

        return this.methodBindings.get(target)?.has(name) === true;
    }

    /** Bind a callback to resolve with Container::call. */
    public bindMethod(method: string | [Abstract, string], callback: MethodBindingClosure): void
    {
        const [target, name] = this.parseBindMethod(method);

        Util.setInto(this.methodBindings, target, name, callback);
    }

    /**
     * Get the target and method a binding is registered against.
     *
     * PHP flattens this into a `Class@method` string. A compiled class carries
     * no namespace, so two same-named classes would collide on such a key; the
     * target is kept as itself and the binding nests one level instead.
     */
    protected parseBindMethod(method: string | [Abstract, string]): [Abstract, string]
    {
        if (Util.isArray(method)) {
            return method as [Abstract, string];
        }

        const raw = method as string;
        const [position] = raw.find('@', 1, true);

        if (position === undefined) {
            return [
                raw,
                '',
            ];
        }

        return [
            raw.sub(1, position - 1),
            raw.sub(position + 1),
        ];
    }

    /** Get the method binding for the given method. */
    public callMethodBinding(method: string | [Abstract, string], instance: unknown): unknown
    {
        const [target, name] = this.parseBindMethod(method);

        return (this.methodBindings.get(target)?.get(name) as Callback)(instance, this);
    }

    /** Add a contextual binding to the container. */
    public addContextualBinding(
        concrete: BuildStackEntry,
        abstract: Abstract,
        implementation: ContextualImplementation,
    ): void
    {
        Util.setInto(this.contextual, concrete, this.getAlias(abstract), implementation);
    }

    /** Register a binding if it hasn't already been registered. */
    public bindIf(abstract: Abstract, concrete?: Concrete, shared = false): void
    {
        if (!this.bound(abstract)) {
            this.bind(abstract, concrete, shared);
        }
    }

    /** Register a shared binding in the container. */
    public singleton(abstract: Abstract, concrete?: Concrete): void
    {
        this.bind(abstract, concrete, true);
    }

    /** Register a shared binding if it hasn't already been registered. */
    public singletonIf(abstract: Abstract, concrete?: Concrete): void
    {
        if (!this.bound(abstract)) {
            this.singleton(abstract, concrete);
        }
    }

    /** Register a scoped binding in the container. */
    public scoped(abstract: Abstract, concrete?: Concrete): void
    {
        this.scopedInstances.push(abstract);

        this.singleton(abstract, concrete);
    }

    /** Register a scoped binding if it hasn't already been registered. */
    public scopedIf(abstract: Abstract, concrete?: Concrete): void
    {
        if (!this.bound(abstract)) {
            this.scoped(abstract, concrete);
        }
    }

    /** "Extend" an abstract type in the container. */
    public extend(abstract: Abstract, closure: ExtenderClosure): void
    {
        abstract = this.getAlias(abstract);

        if (this.instances.has(abstract)) {
            this.instances.set(abstract, closure(this.instances.get(abstract) as never, this) as defined);

            this.rebound(abstract);
        } else {
            Util.pushInto(this.extenders, abstract, closure);

            if (this.resolved(abstract)) {
                this.rebound(abstract);
            }
        }
    }

    /** Register an existing instance as shared in the container. */
    public instance<T extends defined>(abstract: Abstract, instance: T): T
    {
        this.removeAbstractAlias(abstract);

        const isBound = this.bound(abstract);

        this.aliases.delete(abstract);

        // We'll check to determine if this type has been bound before, and if it has
        // we will fire the rebound callbacks registered with the container and it
        // can be updated with consuming classes that have gotten resolved here.
        this.instances.set(abstract, instance);

        if (isBound) {
            this.rebound(abstract);
        }

        return instance;
    }

    /** Remove an alias from the contextual binding alias cache. */
    protected removeAbstractAlias(searched: Abstract): void
    {
        if (!this.aliases.has(searched)) {
            return;
        }

        for (const [abstract, aliases] of this.abstractAliases) {
            const remaining = new Array<Abstract>();

            for (const alias of aliases) {
                if (alias !== searched) {
                    remaining.push(alias);
                }
            }

            this.abstractAliases.set(abstract, remaining);
        }
    }

    /** Assign a set of tags to a given binding. */
    public tag(abstracts: Abstract | Array<Abstract>, ...tags: Array<string | Array<string>>): void
    {
        const tagList = Util.isArray(tags[0]) ? (tags[0] as Array<string>) : (tags as Array<string>);

        for (const tag of tagList) {
            if (!this.tags.has(tag)) {
                this.tags.set(tag, []);
            }

            for (const abstract of Util.arrayWrap(abstracts)) {
                (this.tags.get(tag) as Array<Abstract>).push(abstract);
            }
        }
    }

    /** Resolve all of the bindings for a given tag. */
    public tagged(tag: string): RewindableGenerator
    {
        const tagged = this.tags.get(tag);

        if (tagged === undefined) {
            return new RewindableGenerator(function*() {}, 0);
        }

        return new RewindableGenerator(Container.taggedSequence(this, tagged), tagged.size());
    }

    /**
     * The lazy sequence a tagged binding iterates.
     *
     * A generator cannot be an arrow function, so the container is taken as a
     * parameter rather than captured from `this`.
     */
    protected static taggedSequence(container: Container, tagged: Array<Abstract>): () => Generator<defined>
    {
        return function*() {
            for (const abstract of tagged) {
                yield container.make(abstract) as defined;
            }
        };
    }

    /** Alias a type to a different name. */
    public alias(abstract: Abstract, alias: Abstract): void
    {
        if (alias === abstract) {
            throw new LogicException(`[${Reflector.className(abstract)}] is aliased to itself.`);
        }

        this.removeAbstractAlias(alias);

        this.aliases.set(alias, abstract);

        Util.pushInto(this.abstractAliases, abstract, alias);
    }

    /** Bind a new callback to an abstract's rebind event. */
    public rebinding(abstract: Abstract, callback: ReboundCallback): unknown
    {
        abstract = this.getAlias(abstract);

        Util.pushInto(this.reboundCallbacks, abstract, callback);

        if (this.bound(abstract)) {
            return this.make(abstract);
        }

        return undefined;
    }

    /** Refresh an instance on the given target and method. */
    public refresh(abstract: Abstract, target: object, method: string): unknown
    {
        return this.rebinding(abstract, (app, instance) => {
            callMethod(target, method, instance);
        });
    }

    /** Fire the "rebound" callbacks for the given abstract type. */
    protected rebound(abstract: Abstract): void
    {
        const callbacks = this.getReboundCallbacks(abstract);

        if (callbacks.isEmpty()) {
            return;
        }

        const instance = this.make(abstract);

        for (const callback of callbacks) {
            callback(this, instance as never);
        }
    }

    /** Get the rebound callbacks for a given type. */
    protected getReboundCallbacks(abstract: Abstract): Array<ReboundCallback>
    {
        return this.reboundCallbacks.get(abstract) ?? [];
    }

    /** Wrap the given closure such that its dependencies will be injected when executed. */
    public wrap(callback: Callback, parameters?: ParameterList): () => unknown
    {
        return () => this.call(callback, parameters);
    }

    /**
     * Call the given Closure / class@method and inject its dependencies.
     *
     * PHP pushes the callable's scope class onto the build stack so contextual
     * bindings apply; a closure's scope cannot be recovered here, so only array
     * callables contribute a class.
     */
    public call(callback: CallableTarget, parameters?: ParameterList, defaultMethod?: string): unknown
    {
        let pushedToBuildStack = false;

        const className = this.getClassForCallable(callback);

        if (className !== undefined && !this.buildStack.includes(className)) {
            this.buildStack.push(className);

            pushedToBuildStack = true;
        }

        const result = BoundMethod.call(this, callback, this.normalizeParameters(parameters), defaultMethod);

        if (pushedToBuildStack) {
            this.buildStack.pop();
        }

        return result;
    }

    /** Get the class name for the given callback, if one can be determined. */
    protected getClassForCallable(callback: CallableTarget): Abstract | undefined
    {
        if (!Util.isArray(callback)) {
            return undefined;
        }

        const [target] = callback as [object | Abstract, string];

        if (typeIs(target, 'string')) {
            return undefined;
        }

        return (Reflector.isInstance(target) ? Reflector.classOf(target as object) : target) as Abstract | undefined;
    }

    /** Get a closure to resolve the given type from the container. */
    public factory(abstract: Abstract): () => unknown
    {
        return () => this.make(abstract);
    }

    /** An alias function name for make(). */
    public makeWith(abstract: Abstract, parameters?: ParameterList): unknown
    {
        return this.make(abstract, parameters);
    }

    /** Resolve the given type from the container. */
    public make<T extends object>(abstract: AbstractClass<T>, parameters?: ParameterList): T;
    public make<T>(abstract: Contract<T>, parameters?: ParameterList): T;
    public make<T = unknown>(abstract: string, parameters?: ParameterList): T;
    public make(abstract: Abstract, parameters?: ParameterList): unknown;
    public make(abstract: Abstract, parameters?: ParameterList): unknown
    {
        return this.resolve(abstract, this.normalizeParameters(parameters));
    }

    /** Resolve the given type from the container, as PSR-11's `get()`. */
    public get<T extends object>(id: AbstractClass<T>): T;
    public get<T>(id: Contract<T>): T;
    public get<T = unknown>(id: string): T;
    public get(id: Abstract): unknown;
    public get(id: Abstract): unknown
    {
        try {
            return this.resolve(id);
        } catch (e) {
            if (this.has(id) || e instanceof CircularDependencyException) {
                throw e;
            }

            throw new EntryNotFoundException(
                Reflector.className(id),
                e instanceof Exception ? e.getCode() : 0,
                e instanceof Exception ? e : undefined,
            );
        }
    }

    /** Resolve the given type from the container. */
    protected resolve(abstract: Abstract, parameters: ParameterOverrides = new Map(), raiseEvents = true): unknown
    {
        abstract = this.getAlias(abstract);

        // First we'll fire any event handlers which handle the "before" resolving of
        // specific types. This gives some hooks the chance to add various extends
        // calls to change the resolution of objects that they're interested in.
        if (raiseEvents) {
            this.fireBeforeResolvingCallbacks(abstract, parameters);
        }

        let concrete = this.getContextualConcrete(abstract);

        const needsContextualBuild = parameters.size() > 0 || concrete !== undefined;

        // If an instance of the type is currently being managed as a singleton we'll
        // just return an existing instance instead of instantiating new instances
        // so the developer can keep using the same objects instance every time.
        if (this.instances.has(abstract) && !needsContextualBuild) {
            return this.instances.get(abstract);
        }

        this.with.push(parameters);

        if (concrete === undefined) {
            concrete = this.getConcrete(abstract);
        }

        // We're ready to instantiate an instance of the concrete type registered for
        // the binding. This will instantiate the types, as well as resolve any of
        // its "nested" dependencies recursively until all have gotten resolved.
        let object = this.isBuildable(concrete as Concrete, abstract)
            ? this.build(concrete as Concrete)
            : this.make(concrete as Abstract);

        // If we defined any extenders for this type, we'll need to spin through them
        // and apply them to the object being built. This allows for the extension
        // of services, such as changing configuration or decorating the object.
        for (const extender of this.getExtenders(abstract)) {
            object = extender(object as never, this);
        }

        // If the requested type is registered as a singleton we'll want to cache off
        // the instances in "memory" so we can return it later without creating an
        // entirely new instance of an object on each subsequent request for it.
        if (this.isShared(abstract) && !needsContextualBuild) {
            this.instances.set(abstract, object as defined);
        }

        if (raiseEvents) {
            this.fireResolvingCallbacks(abstract, object);
        }

        // Before returning, we will also set the resolved flag to "true" and pop off
        // the parameter overrides for this build. After those two things are done
        // we will be ready to return back the fully constructed class instance.
        if (!needsContextualBuild) {
            this._resolved.set(abstract, true);
        }

        this.with.pop();

        return object;
    }

    /** Get the concrete type for a given abstract. */
    protected getConcrete(abstract: Abstract): Concrete
    {
        // If we don't have a registered resolver or concrete for the type, we'll just
        // assume each type is a concrete name and will attempt to resolve it as is
        // since the container should be able to resolve concretes automatically.
        const binding = this.bindings.get(abstract);

        if (binding !== undefined) {
            return binding.concrete;
        }

        if (
            this.environmentResolver === undefined
            || this.checkedForAttributeBindings.get(abstract) === true
            || !Util.isClass(abstract)
        ) {
            return abstract;
        }

        return this.getConcreteBindingFromAttributes(abstract);
    }

    /** Get the concrete binding for an abstract from the Bind attribute. */
    protected getConcreteBindingFromAttributes(abstract: Abstract): Concrete
    {
        this.checkedForAttributeBindings.set(abstract, true);

        const concrete = this.resolveConcreteFromAttributes(abstract);

        if (concrete === undefined) {
            return abstract;
        }

        const scopedType = this.getScopedTyped(abstract);

        if (scopedType === 'scoped') {
            this.scoped(abstract, concrete);
        } else if (scopedType === 'singleton') {
            this.singleton(abstract, concrete);
        } else {
            this.bind(abstract, concrete);
        }

        return (this.bindings.get(abstract) as Binding).concrete;
    }

    /** Resolve the concrete from the Bind attributes in declaration order. */
    protected resolveConcreteFromAttributes(abstract: Abstract): Concrete | undefined
    {
        let wildcard: Concrete | undefined;

        for (const attribute of Attributes.get<Bind>(abstract, Bind)) {
            if (attribute.environments.size() === 1 && attribute.environments[0] === '*') {
                wildcard ??= attribute.concrete;

                continue;
            }

            if (this.currentEnvironmentIs(attribute.environments)) {
                return attribute.concrete;
            }
        }

        return wildcard;
    }

    /** Get the contextual concrete binding for the given abstract. */
    protected getContextualConcrete(abstract: Abstract): ContextualImplementation | undefined
    {
        const binding = this.findInContextualBindings(abstract);

        if (binding !== undefined) {
            return binding;
        }

        // Next we need to see if a contextual binding might be bound under an alias of the
        // given abstract type. So, we will need to check if any aliases exist with this
        // type and then spin through them and check for contextual bindings on these.
        const aliases = this.abstractAliases.get(abstract);

        if (aliases === undefined || aliases.isEmpty()) {
            return undefined;
        }

        for (const alias of aliases) {
            const aliasBinding = this.findInContextualBindings(alias);

            if (aliasBinding !== undefined) {
                return aliasBinding;
            }
        }

        return undefined;
    }

    /** Find the concrete binding for the given abstract in the contextual binding array. */
    protected findInContextualBindings(abstract: Abstract): ContextualImplementation | undefined
    {
        const context = this.buildStack[this.buildStack.size() - 1];

        if (context === undefined) {
            return undefined;
        }

        return this.contextual.get(context)?.get(abstract);
    }

    /** Determine if the given concrete is buildable. */
    protected isBuildable(concrete: Concrete, abstract: Abstract): boolean
    {
        return concrete === abstract || typeIs(concrete, 'function');
    }

    /** Instantiate a concrete instance of the given type. */
    public build(concrete: Concrete): unknown
    {
        // If the concrete type is actually a Closure, we will just execute it and
        // hand back the results of the functions, which allows functions to be
        // used as resolvers for more fine-tuned resolution of these objects.
        if (typeIs(concrete, 'function')) {
            this.buildStack.push(concrete);

            try {
                return concrete(this, this.getLastParameterOverride());
            } finally {
                this.buildStack.pop();
            }
        }

        if (!typeIs(concrete, 'table')) {
            throw new BindingResolutionException(`Target class [${concrete}] does not exist.`);
        }

        // If the type is not instantiable, the developer is attempting to resolve
        // an abstract type such as an Interface or Abstract Class and there is
        // no binding registered for the abstractions so we need to bail out.
        if (!this.isInstantiable(concrete)) {
            return this.notInstantiable(concrete);
        }

        if (isSelfBuilding(concrete) && !this.buildStack.includes(concrete)) {
            return this.buildSelfBuildingInstance(concrete);
        }

        this.buildStack.push(concrete);

        const dependencies = getInjectedDependencies(concrete);

        // If there are no declared dependencies, that means there is nothing to
        // resolve first and we can just build the instance right away, without
        // resolving any other types or dependencies out of these containers.
        if (dependencies.isEmpty()) {
            this.buildStack.pop();

            const built = new (concrete as Constructor)();

            this.fireAfterResolvingAttributeCallbacks(Attributes.all(concrete) as Array<ParameterAttribute>, built);

            return built;
        }

        // Once we have all the constructor's parameters we can create each of the
        // dependency instances and then use them to make a new instance of this
        // class, injecting the created dependencies in.
        let instances: Array<defined>;

        try {
            instances = this.resolveDependencies(dependencies);
        } finally {
            this.buildStack.pop();
        }

        const built = new (concrete as Constructor)(...(instances as Array<never>));

        this.fireAfterResolvingAttributeCallbacks(Attributes.all(concrete) as Array<ParameterAttribute>, built);

        return built;
    }

    /**
     * Determine whether the given class can be instantiated.
     *
     * PHP: `(new ReflectionClass($concrete))->isInstantiable()`. roblox-ts emits
     * a `new` constructor function on concrete classes and never on abstract
     * ones, so its presence on the class table itself is the test.
     */
    protected isInstantiable(concrete: object): boolean
    {
        return typeIs(rawget(concrete, 'new'), 'function');
    }

    /** Instantiate a concrete instance of the given self building type. */
    protected buildSelfBuildingInstance(concrete: object): unknown
    {
        if (!methodExists(concrete, 'newInstance')) {
            throw new BindingResolutionException(
                `No newInstance method exists for [${Reflector.className(concrete)}].`,
            );
        }

        this.buildStack.push(concrete as Abstract);

        const instance = this.call([
            concrete as Abstract,
            'newInstance',
        ]);

        this.buildStack.pop();

        this.fireAfterResolvingAttributeCallbacks(Attributes.all(concrete) as Array<ParameterAttribute>, instance);

        return instance;
    }

    /**
     * Resolve all of the dependencies declared on the parameters.
     *
     * PHP walks `ReflectionParameter`s, which also carry default values,
     * variadics and nullability; only the first of those survives compilation,
     * and only for trailing parameters -- an unannotated parameter simply gets
     * no argument, so its TypeScript default applies.
     */
    protected resolveDependencies(dependencies: Array<ParameterDependency>): Array<defined>
    {
        const results = new Array<defined>();

        for (let index = 0; index < dependencies.size(); index++) {
            const dependency = dependencies[index];

            // If the dependency has an override for this particular build we will use
            // that instead as the value. Otherwise, we will continue with this run
            // of resolutions and let the annotation determine the result.
            if (this.hasParameterOverride(dependency, index + 1)) {
                results.push(this.getParameterOverride(dependency, index + 1) as defined);

                continue;
            }

            let result: unknown;

            const attribute = Util.getContextualAttributeFromDependency(dependency);

            if (attribute !== undefined) {
                result = this.resolveFromAttribute(attribute);
            }

            if (result === undefined) {
                result = this.resolveDeclaredDependency(dependency, index + 1);
            }

            this.fireAfterResolvingAttributeCallbacks(dependency.attributes, result);

            // A variadic parameter contributes its elements, not the list.
            // PHP: `array_merge($results, is_array($result) ? $result : [$result])`
            // -- the resolver hands back a list for a variadic that resolved
            // several dependencies and a bare instance for one, and both have
            // to end up spread.
            if (dependency.variadic === true) {
                for (const value of Util.arrayWrap(result as defined | Array<defined> | undefined)) {
                    results.push(value);
                }

                continue;
            }

            results.push(result as defined);
        }

        return results;
    }

    /** Resolve the abstract a parameter named, once the attributes had their say. */
    protected resolveDeclaredDependency(dependency: ParameterDependency, position: number): unknown
    {
        const abstract = dependency.abstract;

        if (abstract === undefined) {
            throw new BindingResolutionException(
                `Unresolvable dependency: parameter #${position} declares no binding. `
                    + `Annotate it with Inject or a contextual attribute.`,
            );
        }

        const variadic = dependency.variadic === true;

        return this.isPrimitive(abstract)
            ? this.resolvePrimitive(abstract, variadic)
            : this.resolveClass(abstract, variadic);
    }

    /** A dependency spelled `"$name"` asks for a contextually bound primitive. */
    protected isPrimitive(dependency: Abstract): boolean
    {
        return typeIs(dependency, 'string') && dependency.sub(1, 1) === '$';
    }

    /** Determine if the given dependency has a parameter override. */
    protected hasParameterOverride(dependency: ParameterDependency, index: number): boolean
    {
        const overrides = this.getLastParameterOverride();

        return (dependency.abstract !== undefined && overrides.has(dependency.abstract)) || overrides.has(index);
    }

    /** Get a parameter override for a dependency. */
    protected getParameterOverride(dependency: ParameterDependency, index: number): unknown
    {
        const overrides = this.getLastParameterOverride();

        return dependency.abstract !== undefined && overrides.has(dependency.abstract)
            ? overrides.get(dependency.abstract)
            : overrides.get(index);
    }

    /**
     * Resolve a dependency based on an attribute.
     *
     * The handler is the one registered with `whenHasAttribute()`, falling back
     * to the `resolve` the attribute itself carries.
     */
    public resolveFromAttribute(attribute: ParameterAttribute): unknown
    {
        const [factory, instance] = attribute;

        const handler = this.contextualAttributes.get(factory) ?? instance.resolve;

        if (handler === undefined) {
            throw new BindingResolutionException(
                `Contextual binding attribute [${Reflector.className(factory)}] has no registered handler.`,
            );
        }

        return handler(instance as never, this);
    }

    /** Fire all of the after resolving attribute callbacks. */
    public fireAfterResolvingAttributeCallbacks(attributes: Array<ParameterAttribute>, object: unknown): void
    {
        for (const [factory, instance] of attributes) {
            if (instance.after !== undefined) {
                instance.after(instance as never, object as never, this);
            }

            for (const callback of this.afterResolvingAttributeCallbacks.get(factory) ?? []) {
                callback(instance as never, object as never, this);
            }
        }
    }

    /** Get the last parameter override. */
    protected getLastParameterOverride(): ParameterOverrides
    {
        return this.with[this.with.size() - 1] ?? new Map();
    }

    /** Resolve a non-class hinted primitive dependency. */
    protected resolvePrimitive(parameter: Abstract, variadic = false): unknown
    {
        const concrete = this.getContextualConcrete(parameter);

        if (concrete !== undefined) {
            return Util.unwrapIfClosure(concrete, this);
        }

        // PHP falls back to the parameter's default value, then to an empty list
        // for a variadic, then to null for a nullable type. Only the variadic
        // case survives compilation; a default is handled by leaving a trailing
        // parameter unannotated.
        if (variadic) {
            return [];
        }

        return this.unresolvablePrimitive(parameter);
    }

    /** Resolve a class based dependency from the container. */
    protected resolveClass(parameter: Abstract, variadic = false): unknown
    {
        if (!variadic) {
            return this.make(parameter);
        }

        // If we can not resolve the class instance we return an empty list, the
        // same way PHP does for a variadic that has nothing bound to it.
        const [ok, resolved] = pcall(() => this.resolveVariadicClass(parameter));

        if (!ok) {
            if (resolved instanceof BindingResolutionException) {
                this.with.pop();

                return [];
            }

            throw resolved;
        }

        return resolved;
    }

    /** Resolve a class based variadic dependency from the container. */
    protected resolveVariadicClass(parameter: Abstract): unknown
    {
        const abstract = this.getAlias(parameter);
        const concrete = this.getContextualConcrete(abstract);

        if (!Util.isArray(concrete)) {
            // PHP returns `$this->make($className)` as-is, and deliberately:
            // a contextual binding registered through `giveTagged()` is a
            // closure, not a list, so this branch is the one it takes, and
            // `make()` running that closure is what yields the whole tagged
            // list. Wrapping it here would hand the variadic a single
            // dependency that happens to be an array.
            return this.make(parameter);
        }

        const resolved = new Array<defined>();

        for (const entry of concrete as unknown as Array<Abstract>) {
            resolved.push(this.resolve(entry) as defined);
        }

        return resolved;
    }

    /** Throw an exception that the concrete is not instantiable. */
    protected notInstantiable(concrete: Abstract): never
    {
        let message: string;

        if (!this.buildStack.isEmpty()) {
            const names = new Array<string>();

            for (const entry of this.buildStack) {
                names.push(Reflector.className(entry));
            }

            message = `Target [${Reflector.className(concrete)}] is not instantiable while building [${
                names.join(', ')
            }].`;
        } else {
            message = `Target [${Reflector.className(concrete)}] is not instantiable.`;
        }

        throw new BindingResolutionException(message);
    }

    /** Throw an exception for an unresolvable primitive. */
    protected unresolvablePrimitive(parameter: Abstract): never
    {
        throw new BindingResolutionException(`Unresolvable dependency resolving [${Reflector.className(parameter)}].`);
    }

    /** Register a new before resolving callback for all types. */
    public beforeResolving(abstract: Abstract | BeforeResolvingCallback, callback?: BeforeResolvingCallback): void
    {
        if (!typeIs(abstract, 'function')) {
            abstract = this.getAlias(abstract);
        }

        if (typeIs(abstract, 'function') && callback === undefined) {
            this.globalBeforeResolvingCallbacks.push(abstract as BeforeResolvingCallback);
        } else {
            this.beforeResolvingCallbacks.push(abstract as Abstract, callback as BeforeResolvingCallback);
        }
    }

    /** Register a new resolving callback. */
    public resolving(abstract: Abstract | ResolvingCallback, callback?: ResolvingCallback): void
    {
        if (!typeIs(abstract, 'function')) {
            abstract = this.getAlias(abstract);
        }

        if (callback === undefined && typeIs(abstract, 'function')) {
            this.globalResolvingCallbacks.push(abstract as ResolvingCallback);
        } else {
            this.resolvingCallbacks.push(abstract as Abstract, callback as ResolvingCallback);
        }
    }

    /** Register a new after resolving callback for all types. */
    public afterResolving(abstract: Abstract | ResolvingCallback, callback?: ResolvingCallback): void
    {
        if (!typeIs(abstract, 'function')) {
            abstract = this.getAlias(abstract);
        }

        if (typeIs(abstract, 'function') && callback === undefined) {
            this.globalAfterResolvingCallbacks.push(abstract as ResolvingCallback);
        } else {
            this.afterResolvingCallbacks.push(abstract as Abstract, callback as ResolvingCallback);
        }
    }

    /** Fire all of the before resolving callbacks. */
    protected fireBeforeResolvingCallbacks(abstract: Abstract, parameters: ParameterOverrides): void
    {
        this.fireBeforeCallbackArray(abstract, parameters, this.globalBeforeResolvingCallbacks);

        for (const [abstractType, callbacks] of this.beforeResolvingCallbacks.entries()) {
            if (abstractType === abstract || Reflector.isSubclassOf(abstract, abstractType)) {
                this.fireBeforeCallbackArray(abstract, parameters, callbacks);
            }
        }
    }

    /** Fire an array of callbacks with an object. */
    protected fireBeforeCallbackArray(
        abstract: Abstract,
        parameters: ParameterOverrides,
        callbacks: Array<BeforeResolvingCallback>,
    ): void
    {
        for (const callback of callbacks) {
            callback(abstract, parameters, this);
        }
    }

    /** Fire all of the resolving callbacks. */
    protected fireResolvingCallbacks(abstract: Abstract, object: unknown): void
    {
        this.fireCallbackArray(object, this.globalResolvingCallbacks);

        this.fireCallbackArray(object, this.getCallbacksForType(abstract, object, this.resolvingCallbacks));

        this.fireAfterResolvingCallbacks(abstract, object);
    }

    /** Fire all of the after resolving callbacks. */
    protected fireAfterResolvingCallbacks(abstract: Abstract, object: unknown): void
    {
        this.fireCallbackArray(object, this.globalAfterResolvingCallbacks);

        this.fireCallbackArray(object, this.getCallbacksForType(abstract, object, this.afterResolvingCallbacks));
    }

    /** Get all callbacks for a given type. */
    protected getCallbacksForType(
        abstract: Abstract,
        object: unknown,
        callbacksPerType: OrderedMap<Abstract, Array<ResolvingCallback>>,
    ): Array<ResolvingCallback>
    {
        let results = new Array<ResolvingCallback>();

        for (const [abstractType, callbacks] of callbacksPerType.entries()) {
            if (abstractType === abstract || Reflector.isInstanceOf(object, abstractType)) {
                results = Arr.merge(results, callbacks);
            }
        }

        return results;
    }

    /** Fire an array of callbacks with an object. */
    protected fireCallbackArray(object: unknown, callbacks: Array<ResolvingCallback>): void
    {
        for (const callback of callbacks) {
            callback(object as never, this);
        }
    }

    /** Get the name of the binding the container is currently resolving. */
    public currentlyResolving(): BuildStackEntry | undefined
    {
        return this.buildStack[this.buildStack.size() - 1];
    }

    /** Get the container's bindings. */
    public getBindings(): Array<[Abstract, Binding]>
    {
        return this.bindings.entries();
    }

    /** Get the alias for an abstract if available. */
    public getAlias(abstract: Abstract): Abstract
    {
        const seen = new Map<Abstract, boolean>();

        while (this.aliases.has(abstract)) {
            if (seen.has(abstract)) {
                throw new LogicException(`Circular alias reference for [${Reflector.className(abstract)}].`);
            }

            seen.set(abstract, true);

            abstract = this.aliases.get(abstract) as Abstract;
        }

        return abstract;
    }

    /** Get the extender callbacks for a given type. */
    protected getExtenders(abstract: Abstract): Array<ExtenderClosure>
    {
        return this.extenders.get(this.getAlias(abstract)) ?? [];
    }

    /** Remove all of the extender callbacks for a given type. */
    public forgetExtenders(abstract: Abstract): void
    {
        this.extenders.delete(this.getAlias(abstract));
    }

    /** Drop all of the stale instances and aliases. */
    protected dropStaleInstances(abstract: Abstract): void
    {
        this.instances.delete(abstract);
        this.aliases.delete(abstract);
    }

    /** Remove a resolved instance from the instance cache. */
    public forgetInstance(abstract: Abstract): void
    {
        this.instances.delete(abstract);
    }

    /** Clear all of the instances from the container. */
    public forgetInstances(): void
    {
        this.instances.clear();
    }

    /** Clear all of the scoped instances from the container. */
    public forgetScopedInstances(): void
    {
        for (const scoped of this.scopedInstances) {
            this.instances.delete(scoped);
        }
    }

    /** Set the callback which determines the current container environment. */
    public resolveEnvironmentUsing(callback?: EnvironmentResolver): void
    {
        this.environmentResolver = callback;
    }

    /** Determine the environment for the container. */
    public currentEnvironmentIs(environments: Array<string> | string): boolean
    {
        return this.environmentResolver === undefined ? false : this.environmentResolver(environments) === true;
    }

    /**
     * Copy this container's state onto another one.
     *
     * PHP: what `clone $container` does on its own. Its arrays are values, so
     * cloning copies every one of them and leaves the objects inside shared --
     * a copy resolves and forgets without the original noticing, while both
     * hand out the same singletons. Nothing in Luau copies on assignment, so
     * the same thing has to be written out: every map and array copied one
     * level deep, everything they hold shared.
     *
     * The two stacks are deliberately not copied: they belong to a resolution
     * in progress, and a copy is not in one.
     */
    protected copyStateTo(target: Container): void
    {
        target._resolved = table.clone(this._resolved);
        target.bindings = this.bindings.clone();
        target.methodBindings = Container.cloneNestedMap(this.methodBindings);
        target.instances = table.clone(this.instances);
        target.scopedInstances = table.clone(this.scopedInstances);
        target.aliases = table.clone(this.aliases);
        target.abstractAliases = Container.cloneNestedMap(this.abstractAliases);
        target.extenders = Container.cloneNestedMap(this.extenders);
        target.tags = Container.cloneNestedMap(this.tags);

        target.buildStack = new Array<BuildStackEntry>();
        target.with = new Array<ParameterOverrides>();

        target.contextual = Container.cloneNestedMap(this.contextual);
        target.contextualAttributes = table.clone(this.contextualAttributes);
        target.afterResolvingAttributeCallbacks = Container.cloneNestedMap(this.afterResolvingAttributeCallbacks);

        target.checkedForAttributeBindings = table.clone(this.checkedForAttributeBindings);
        target.checkedForSingletonOrScopedAttributes = table.clone(this.checkedForSingletonOrScopedAttributes);

        target.reboundCallbacks = Container.cloneNestedMap(this.reboundCallbacks);
        target.beforeResolvingCallbacks = Container.cloneArrayMap(this.beforeResolvingCallbacks);
        target.resolvingCallbacks = Container.cloneArrayMap(this.resolvingCallbacks);
        target.afterResolvingCallbacks = Container.cloneArrayMap(this.afterResolvingCallbacks);

        target.globalBeforeResolvingCallbacks = table.clone(this.globalBeforeResolvingCallbacks);
        target.globalResolvingCallbacks = table.clone(this.globalResolvingCallbacks);
        target.globalAfterResolvingCallbacks = table.clone(this.globalAfterResolvingCallbacks);

        target.environmentResolver = this.environmentResolver;
    }

    /** Copy an ordered map of arrays, arrays included. */
    private static cloneArrayMap<K extends defined, V extends defined>(
        source: OrderedMap<K, Array<V>>,
    ): OrderedMap<K, Array<V>>
    {
        const copy = new OrderedMap<K, Array<V>>();

        for (const [key, value] of source.entries()) {
            copy.set(key, table.clone(value));
        }

        return copy;
    }

    /** Copy a map one level deep: the inner tables copied, what they hold shared. */
    private static cloneNestedMap<K extends defined, V extends object>(source: Map<K, V>): Map<K, V>
    {
        const copy = new Map<K, V>();

        for (const [key, value] of source) {
            copy.set(key, table.clone(value));
        }

        return copy;
    }

    /** Flush the container of all bindings and resolved instances. */
    public flush(): void
    {
        this.aliases.clear();
        this._resolved.clear();
        this.bindings.clear();
        this.instances.clear();
        this.abstractAliases.clear();
        this.scopedInstances.clear();
        this.checkedForAttributeBindings.clear();
        this.checkedForSingletonOrScopedAttributes.clear();
    }

    /** Get the globally available instance of the container. */
    public static getInstance(): Container
    {
        Container._instance ??= new Container();

        return Container._instance;
    }

    /**
     * Determine if a given offset exists.
     *
     * PHP reaches these four through `ArrayAccess` (`$app['events']`) and
     * `__get` / `__set`. Neither syntax exists here: an index and a property
     * access are the same expression in TypeScript, and intercepting it would
     * mean putting a Luau function on `__index` of the framework's hottest
     * object -- one that also fires for every unset optional field. The methods
     * themselves are public API in PHP, so they are ported; the sugar is not.
     */
    public offsetExists(offset: Abstract): boolean
    {
        return this.bound(offset);
    }

    /** Get the value at a given offset. */
    public offsetGet(offset: Abstract): unknown
    {
        return this.make(offset);
    }

    /** Set the value at a given offset. */
    public offsetSet(offset: Abstract, value: unknown): void
    {
        this.bind(offset, typeIs(value, 'function') ? (value as ContainerClosure) : () => value);
    }

    /** Unset the value at a given offset. */
    public offsetUnset(offset: Abstract): void
    {
        this.bindings.delete(offset);
        this.instances.delete(offset);
        this._resolved.delete(offset);
    }

    /** Set the shared instance of the container. */
    public static setInstance(container?: Container): Container | undefined
    {
        Container._instance = container;

        return container;
    }

    /**
     * Normalize the public `$parameters` argument into the override map.
     *
     * A plain list is read as position-keyed overrides, which is the closest
     * thing to PHP's positional-by-name matching that survives compilation.
     * The positions are numbered from one, like a Luau list's own indices --
     * which is what keeps the two forms from colliding. A `Map` holding only
     * the key `1` *is* the one-element list `[value]` as far as Luau is
     * concerned, and there is no telling them apart; numbering from one at
     * least makes them mean the same thing. Numbered from zero they would
     * not, and overriding the second parameter alone would be unsayable.
     */
    protected normalizeParameters(parameters?: ParameterList): ParameterOverrides
    {
        if (parameters === undefined) {
            return new Map();
        }

        if (!Util.isArray(parameters)) {
            return parameters as ParameterOverrides;
        }

        const overrides: ParameterOverrides = new Map();
        const list = parameters as Array<unknown>;

        for (let index = 0; index < list.size(); index++) {
            overrides.set(index + 1, list[index]);
        }

        return overrides;
    }
}
