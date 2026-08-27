import { ApplicationBuilder } from "Illuminate/Foundation/Configuration/ApplicationBuilder";
import { BusServiceProvider } from "Illuminate/Bus/BusServiceProvider";
import { Container } from "Illuminate/Container/Container";
import { ContextServiceProvider } from "Illuminate/Log/Context/ContextServiceProvider";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { EventServiceProvider } from "Illuminate/Events/EventServiceProvider";
import { FoundationServiceProvider } from "Illuminate/Foundation/Providers/FoundationServiceProvider";
import { LogManager } from "Illuminate/Log/LogManager";
import { LogServiceProvider } from "Illuminate/Log/LogServiceProvider";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { PipelineServiceProvider } from "Illuminate/Pipeline/PipelineServiceProvider";
import { ProviderRepository } from "Illuminate/Foundation/ProviderRepository";
import { QueueManager } from "Illuminate/Queue/QueueManager";
import { Reflector } from "Illuminate/Support/Reflector";
import { Repository as ConfigRepository } from "Illuminate/Config/Repository";
import { RoutingServiceProvider } from "Illuminate/Routing/RoutingServiceProvider";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import { Str } from "Illuminate/Support/Str";
import { Util } from "Illuminate/Container/Util";
import { Worker } from "Illuminate/Foundation/Runtime/Worker";
import type {
    Abstract,
    AbstractClass,
    CallableTarget,
    Constructor,
    ParameterList,
    ParameterOverrides,
} from "Illuminate/Container/Types";
import type {
    Application as ApplicationContract,
    Bootstrapper,
} from "Illuminate/Contracts/Foundation/Application";
import type { Dispatcher as DispatcherContract } from "Illuminate/Contracts/Events/Dispatcher";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Request } from "Illuminate/Http/Request";
import type { Response } from "Illuminate/Http/Response";

/**
 * PHP: `Illuminate\Foundation\Application`.
 *
 * Everything the class does with the filesystem, the environment file, HTTP
 * requests, the console, maintenance mode, localization and package discovery
 * is absent: a place has none of those. What remains is the part that matters
 * here -- the container, the provider lifecycle and the bootstrap sequence.
 */
export class Application extends Container implements ApplicationContract {
    /** The framework version. */
    public static readonly VERSION = "0.2.1";

    /**
     * Indicates if the application has been bootstrapped before.
     *
     * PHP names this `$hasBeenBootstrapped`; renamed because the accessor of
     * that name is public API and Luau cannot hold both.
     */
    protected bootstrapped = false;

    /**
     * Indicates if the application has "booted".
     *
     * PHP names this `$booted`, which collides with the `booted()` listener.
     */
    protected hasBooted = false;

    /** The array of registered callbacks. */
    protected registeredCallbacks = new Array<Callback>();

    /** The array of booting callbacks. */
    protected bootingCallbacks = new Array<Callback>();

    /** The array of booted callbacks. */
    protected bootedCallbacks = new Array<Callback>();

    /** The array of terminating callbacks. */
    protected terminatingCallbacks = new Array<CallableTarget>();

    /** All of the registered service providers. */
    protected serviceProviders = new OrderedMap<
        Constructor<ServiceProvider>,
        ServiceProvider
    >();

    /** The names of the loaded service providers. */
    protected loadedProviders = new OrderedMap<
        Constructor<ServiceProvider>,
        boolean
    >();

    /** The deferred services and their providers. */
    protected deferredServices = new OrderedMap<
        Abstract,
        Constructor<ServiceProvider>
    >();

    /** The application builder class. */
    protected static applicationBuilder: typeof ApplicationBuilder =
        ApplicationBuilder;

    /**
     * Create a new application instance.
     *
     * `bare` is what PHP gets for free from `clone`, which never runs a
     * constructor: a sandbox must not register the base bindings and providers
     * a second time -- `copyStateTo()` is about to overwrite them -- and above
     * all must not take the global container instance away from the root
     * application, which `registerBaseBindings()` would do.
     */
    public constructor(bare = false) {
        super();

        if (bare) {
            return;
        }

        this.registerBaseBindings();
        this.registerBaseServiceProviders();
        this.registerCoreContainerAliases();
    }

