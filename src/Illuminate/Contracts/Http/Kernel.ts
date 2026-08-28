import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';

/**
 * PHP: `Illuminate\Contracts\Http\Kernel`.
 *
 * PHP binds this interface's name to the concrete kernel and resolves requests
 * through it. An interface is a type here and types do not survive
 * compilation, so the concrete `Illuminate\Foundation\Http\Kernel` is what the
 * container is keyed by -- the same trade every other contract in this port
 * makes.
 */
export interface Kernel {
    /** Bootstrap the application for HTTP requests. */
    bootstrap(): void;

    /**
     * Handle an incoming HTTP request.
     *
     * PHP takes the request alone: one process serves one request, so the
     * application on the kernel can only be this request's. Here one kernel
     * serves every request and they interleave, so the application arrives
     * with the request -- the same trade `Router::dispatch()` makes.
     */
    handle(request: Request, app?: Application): Response;

    /** Perform any final actions for the request lifecycle. */
    terminate(request: Request, response: Response, app?: Application): void;

    /** Get the application instance. */
    getApplication(): Application;
}
