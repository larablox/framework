import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { Kernel as HttpKernel } from 'Illuminate/Foundation/Http/Kernel';
import { RequestReceived } from 'Illuminate/Foundation/Events/RequestReceived';
import { RequestTerminated } from 'Illuminate/Foundation/Events/RequestTerminated';
import { RuntimeException } from 'Illuminate/Exception';
import { Str } from 'Illuminate/Support/Str';
import { WorkerErrorOccurred } from 'Illuminate/Foundation/Events/WorkerErrorOccurred';
import { WorkerStarting } from 'Illuminate/Foundation/Events/WorkerStarting';
import { WorkerStopping } from 'Illuminate/Foundation/Events/WorkerStopping';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Repository as ConfigRepository } from 'Illuminate/Config/Repository';
import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';

/**
 * PHP: `Laravel\Octane\Worker`.
 *
 * The part of `public/index.php` that PHP does not have to write, because the
 * process it describes is born with the request and dies with the response.
 * Here it is the other way round: the place outlives every request, which is
 * the situation Octane puts PHP into on purpose. So this is Octane's worker,
 * not Laravel's front controller.
 *
 * What that buys, and what it costs:
 *
 * - the application is bootstrapped **once**, at start-up, and the providers
 *   stay booted. `warm()` then resolves the heavy singletons before the first
 *   request rather than inside it;
 * - because the root application is never torn down, a request may not be
 *   handed it directly. Each one gets a `sandbox()` -- a copy sharing the
 *   resolved singletons but owning the maps -- and the sandbox is what gets
 *   terminated and flushed. `Kernel::terminate()` therefore still calls
 *   `$app->terminate()` exactly as Laravel writes it; the application it
 *   terminates is the copy.
 *
 * `CurrentApplication::set()` is deliberately only half ported. Octane points
 * the global container **and** the facade root at the sandbox for the length of
 * the request and back at the root afterwards; both are process-wide, and with
 * requests interleaving (below) that would hand one request the other's
 * sandbox. So `sandbox()` rebinds only the two keys inside the copy, and
 * `Container::setInstance()` / `Facade::setFacadeApplication()` keep pointing at
 * the root application for the life of the place. A facade therefore resolves
 * out of the root -- which is right for the singletons it is used for, and
 * wrong for anything request-scoped, so do not reach for `App::make("request")`.
 *
 * One thing Octane gets for free that is **not** true here: an Octane worker
 * handles one request at a time. A remote handler is a coroutine, so any yield
 * inside a route -- a `DataStore` call, `task.wait()` -- lets the next request
 * start before this one is done. So per-request state may not live on any
 * object that outlives the request:
 *
 * - the kernel keeps nothing about a request. The sandbox is handed to it call
 *   by call -- `Kernel::handle(request, app)`, `Kernel::terminate(request,
 *   response, app)` -- and it passes that same one on to the router, rather
 *   than either of them holding it. The request's start time lives in the
 *   sandbox for the same reason;
 * - the route is a copy taken at match time (`Route::forRequest()`), which is
 *   what carries the parameters, the controller and that container.
 *
 * - `Router::current()` and `getCurrentRequest()` read a store keyed by
 *   coroutine, since the whole point of them is being reachable without being
 *   handed anything, and a request is one coroutine.
 */
export class Worker {
    /** The kernel, resolved once and handed a sandbox per request. */
    protected kernel?: HttpKernel;

    /** Whether `boot()` has run. */
    protected booted = false;

    /** Create a new worker instance. */
    public constructor(@Inject('app') protected readonly app: Application) {}

    /**
     * The services resolved before the first request is answered.
     *
     * PHP: `Octane::defaultServicesToWarm()`, cut down to what exists here.
     */
    public static defaultServicesToWarm(): Array<Abstract> {
        return ['events', 'config', 'log', 'router', 'queue'];
    }

    /** Boot the worker: bootstrap the application once, then warm it. */
    public boot(services?: Array<Abstract>): void {
        if (this.booted) {
            throw new RuntimeException('The worker has already booted.');
        }

        this.kernel = this.app.make<HttpKernel>(HttpKernel);

        this.kernel.bootstrap();

        this.warm(services);

        this.booted = true;

        this.dispatchEvent(this.app, new WorkerStarting(this.app));
    }

    /**
     * Resolve the services that should be ready before the first request.
     *
     * PHP reads `octane.warm` from a config file the package publishes; there
     * is no such file here, so the key is `app.warm` and the default list
     * stands in when it is absent.
     */
    public warm(services?: Array<Abstract>): void {
        const configured =
            services ??
            (this.app.make<ConfigRepository>('config').get('app.warm') as Array<Abstract> | undefined) ??
            Worker.defaultServicesToWarm();

        for (const service of configured) {
            if (this.app.bound(service)) {
                this.app.make(service);
            }
        }
    }

