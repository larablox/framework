import type { Abstract } from "Illuminate/Container/Types";

/**
 * PHP: `interface DeferrableProvider`, whose presence marks a provider as
 * deferred.
 *
 * Interfaces are erased, so `ServiceProvider::isDeferred()` instead asks whether
 * the provider declares its own `provides()` -- which is the only thing this
 * interface ever required of an implementation.
 */
export interface DeferrableProvider {
    /** Get the services provided by the provider. */
    provides(): Array<Abstract>;
}