    /**
     * Get a copy of the application to handle a single request with.
     *
     * PHP: `clone $this->app` in `Laravel\Octane\Worker::handle()`. The place
     * outlives every request the way an Octane worker outlives one, so the
     * application cannot be torn down with the response the way PHP's is; it
     * also cannot be handed to the request as is, or whatever the request
     * resolves, rebinds or forgets would still be there for the next one.
     *
     * So the request gets a copy. It shares every singleton the root has
     * already resolved -- that is the point of booting once -- but owns the
     * maps holding them, and is thrown away by `flush()` when the response is
     * out. The root is neither flushed nor terminated.
     */
    public sandbox(): Application {
        const sandbox = new Application(true);

        this.copyStateTo(sandbox);

        // PHP: `CurrentApplication::set()`. The two keys the container answers
        // itself under have to point at the copy, or everything resolved
        // through them would reach past the sandbox into the root.
        sandbox.instance("app", sandbox);
        sandbox.instance(Container, sandbox);

        return sandbox;
    }

    /** Copy this application's state onto another one. */
    protected copyStateTo(target: Container): void {
        super.copyStateTo(target);

        const app = target as Application;

        app.bootstrapped = this.bootstrapped;
        app.hasBooted = this.hasBooted;

        app.registeredCallbacks = table.clone(this.registeredCallbacks);
        app.bootingCallbacks = table.clone(this.bootingCallbacks);
        app.bootedCallbacks = table.clone(this.bootedCallbacks);
        app.terminatingCallbacks = table.clone(this.terminatingCallbacks);

        app.serviceProviders = this.serviceProviders.clone();
        app.loadedProviders = this.loadedProviders.clone();
        app.deferredServices = this.deferredServices.clone();
    }

    /**
     * Begin configuring a new application instance.
     *
     * PHP takes a base path and infers one when omitted; there is no filesystem
     * here, so the configuration is handed over with `withConfig()` instead.
     */
    public static configure(config: ArrayAccessible): ApplicationBuilder {
        return new Application.applicationBuilder(new Application())
            .withConfig(config)
            .withKernels();
    }

    /** Get the version number of the application. */
    public version(): string {
        return Application.VERSION;
    }

    /** Register the basic bindings into the container. */
    protected registerBaseBindings(): void {
        Container.setInstance(this);

        this.instance("app", this);

        this.instance(Container, this);
    }

    /** Register all of the base service providers. */
    protected registerBaseServiceProviders(): void {
        this.register(new EventServiceProvider(this));
        this.register(new LogServiceProvider(this));
        this.register(new ContextServiceProvider(this));

        // PHP lists the bus among the framework defaults rather than the base
        // providers; there is no `DefaultProviders` here yet, and every queued
        // job needs the dispatcher to exist.
        this.register(new BusServiceProvider(this));
        this.register(new PipelineServiceProvider(this));
        this.register(new RoutingServiceProvider(this));

        // Same reason, and the same list -- `Support\DefaultProviders` holds
        // this one too. It registers the outbound HTTP client, which is what
        // the `Http` facade resolves; without it here, every game would have to
        // name a framework provider in its own `app.providers`, which is
        // something no Laravel application ever does.
        this.register(new FoundationServiceProvider(this));
    }

    /** Run the given array of bootstrap classes. */
    public bootstrapWith(
        bootstrappers: Array<Constructor<Bootstrapper>>,
    ): void {
        this.bootstrapped = true;

        for (const bootstrapper of bootstrappers) {
            const events = this.make<DispatcherContract>("events");
            const name = Reflector.className(bootstrapper);

            events.dispatch(`bootstrapping: ${name}`, [this]);

            this.make(bootstrapper).bootstrap(this);

            events.dispatch(`bootstrapped: ${name}`, [this]);
        }
    }

    /** Register a callback to run before a bootstrapper. */
    public beforeBootstrapping(
        bootstrapper: Constructor<Bootstrapper>,
        callback: Callback,
    ): void {
        this.make<DispatcherContract>("events").listen(
            `bootstrapping: ${Reflector.className(bootstrapper)}`,
            callback,
        );
    }

    /** Register a callback to run after a bootstrapper. */
    public afterBootstrapping(
        bootstrapper: Constructor<Bootstrapper>,
        callback: Callback,
    ): void {
        this.make<DispatcherContract>("events").listen(
            `bootstrapped: ${Reflector.className(bootstrapper)}`,
            callback,
        );
    }

