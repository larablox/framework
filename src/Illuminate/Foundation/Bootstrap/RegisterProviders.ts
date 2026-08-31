import { ServiceProvider } from 'Illuminate/Support/ServiceProvider';
import type { Application, Bootstrapper } from 'Illuminate/Contracts/Foundation/Application';
import type { Constructor } from 'Illuminate/Container/Types';
import type { Repository as ConfigRepository } from 'Illuminate/Contracts/Config/Repository';

/**
 * PHP: `Illuminate\Foundation\Bootstrap\RegisterProviders`.
 *
 * The bootstrap provider file and the cached-configuration check are gone with
 * the filesystem; `merge()` remains, so packages can still contribute providers
 * before the application registers them.
 */
export class RegisterProviders implements Bootstrapper
{
    /** The service providers that should be merged before registration. */
    protected static merged = new Array<Constructor<ServiceProvider>>();

    /** Bootstrap the given application. */
    public bootstrap(app: Application): void
    {
        this.mergeAdditionalProviders(app);

        app.registerConfiguredProviders();
    }

    /** Merge the additional configured providers into the configuration. */
    protected mergeAdditionalProviders(app: Application): void
    {
        const config = app.make<ConfigRepository>('config');

        const providers = (config.get('app.providers', []) ?? []) as Array<Constructor<ServiceProvider>>;

        for (const provider of RegisterProviders.merged) {
            if (!providers.includes(provider)) {
                providers.push(provider);
            }
        }

        config.set('app.providers', providers);
    }

    /** Merge the given providers into the provider configuration before registration. */
    public static merge(providers: Array<Constructor<ServiceProvider>>): void
    {
        for (const provider of providers) {
            if (!RegisterProviders.merged.includes(provider)) {
                RegisterProviders.merged.push(provider);
            }
        }
    }

    /** Flush the bootstrapper's global state. */
    public static flushState(): void
    {
        RegisterProviders.merged.clear();
    }
}
