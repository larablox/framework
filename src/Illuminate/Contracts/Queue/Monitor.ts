import type { Listener } from 'Illuminate/Contracts/Events/Dispatcher';

/** PHP: `Illuminate\Contracts\Queue\Monitor`. */
export interface Monitor {
    /** Register a callback to be executed when a daemon queue is starting. */
    starting(callback: Listener): void;

    /** Register a callback to be executed on every iteration through the queue loop. */
    looping(callback: Listener): void;

    /** Register a callback to be executed when a job fails after the maximum number of retries. */
    failing(callback: Listener): void;

    /** Register a callback to be executed when a daemon queue is stopping. */
    stopping(callback: Listener): void;
}
