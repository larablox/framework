import { MemoryQueue } from 'Illuminate/Queue/MemoryQueue';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { ConnectorInterface } from 'Illuminate/Queue/Connectors/ConnectorInterface';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: `Illuminate\Queue\Connectors\DatabaseConnector`, without a database. */
export class MemoryConnector implements ConnectorInterface {
    /** Establish a queue connection. */
    public connect(config: ArrayAccessible): Queue {
        return new MemoryQueue(
            (config.queue as string | undefined) ?? 'default',
            (config.retry_after as number | undefined) ?? 60,
            (config.block_for as number | undefined) ?? 0,
            config.after_commit as boolean | undefined,
        );
    }
}
