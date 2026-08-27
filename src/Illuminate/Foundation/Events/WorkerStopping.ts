import type { Application } from "Illuminate/Contracts/Foundation/Application";

/**
 * PHP: `Laravel\Octane\Events\WorkerStopping`.
 *
 * The worker is shutting down and will answer no further requests. This is the
 * one place a listener may assume nothing is in flight.
 */
export class WorkerStopping {
    /** Create a new event instance. */
    public constructor(public readonly app: Application) {}
}