    /** Determine if the application has been bootstrapped before. */
    public hasBeenBootstrapped(): boolean {
        return this.bootstrapped;
    }

    /** Determine if middleware has been disabled for the application. */
    public shouldSkipMiddleware(): boolean {
        return (
            this.bound("middleware.disable") &&
            this.make("middleware.disable") === true
        );
    }

    /** Get or check the current application environment. */
    public environment(
        ...environments: Array<string | Array<string>>
    ): string | boolean {
        const current = this.make<string>("env");

        if (!environments.isEmpty()) {
            const patterns = Util.isArray(environments[0])
                ? (environments[0] as Array<string>)
                : (environments as Array<string>);

            return Str.is(patterns, current);
        }

        return current;
    }

    /** Detect the application's current environment. */
    public detectEnvironment(callback: () => string): string {
        return this.instance("env", callback());
    }

    /** Determine if the application is in the local environment. */
    public isLocal(): boolean {
        return this.make<string>("env") === "local";
    }

    /** Determine if the application is in the production environment. */
    public isProduction(): boolean {
        return this.make<string>("env") === "production";
    }

    /** Register a new registered listener. */
    public registered(callback: Callback): void {
        this.registeredCallbacks.push(callback);
    }

    /**
     * Register all of the configured providers.
     *
     * PHP partitions the list so framework providers register first and folds in
     * the packages Composer discovered; there is no package manifest here, so the
     * configured order is the order.
     */
    public registerConfiguredProviders(): void {
        const providers = (this.make<ConfigRepository>("config").get(
            "app.providers",
            [],
        ) ?? []) as Array<Constructor<ServiceProvider>>;

        new ProviderRepository(this).load(providers);

        this.fireAppCallbacks(this.registeredCallbacks);
    }

    /** Register a service provider with the application. */
    public register(
        provider: ServiceProvider | Constructor<ServiceProvider>,
        force = false,
    ): ServiceProvider {
        const registered = this.getProvider(provider);

        if (registered !== undefined && !force) {
            return registered;
        }

        // If the given "provider" is a class, we will resolve it, passing in the
        // application instance automatically for the developer. This is simply
        // a more convenient way of specifying your service provider classes.
        let instance = Reflector.isInstance(provider)
            ? (provider as ServiceProvider)
            : this.resolveProvider(provider as Constructor<ServiceProvider>);

        instance.register();

        // If there are bindings / singletons set as properties on the provider we
        // will spin through them and register them with the application, which
        // serves as a convenience layer while registering a lot of bindings.
        if (instance.bindings !== undefined) {
            for (const [key, value] of instance.bindings) {
                this.bind(key, value);
            }
        }

        if (instance.singletons !== undefined) {
            for (const entry of instance.singletons) {
                if (Util.isArray(entry)) {
                    const [key, value] = entry as [Abstract, Constructor];

                    this.singleton(key, value);
                } else {
                    this.singleton(entry as Abstract);
                }
            }
        }

        this.markAsRegistered(instance);

        // If the application has already booted, we will call this boot method on
        // the provider class so it has an opportunity to do its boot logic and
        // will be ready for any usage by this developer's application logic.
        if (this.isBooted()) {
            this.bootProvider(instance);
        }

        return instance;
    }

    /** Get the registered service provider instance if it exists. */
    public getProvider(
        provider: ServiceProvider | Constructor<ServiceProvider>,
    ): ServiceProvider | undefined {
        return this.serviceProviders.get(this.providerClass(provider));
    }

    /** Get the registered service provider instances if any exist. */
    public getProviders(
        provider: ServiceProvider | Constructor<ServiceProvider>,
    ): Array<ServiceProvider> {
        const klass = this.providerClass(provider);
        const found = new Array<ServiceProvider>();

        for (const instance of this.serviceProviders.values()) {
            if (Reflector.isInstanceOf(instance, klass)) {
                found.push(instance);
            }
        }

        return found;
    }

    /** Resolve a service provider instance from the class. */
    public resolveProvider(
        provider: Constructor<ServiceProvider>,
    ): ServiceProvider {
        return new (
            provider as new (app: ApplicationContract) => ServiceProvider
        )(this);
    }

