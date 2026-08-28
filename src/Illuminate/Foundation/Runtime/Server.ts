import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { RemoteGateway } from 'Illuminate/Http/RemoteGateway';
import { RuntimeException } from 'Illuminate/Exception';
import { Worker } from 'Illuminate/Foundation/Runtime/Worker';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Request } from 'Illuminate/Http/Request';

/**
 * The server's entry point: the thing that owns the transport.
 *
 * Octane's split, kept. There, the *server* -- Swoole, RoadRunner, FrankenPHP
 * -- holds the socket, accepts what arrives and hands it to a *worker*, which
 * answers it. The two are separate because they answer separate questions:
 * "what is this runtime attached to" and "how is one request served".
 *
 * The same seam is already here, just unnamed until now: `RemoteGateway`'s own
 * docblock calls itself "the socket, the part PHP leaves to the web server",
 * and `Worker` is the port of `Laravel\Octane\Worker`. This composes them, so
 * that a game says what the client says --
 *
 * ```ts
 * app.make<Server>(Server).boot();
 * ```
 *
 * -- instead of booting the worker and then knowing, by hand, that the
 * gateway's handler is `app.handleRequest`.
 */
export class Server {
    /** Whether `boot()` has run. */
    protected booted = false;

    /**
     * Create a new server instance.
     *
     * Every parameter is annotated, including the two whose types name a class
     * the container already knows. PHP would read those off the type hints;
     * types are erased here, so a parameter without `Inject` is a parameter the
     * container cannot resolve -- and it fails when the server is built, not
     * when this compiles.
     */
    public constructor(
        @Inject('app') protected readonly app: Application,
        @Inject(Worker) protected readonly worker: Worker,
        @Inject(RemoteGateway) protected readonly gateway: RemoteGateway,
    ) {}

    /** Boot the worker, then attach to the remotes. */
    public boot(services?: Array<Abstract>): void {
        if (this.booted) {
            throw new RuntimeException('The server has already booted.');
        }

        // Order matters and is the same order Octane starts in: the worker is
        // ready before anything can arrive. The gateway answers a request that
        // lands before bootstrapping with a 503, but that is a net, not a plan.
        //
        // Asked to boot rather than told, because these two steps do not fail
        // together. A gateway that refuses -- the remotes are not there, or
        // something is already attached to them -- leaves the worker running
        // and the server not booted, and booting again is exactly what a caller
        // does once the cause is fixed. Insisting here would answer that second
        // attempt with "the worker has already booted", which is true, is not
        // the problem, and leaves the server unstartable.
        //
        // The same reading covers a game that booted the worker itself: the
        // server's job is to see it booted, not to be the one that booted it.
        // A `services` list handed here is then the earlier call's, not this
        // one's.
        if (!this.worker.hasBooted()) {
            this.worker.boot(services);
        }

        this.gateway.listen((request: Request) => this.worker.handle(request));

        this.booted = true;
    }

    /** Detach from the remotes and stop the worker. */
    public stop(): void {
        if (!this.booted) {
            return;
        }

        // Detach first: stopping the worker while the remotes are still live
        // would leave whatever arrives in between with no one to answer it.
        this.gateway.stop();

        this.worker.terminate();

        this.booted = false;
    }

    /** Whether the server has booted. */
    public hasBooted(): boolean {
        return this.booted;
    }

    /** Get the worker serving this server's requests. */
    public runtimeWorker(): Worker {
        return this.worker;
    }

    /** Get the application instance the server booted. */
    public application(): Application {
        return this.app;
    }
}
