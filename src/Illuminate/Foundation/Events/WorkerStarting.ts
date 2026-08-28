import type { Application } from 'Illuminate/Contracts/Foundation/Application';

/**
 * PHP: `Laravel\Octane\Events\WorkerStarting`.
 *
 * The root application has been bootstrapped and warmed, and is about to start
 * answering requests. Fired once for the life of the place.
 */
export class WorkerStarting {
    /** Create a new event instance. */
    public constructor(public readonly app: Application) {}
}
