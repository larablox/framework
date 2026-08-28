import type { Abstract, Constructor, EnvironmentResolver } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { OrderedMap } from 'Illuminate/Support/OrderedMap';
import type { ServiceProvider } from 'Illuminate/Support/ServiceProvider';

/** A class that bootstraps the application, as passed to `bootstrapWith()`. */
export interface Bootstrapper {
    bootstrap(app: Application): void;
}

/**
 * PHP: `Illuminate\Contracts\Foundation\Application`.
 *
 * The path, locale, maintenance-mode and console accessors are not ported: a
 * Roblox place has no filesystem, no console and no request lifecycle.
 */
export interface Application extends Container {
    /** Get the version number of the application. */
    version(): string;

    /** Get or check the current application environment. */
    environment(...environments: Array<string | Array<string>>): string | boolean;

    /** Detect the application's current environment. */
    detectEnvironment(callback: () => string): string;

    /** Set the callback which determines the current container environment. */
    resolveEnvironmentUsing(callback?: EnvironmentResolver): void;

    /** Register all of the configured providers. */
    registerConfiguredProviders(): void;

    /** Register a service provider with the application. */
    register(provider: ServiceProvider | Constructor<ServiceProvider>, force?: boolean): ServiceProvider;

    /** Register a deferred provider and service. */
    registerDeferredProvider(provider: Constructor<ServiceProvider>, service?: Abstract): void;

    /** Resolve a service provider instance from the class name. */
    resolveProvider(provider: Constructor<ServiceProvider>): ServiceProvider;

    /** Boot the application's service providers. */
    boot(): void;

    /** Register a new boot listener. */
    booting(callback: Callback): void;

    /** Register a new "booted" listener. */
    booted(callback: Callback): void;

    /** Run the given array of bootstrap classes. */
    bootstrapWith(bootstrappers: Array<Constructor<Bootstrapper>>): void;

    /** Get the registered service provider instances if any exist. */
    getProviders(provider: ServiceProvider | Constructor<ServiceProvider>): Array<ServiceProvider>;

    /** Determine if the application has been bootstrapped before. */
    hasBeenBootstrapped(): boolean;

    /** Determine if middleware has been disabled for the application. */
    shouldSkipMiddleware(): boolean;

    /** Load and boot all of the remaining deferred providers. */
    loadDeferredProviders(): void;

    /** Get a copy of the application to handle a single request with. */
    sandbox(): Application;

    /** Register a terminating callback with the application. */
    terminating(callback: Callback): this;

    /** Terminate the application. */
    terminate(): void;

    /** Get the application's deferred services. */
    getDeferredServices(): OrderedMap<Abstract, Constructor<ServiceProvider>>;

    /** Set the application's deferred services. */
    setDeferredServices(services: OrderedMap<Abstract, Constructor<ServiceProvider>>): void;

    /** Determine if the given service is a deferred service. */
    isDeferredService(service: Abstract): boolean;

    /** Add an array of services to the application's deferred services. */
    addDeferredServices(services: OrderedMap<Abstract, Constructor<ServiceProvider>>): void;

    /** Remove an array of services from the application's deferred services. */
    removeDeferredServices(services: Array<Abstract>): void;

    /** Load the provider for a deferred service. */
    loadDeferredProvider(service: Abstract): void;
}