    /**
     * Handle an incoming request on a copy of the application.
     *
     * The response is returned rather than sent -- returning it *is* sending it
     * over a `RemoteFunction` -- so termination is deferred: PHP terminates
     * after `$response->send()`, and `task.defer()` is the nearest thing to
     * "once the caller has it". The sandbox stays alive until then, which is
     * what the terminable middleware and the terminating callbacks resolve out
     * of, and is flushed on the way out.
     */
    public handle(request: Request): Response {
        const kernel = this.bootedKernel();
        const sandbox = this.app.sandbox();

        // PHP: `GiveNewApplicationInstanceToHttpKernel` points the kernel at the
        // sandbox and back again. That cannot work here -- requests interleave,
        // so the next one would move the kernel out from under this one. The
        // kernel is still one object, holding the middleware stack and nothing
        // about any request; the sandbox is handed to it call by call instead.
        try {
            this.dispatchEvent(sandbox, new RequestReceived(this.app, sandbox, request));

            const response = kernel.handle(request, sandbox);

            // The kernel goes with it rather than being looked up again later:
            // `bootedKernel()` refuses once the worker has been terminated, and
            // this runs after the response, by which time the place may well be
            // shutting down. A request that has been answered gets terminated.
            task.defer(() => {
                this.terminateRequest(kernel, sandbox, request, response);
            });

            return response;
        } catch (e) {
            // The kernel answers rather than throws, so reaching here means the
            // kernel itself broke. Clean up now -- the deferred path above was
            // never scheduled -- and let the gateway turn it into a 500.
            this.dispatchEvent(sandbox, new WorkerErrorOccurred(e, sandbox));

            this.flushSandbox(sandbox);

            throw e;
        }
    }

    /** Terminate the request, then throw the sandbox away. */
    protected terminateRequest(kernel: HttpKernel, sandbox: Application, request: Request, response: Response): void {
        try {
            // `Kernel::terminate()` ends in `$this->app->terminate()`, and
            // `$this->app` is the sandbox -- which is the whole point.
            kernel.terminate(request, response, sandbox);

            this.dispatchEvent(sandbox, new RequestTerminated(this.app, sandbox, request, response));
        } catch (e) {
            this.dispatchEvent(sandbox, new WorkerErrorOccurred(e, sandbox));
        } finally {
            this.flushSandbox(sandbox);
        }
    }

    /**
     * Drop the sandbox.
     *
     * PHP: the `finally` of `Worker::handle()`, plus `FlushStrCache` -- the
     * casing caches are `Str`'s own statics rather than container state, so
     * nothing else would ever clear them in a process that does not end. Octane
     * hangs that listener on `RequestReceived`, at the top of the next request;
     * it happens on the way out here instead, because a request that starts
     * while another is mid-flight must not pull the cache out from under it.
     */
    protected flushSandbox(sandbox: Application): void {
        sandbox.flush();

        Str.flushCache();
    }

    /** Stop the worker. */
    public terminate(): void {
        this.dispatchEvent(this.app, new WorkerStopping(this.app));

        this.booted = false;
    }

    /** Whether the worker has booted. */
    public hasBooted(): boolean {
        return this.booted;
    }

    /** Get the application instance being used by the worker. */
    public application(): Application {
        return this.app;
    }

    /**
     * Get the kernel, or say why there is none to serve with.
     *
     * `booted` is asked as well as the kernel, and that is the point: the
     * kernel outlives `terminate()` so that `boot()` can pick the worker up
     * again, but `terminate()` has already dispatched `WorkerStopping` and
     * whatever listened to it has let go of what it held. Serving after that
     * runs a request against services nobody is keeping any more, and nothing
     * raises to say so.
     */
    protected bootedKernel(): HttpKernel {
        if (!this.booted || this.kernel === undefined) {
            throw new RuntimeException('Worker has not booted. Unable to handle requests.');
        }

        return this.kernel;
    }

    /**
     * Dispatch an event on the given application.
     *
     * PHP: `Laravel\Octane\DispatchesEvents`. A worker event may be sent before
     * the dispatcher is bound, and one that nobody can hear is not an error.
     */
    protected dispatchEvent(app: Application, event: object): void {
        if (!app.bound('events')) {
            return;
        }

        app.make<Dispatcher>('events').dispatch(event);
    }
}
