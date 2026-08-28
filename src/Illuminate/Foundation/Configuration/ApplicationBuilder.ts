import { Client } from "Illuminate/Foundation/Runtime/Client";
import { Exceptions as ExceptionsConfiguration } from "Illuminate/Foundation/Configuration/Exceptions";
import { Handler } from "Illuminate/Foundation/Exceptions/Handler";
import { Kernel } from "Illuminate/Foundation/Http/Kernel";
import { RemoteGateway } from "Illuminate/Http/RemoteGateway";
import { Server } from "Illuminate/Foundation/Runtime/Server";
import { LoadConfiguration } from "Illuminate/Foundation/Bootstrap/LoadConfiguration";
import { Middleware as MiddlewareConfiguration } from "Illuminate/Foundation/Configuration/Middleware";
import { RegisterProviders } from "Illuminate/Foundation/Bootstrap/RegisterProviders";
import { Util } from "Illuminate/Container/Util";
import { Worker } from "Illuminate/Foundation/Runtime/Worker";
import type { Abstract, Concrete, Constructor } from "Illuminate/Container/Types";
import type { Application } from "Illuminate/Foundation/Application";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Router } from "Illuminate/Routing/Router";
import type { ServiceProvider } from "Illuminate/Support/ServiceProvider";

/**
 * PHP: `Illuminate\Foundation\Configuration\ApplicationBuilder`.
 *
 * `withBroadcasting`, `withCommands`, `withSchedule` and
 * `prefersJsonResponses` configure subsystems that have no counterpart here.
 * `withEvents` drives filesystem event discovery, which is likewise gone -- the
 * base `EventServiceProvider` is registered by the application constructor.
 */
export class ApplicationBuilder {
    /** Create a new application builder instance. */
    public constructor(protected readonly app: Application) {}

    /**
     * Set the configuration the application should be bootstrapped with.
     *
     * Stands in for `Application::configure(basePath:)`: PHP points the
     * application at a directory of configuration files, and there is no
     * directory to point at.
     */
    public withConfig(items: ArrayAccessible): this {
        LoadConfiguration.using(items);

        return this;
    }

    /**
     * Register the routes the application answers on.
     *
     * PHP takes paths to `routes/web.php` and `routes/api.php` and loads them;
     * there are no files, so the routes are a function -- which is what PHP's
     * own `using:` argument takes. The web/api split does not survive the
     * crossing: both are one HTTP stack there, and here there is one kind of
     * request to begin with, so what would the second group be?
     */
    public withRouting(using: (router: Router) => void): this {
        this.booting((app: Application) => {
            using(app.make<Router>("router"));
        });

        // A route is added to the collection before `->name()` runs on it, so
        // the look-ups are rebuilt once the routes are all in -- which is what
        // PHP's `RouteServiceProvider` does, and for the same reason.
        return this.booted((app: Application) => {
            const routes = app.make<Router>("router").getRoutes();

            routes.refreshNameLookups();
            routes.refreshActionLookups();
        });
    }

    /**
     * Register the kernels for the application.
     *
     * PHP binds the HTTP kernel's contract to the concrete kernel, and the
     * console kernel beside it. There is no console, and an interface cannot be
     * a container key here, so one binding is left: the kernel itself.
     *
     * The runtime entry points are bound beside it, and every one of them has to
     * be a singleton: each holds "this has already started", and a second copy
     * would hold it separately. `Server` and `Worker` are the server's half --
     * Octane's split between the thing that owns the transport and the thing
     * that answers one request -- and `Client` is the other runtime's. Each
     * runtime resolves what it needs and leaves the rest alone; which runtime
     * this is, is not known here.
     *
     * `RemoteGateway` joins them, and for a sharper reason: its "already
     * listening" guard is per instance, so two resolutions of an unbound
     * gateway would each attach to the remotes and every request would be
     * served twice.
     */
    public withKernels(): this {
        this.app.singleton(Kernel);

        this.app.singleton(RemoteGateway);

        this.app.singleton(Worker);

        this.app.singleton(Server);

        this.app.singleton(Client);

        return this;
    }

    /**
     * Configure the middleware the application runs.
     *
     * The callback is handed a `Middleware`, whose answers are played onto the
     * kernel the first time it is resolved -- which is how PHP does it, and why
     * the callback may name middleware the container cannot build yet.
     */
    public withMiddleware(callback?: (middleware: MiddlewareConfiguration) => void): this {
        this.app.afterResolving(Kernel, (resolved: never) => {
            const kernel = resolved as Kernel;
            const middleware = new MiddlewareConfiguration();

            if (callback !== undefined) {
                callback(middleware);
            }

            kernel.setGlobalMiddleware(middleware.getGlobalMiddleware());
            kernel.setMiddlewareGroups(middleware.getMiddlewareGroups());
            kernel.setMiddlewareAliases(middleware.getMiddlewareAliases());

            const priority = middleware.getMiddlewarePriority();

            if (!priority.isEmpty()) {
                kernel.setMiddlewarePriority(priority);
            }

            for (const [entry, after] of middleware.getMiddlewarePriorityAppends()) {
                kernel.addToMiddlewarePriorityAfter(after, entry);
            }

            for (const [entry, before] of middleware.getMiddlewarePriorityPrepends()) {
                kernel.addToMiddlewarePriorityBefore(before, entry);
            }
        });

        return this;
    }

    /** Register and configure the application's exception handler. */
    public withExceptions(using?: (exceptions: ExceptionsConfiguration) => void): this {
        this.app.singleton(Handler);

        if (using !== undefined) {
            this.app.afterResolving(Handler, (resolved: never) => {
                using(new ExceptionsConfiguration(resolved as Handler));
            });
        }

        return this;
    }

    /** Register additional service providers. */
    public withProviders(providers: Array<Constructor<ServiceProvider>> = []): this {
        RegisterProviders.merge(providers);

        return this;
    }

    /** Register an array of container bindings to be bound when the application is booting. */
    public withBindings(bindings: Array<[Abstract, Concrete]>): this {
        return this.registered((app: Application) => {
            for (const [abstract, concrete] of bindings) {
                app.bind(abstract, concrete);
            }
        });
    }

    /** Register an array of singleton container bindings to be bound when the application is booting. */
    public withSingletons(singletons: Array<[Abstract, Concrete] | Abstract>): this {
        return this.registered((app: Application) => {
            for (const entry of singletons) {
                if (Util.isArray(entry)) {
                    const [abstract, concrete] = entry as [Abstract, Concrete];

                    app.singleton(abstract, concrete);
                } else {
                    app.singleton(entry as Abstract);
                }
            }
        });
    }

    /** Register an array of scoped singleton container bindings to be bound when the application is booting. */
    public withScopedSingletons(scopedSingletons: Array<[Abstract, Concrete] | Abstract>): this {
        return this.registered((app: Application) => {
            for (const entry of scopedSingletons) {
                if (Util.isArray(entry)) {
                    const [abstract, concrete] = entry as [Abstract, Concrete];

                    app.scoped(abstract, concrete);
                } else {
                    app.scoped(entry as Abstract);
                }
            }
        });
    }

    /** Register a callback to be invoked when the application's service providers are registered. */
    public registered(callback: Callback): this {
        this.app.registered(callback);

        return this;
    }

    /** Register a callback to be invoked when the application is "booting". */
    public booting(callback: Callback): this {
        this.app.booting(callback);

        return this;
    }

    /** Register a callback to be invoked when the application is "booted". */
    public booted(callback: Callback): this {
        this.app.booted(callback);

        return this;
    }

    /** Get the application instance. */
    public create(): Application {
        return this.app;
    }
}
