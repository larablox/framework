import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: `Illuminate\Contracts\Queue\Factory`. */
export interface Factory {
    /** Resolve a queue connection instance. */
    connection(name?: string): Queue;
}
