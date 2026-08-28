import type { Application } from 'Illuminate/Contracts/Foundation/Application';

/**
 * PHP: `Laravel\Octane\Events\WorkerErrorOccurred`.
 *
 * Something escaped the kernel, which answers rather than throws -- so this is
 * the worker's own net, not the application's. `sandbox` is the copy the
 * request was being handled on, which is about to be thrown away.
 */
export class WorkerErrorOccurred {
    /** Create a new event instance. */
    public constructor(
        public readonly exception: unknown,
        public readonly sandbox: Application,
    ) {}
}
