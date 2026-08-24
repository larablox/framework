import { OrderedMap } from "Illuminate/Support/OrderedMap";
import type { Abstract, Constructor } from "Illuminate/Container/Types";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { Dispatcher } from "Illuminate/Contracts/Events/Dispatcher";
import type { ServiceProvider } from "Illuminate/Support/ServiceProvider";

/** PHP: the compiled service manifest. */
export interface ProviderManifest {
    /** Providers registered on every boot. */
    eager: Array<Constructor<ServiceProvider>>;

    /** Deferred services mapped to the provider that supplies them. */
    deferred: OrderedMap<Abstract, Constructor<ServiceProvider>>;

    /** Deferred providers mapped to the events that trigger their registration. */
    when: OrderedMap<Constructor<ServiceProvider>, Array<string>>;
}

/**
 * PHP: `Illuminate\Foundation\ProviderRepository`.
 *
 * The manifest is compiled on every boot instead of being cached to disk: a
 * place has no writable filesystem, and instantiating the providers is the only
 * way to ask them what they defer.
 */
export class ProviderRepository {
    /** Create a new service repository instance. */
    public constructor(protected readonly app: Application) {}

    /** Register the application service providers. */
    public load(providers: Array<Constructor<ServiceProvider>>): void {
        const manifest = this.compileManifest(providers);

        // Next, we will register events to load the providers for each of the events
        // that it has requested. This allows the service provider to defer itself
        // while still getting automatically loaded when a certain event occurs.
        for (const [provider, events] of manifest.when.entries()) {
            this.registerLoadEvents(provider, events);
        }

        // We will go ahead and register all of the eagerly loaded providers with the
        // application so their services can be registered with the application as
        // a provided service.
        for (const provider of manifest.eager) {
            this.app.register(provider);
        }

        this.app.addDeferredServices(manifest.deferred);
    }

    /** Register the load events for the given provider. */
    protected registerLoadEvents(
        provider: Constructor<ServiceProvider>,
        events: Array<string>,
    ): void {
        if (events.isEmpty()) {
            return;
        }

        this.app
            .make<Dispatcher>("events")
            .listen(events, () => this.app.register(provider));
    }

    /** Compile the application service manifest. */
    protected compileManifest(
        providers: Array<Constructor<ServiceProvider>>,
    ): ProviderManifest {
        const manifest = this.freshManifest();

        for (const provider of providers) {
            const instance = this.createProvider(provider);

            // We will spin through each of the providers and check if it's a deferred
            // provider or not. If so we'll add its provided services to the manifest
            // and note the provider.
            if (instance.isDeferred()) {
                for (const service of instance.provides()) {
                    manifest.deferred.set(service, provider);
                }

                manifest.when.set(provider, instance.when());
            } else {
                // If the service providers are not deferred, we will simply add it to an
                // array of eagerly loaded providers that will get registered on every
                // boot of this application instead of "lazy" loading every time.
                manifest.eager.push(provider);
            }
        }

        return manifest;
    }

    /** Create a fresh service manifest data structure. */
    protected freshManifest(): ProviderManifest {
        return {
            eager: new Array<Constructor<ServiceProvider>>(),
            deferred: new OrderedMap<Abstract, Constructor<ServiceProvider>>(),
            when: new OrderedMap<Constructor<ServiceProvider>, Array<string>>(),
        };
    }

    /** Create a new provider instance. */
    public createProvider(
        provider: Constructor<ServiceProvider>,
    ): ServiceProvider {
        return new (provider as new (app: Application) => ServiceProvider)(
            this.app,
        );
    }
}
