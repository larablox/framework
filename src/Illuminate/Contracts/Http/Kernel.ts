import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { Request } from "Illuminate/Http/Request";
import type { Response } from "Illuminate/Http/Response";

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

    /** Handle an incoming HTTP request. */
    handle(request: Request): Response;

    /** Perform any final actions for the request lifecycle. */
    terminate(request: Request, response: Response): void;

    /** Get the application instance. */
    getApplication(): Application;
}