    /** Mark the given provider as registered. */
    protected markAsRegistered(provider: ServiceProvider): void {
        const klass = this.providerClass(provider);

        this.serviceProviders.set(klass, provider);

        this.loadedProviders.set(klass, true);
    }

    /** PHP: `is_string($provider) ? $provider : get_class($provider)`. */
    protected providerClass(
        provider: ServiceProvider | Constructor<ServiceProvider>,
    ): Constructor<ServiceProvider> {
        return (
            Reflector.isInstance(provider)
                ? Reflector.classOf(provider as object)
                : provider
        ) as Constructor<ServiceProvider>;
    }

    /** Load and boot all of the remaining deferred providers. */
    public loadDeferredProviders(): void {
        // We will simply spin through each of the deferred providers and register each
        // one and boot them if the application has booted. This should make each of
        // the remaining services available to this application for immediate use.
        for (const service of this.deferredServices.keys()) {
            this.loadDeferredProvider(service);
        }

        this.deferredServices.clear();
    }

    /** Load the provider for a deferred service. */
    public loadDeferredProvider(service: Abstract): void {
        if (!this.isDeferredService(service)) {
            return;
        }

        const provider = this.deferredServices.get(
            service,
        ) as Constructor<ServiceProvider>;

        // If the service provider has not already been loaded and registered we can
        // register it with the application and remove the service from this list
        // of deferred services, since it will already be loaded on subsequent.
        if (this.loadedProviders.get(provider) !== true) {
            this.registerDeferredProvider(provider, service);
        }
    }

    /** Register a deferred provider and service. */
    public registerDeferredProvider(
        provider: Constructor<ServiceProvider>,
        service?: Abstract,
    ): void {
        // Once the provider that provides the deferred service has been registered we
        // will remove it from our local list of the deferred services with related
        // providers so that this container does not try to resolve it out again.
        if (service !== undefined) {
            this.deferredServices.delete(service);
        }

        const instance = this.resolveProvider(provider);

        this.register(instance);

        if (!this.isBooted()) {
            this.booting(() => {
                this.bootProvider(instance);
            });
        }
    }

    /** Resolve the given type from the container. */
    public make<T extends object>(
        abstract: AbstractClass<T>,
        parameters?: ParameterList,
    ): T;
    public make<T = unknown>(abstract: string, parameters?: ParameterList): T;
    public make(abstract: Abstract, parameters?: ParameterList): unknown;
    public make(abstract: Abstract, parameters?: ParameterList): unknown {
        this.loadDeferredProviderIfNeeded((abstract = this.getAlias(abstract)));

        return super.make(abstract, parameters);
    }

    /** Resolve the given type from the container. */
    protected resolve(
        abstract: Abstract,
        parameters?: ParameterOverrides,
        raiseEvents = true,
    ): unknown {
        this.loadDeferredProviderIfNeeded((abstract = this.getAlias(abstract)));

        return super.resolve(abstract, parameters, raiseEvents);
    }

    /** Load the deferred provider if the given type is a deferred service and is not loaded. */
    protected loadDeferredProviderIfNeeded(abstract: Abstract): void {
        if (this.isDeferredService(abstract) && !this.instances.has(abstract)) {
            this.loadDeferredProvider(abstract);
        }
    }

    /** Determine if the given abstract type has been bound. */
    public bound(abstract: Abstract): boolean {
        return this.isDeferredService(abstract) || super.bound(abstract);
    }

    /** Determine if the application has booted. */
    public isBooted(): boolean {
        return this.hasBooted;
    }

    /** Boot the application's service providers. */
    public boot(): void {
        if (this.isBooted()) {
            return;
        }

        // Once the application has booted we will also fire some "booted" callbacks
        // for any listeners that need to do work after this initial booting gets
        // finished. This is useful when ordering the boot-up processes we run.
        this.fireAppCallbacks(this.bootingCallbacks);

        for (const provider of this.serviceProviders.values()) {
            this.bootProvider(provider);
        }

        this.hasBooted = true;

        this.fireAppCallbacks(this.bootedCallbacks);
    }

