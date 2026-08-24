import { Repository } from "Illuminate/Config/Repository";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type {
    Application,
    Bootstrapper,
} from "Illuminate/Contracts/Foundation/Application";

/**
 * PHP: `Illuminate\Foundation\Bootstrap\LoadConfiguration`.
 *
 * PHP discovers `config/*.php` on disk and merges a cached file over it. There
 * is no filesystem here, so the configuration is handed to the bootstrapper up
 * front with `using()`, the way `RegisterProviders::merge()` takes providers.
 */
export class LoadConfiguration implements Bootstrapper {
    /** The configuration items to load. */
    protected static items: ArrayAccessible = {};

    /** Set the configuration the application should be bootstrapped with. */
    public static using(items: ArrayAccessible): void {
        LoadConfiguration.items = items;
    }

    /** Bootstrap the given application. */
    public bootstrap(app: Application): void {
        const config = new Repository(LoadConfiguration.items);

        app.instance("config", config);

        // Finally, we will set the application's environment based on the configuration
        // values that were loaded, and hand the container a resolver so that bindings
        // declared per environment can be resolved.
        app.detectEnvironment(
            () => config.get("app.env", "production") as string,
        );

        app.resolveEnvironmentUsing((environments) =>
            app.environment(environments),
        );
    }
}
