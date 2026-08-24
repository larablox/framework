import { Factory } from "Illuminate/Http/Client/Factory";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract, Concrete } from "Illuminate/Container/Types";

/**
 * PHP: `Illuminate\Foundation\Providers\FoundationServiceProvider`.
 *
 * PHP lists it among the default providers and it registers a long tail of
 * things this port has no use for. What survives is the HTTP client factory,
 * registered exactly as PHP registers it -- through the `$singletons`
 * property.
 *
 * Not ported: `Vite`, the console schedule, the dumper, request validation and
 * signature validation (they wait for `Illuminate\Validation`), URI URL
 * generation, the deferred-callback handler, exception tracking and rendering,
 * the maintenance-mode manager, and the aggregated `FormRequestServiceProvider`
 * and `ParallelTestingServiceProvider`.
 */
export class FoundationServiceProvider extends ServiceProvider {
    /** The singletons to register into the container. */
    public singletons: Array<[Abstract, Concrete] | Abstract> = [Factory];
}