    /** Boot the given service provider. */
    protected bootProvider(provider: ServiceProvider): void {
        provider.callBootingCallbacks();

        if (
            typeIs(
                (provider as unknown as Record<string, unknown>).boot,
                "function",
            )
        ) {
            this.call([provider, "boot"]);
        }

        provider.callBootedCallbacks();
    }

    /** Register a new boot listener. */
    public booting(callback: Callback): void {
        this.bootingCallbacks.push(callback);
    }

    /** Register a new "booted" listener. */
    public booted(callback: Callback): void {
        this.bootedCallbacks.push(callback);

        if (this.isBooted()) {
            callback(this);
        }
    }

    /** Call the booting callbacks for the application. */
    protected fireAppCallbacks(callbacks: Array<Callback>): void {
        let index = 0;

        while (index < callbacks.size()) {
            callbacks[index](this);

            index += 1;
        }
    }

    /**
     * Handle the incoming request and send the response.
     *
     * PHP resolves the kernel, sends the response and terminates, all in the
     * one method, because the process ends a line later. Here the worker owns
     * that sequence -- the application is bootstrapped once and each request is
     * answered on a `sandbox()` -- and "send" means "return", so the response
     * comes back instead of going out.
     */
    public handleRequest(request: Request): Response {
        return this.make<Worker>(Worker).handle(request);
    }

    /** Register a terminating callback with the application. */
    public terminating(callback: CallableTarget): this {
        this.terminatingCallbacks.push(callback);

        return this;
    }

    /** Terminate the application. */
    public terminate(): void {
        let index = 0;

        while (index < this.terminatingCallbacks.size()) {
            this.call(this.terminatingCallbacks[index]);

            index += 1;
        }
    }

    /** Get the service providers that have been loaded. */
    public getLoadedProviders(): Array<
        [Constructor<ServiceProvider>, boolean]
    > {
        return this.loadedProviders.entries();
    }

    /** Determine if the given service provider is loaded. */
    public providerIsLoaded(provider: Constructor<ServiceProvider>): boolean {
        return this.loadedProviders.has(provider);
    }

    /** Get the application's deferred services. */
    public getDeferredServices(): OrderedMap<
        Abstract,
        Constructor<ServiceProvider>
    > {
        return this.deferredServices;
    }

    /** Set the application's deferred services. */
    public setDeferredServices(
        services: OrderedMap<Abstract, Constructor<ServiceProvider>>,
    ): void {
        this.deferredServices = services;
    }

    /** Determine if the given service is a deferred service. */
    public isDeferredService(service: Abstract): boolean {
        return this.deferredServices.has(service);
    }

    /** Add an array of services to the application's deferred services. */
    public addDeferredServices(
        services: OrderedMap<Abstract, Constructor<ServiceProvider>>,
    ): void {
        for (const [service, provider] of services.entries()) {
            this.deferredServices.set(service, provider);
        }
    }

    /** Remove an array of services from the application's deferred services. */
    public removeDeferredServices(services: Array<Abstract>): void {
        for (const service of services) {
            this.deferredServices.delete(service);
        }
    }

    /**
     * Register the core class aliases in the container.
     *
     * The PHP table maps every framework key onto its concrete class and its
     * contracts; contracts are erased here, so only the concrete classes remain.
     */
    public registerCoreContainerAliases(): void {
        const aliases: Array<[string, Array<Abstract>]> = [
            ["app", [Application, Container]],
            ["config", [ConfigRepository]],
            ["events", [Dispatcher]],
            ["log", [LogManager]],
            ["queue", [QueueManager]],
        ];

        for (const [key, targets] of aliases) {
            for (const alias of targets) {
                this.alias(key, alias);
            }
        }
    }

    /** Flush the container of all bindings and resolved instances. */
    public flush(): void {
        super.flush();

        this.buildStack.clear();
        this.loadedProviders.clear();
        this.bootedCallbacks.clear();
        this.bootingCallbacks.clear();
        this.deferredServices.clear();
        this.reboundCallbacks.clear();
        this.serviceProviders.clear();
        this.resolvingCallbacks.clear();
        this.terminatingCallbacks.clear();
        this.beforeResolvingCallbacks.clear();
        this.afterResolvingCallbacks.clear();
        this.globalBeforeResolvingCallbacks.clear();
        this.globalResolvingCallbacks.clear();
        this.globalAfterResolvingCallbacks.clear();
    }
}
