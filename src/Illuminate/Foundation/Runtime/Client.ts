import { BootProviders } from "Illuminate/Foundation/Bootstrap/BootProviders";
import { Inject } from "Illuminate/Container/Attributes/Inject";
import { LoadConfiguration } from "Illuminate/Foundation/Bootstrap/LoadConfiguration";
import { RegisterFacades } from "Illuminate/Foundation/Bootstrap/RegisterFacades";
import { RegisterProviders } from "Illuminate/Foundation/Bootstrap/RegisterProviders";
import { RuntimeException } from "Illuminate/Exception";
import type { Abstract, Constructor } from "Illuminate/Container/Types";
import type { Application, Bootstrapper } from "Illuminate/Contracts/Foundation/Application";
import type { Repository as ConfigRepository } from "Illuminate/Config/Repository";

/**
 * The client's entry point, as `Worker` is the server's.
 *
 * No PHP counterpart, and the platform leaves no choice: Laravel has one
 * runtime and Roblox has two. What it is *not* is a second kernel. A kernel
 * turns something inbound into an answer through a middleware stack, and the
 * client has neither -- `routing-design.md`, decision 6, settles that
 * server-to-client is broadcasting rather than routing, so what arrives goes to
 * `Events\Dispatcher`, with no pipeline and nothing to answer. Adding
 * `handle()` here would reopen a decision that is already made.
 *
 * What it is, then, is the half of `Worker` that is not about requests:
 *
 * - it owns the bootstrapper list for this entry point. That is the Laravel
 *   shape, not a departure from it -- `Illuminate\Foundation\Console\Kernel`
 *   holds the console's list the same way, and the two lists differ because
 *   the two entry points need different things. Before this, every game had to
 *   copy the four class names into its own `main.client.ts` and would silently
 *   drift when the framework's list changed;
 * - it warms what the client actually uses, which is not what the server does:
 *   no router, no queue.
 *
 * Naming: `Illuminate\Http\Client` is the *outbound* HTTP client, which is a
 * different thing entirely -- but only in prose. That namespace exports no
 * symbol called `Client` at all (it is `Factory`, `PendingRequest`,
 * `Response`), so nothing here ever has to be aliased. The port already carries
 * a real pair of this kind, faithfully to PHP: `Http\Response` and
 * `Http\Client\Response`.
 */
export class Client {
    /** Whether `boot()` has run. */
    protected booted = false;

    /** Create a new client instance. */
    public constructor(@Inject("app") protected readonly app: Application) {}

    /**
     * The bootstrappers the client runs.
     *
     * The same four the HTTP kernel holds, and for a plain reason: not one of
     * them is request-shaped. They are listed here rather than read off the
     * kernel because the client resolves no kernel, and because the two lists
     * are free to diverge -- which is exactly what happens in PHP between the
     * HTTP and console kernels.
     */
    public static defaultBootstrappers(): Array<Constructor<Bootstrapper>> {
        return [LoadConfiguration, RegisterFacades, RegisterProviders, BootProviders];
    }

    /**
     * The services resolved before the client does anything.
     *
     * `Worker`'s list minus the two that answer requests: there is no router
     * without routes and no queue worker on a client.
     */
    public static defaultServicesToWarm(): Array<Abstract> {
        return ["events", "config", "log"];
    }

    /** Bootstrap the application, then warm it. */
    public boot(
        bootstrappers: Array<Constructor<Bootstrapper>> = Client.defaultBootstrappers(),
        services?: Array<Abstract>,
    ): void {
        if (this.booted) {
            throw new RuntimeException("The client has already booted.");
        }

        // Guarded the way `Kernel::bootstrap()` guards it: `bootstrapWith()`
        // itself will happily run the list twice.
        if (!this.app.hasBeenBootstrapped()) {
            this.app.bootstrapWith(bootstrappers);
        }

        this.warm(services);

        this.booted = true;
    }

    /**
     * Resolve the services that should be ready before the client does anything.
     *
     * Reads `app.warm` like `Worker` does, falling back to the client's own
     * default list.
     */
    public warm(services?: Array<Abstract>): void {
        const configured =
            services ??
            (this.app.make<ConfigRepository>("config").get("app.warm") as Array<Abstract> | undefined) ??
            Client.defaultServicesToWarm();

        for (const service of configured) {
            if (this.app.bound(service)) {
                this.app.make(service);
            }
        }
    }

    /** Whether the client has booted. */
    public hasBooted(): boolean {
        return this.booted;
    }

    /** Get the application instance the client booted. */
    public application(): Application {
        return this.app;
    }
}
