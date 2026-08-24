import { CacheManager } from "Illuminate/Cache/CacheManager";
import { RateLimiter } from "Illuminate/Cache/RateLimiter";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract } from "Illuminate/Container/Types";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { DeferrableProvider } from "Illuminate/Contracts/Support/DeferrableProvider";
import type { Factory } from "Illuminate/Contracts/Cache/Factory";
import type { Repository } from "Illuminate/Cache/Repository";
import type { Repository as ConfigRepository } from "Illuminate/Contracts/Config/Repository";

/**
 * PHP: `Illuminate\Cache\CacheServiceProvider`.
 *
 * `cache.psr6` and `memcached.connector` have nothing to bind here.
 */
export class CacheServiceProvider
    extends ServiceProvider
    implements DeferrableProvider
{
    /** Register the service provider. */
    public register(): void {
        const app: Application = this.app;

        this.app.singleton("cache", () => new CacheManager(app));

        this.app.singleton("cache.store", () =>
            app.make<Factory>("cache").store(),
        );

        this.app.singleton(
            RateLimiter,
            () =>
                new RateLimiter(
                    app
                        .make<Factory>("cache")
                        .store(
                            app
                                .make<ConfigRepository>("config")
                                .get("cache.limiter") as string | undefined,
                        ) as Repository,
                ),
        );
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return ["cache", "cache.store", RateLimiter];
    }
}
