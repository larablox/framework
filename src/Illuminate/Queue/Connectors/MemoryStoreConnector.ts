import { MemoryStoreQueue } from 'Illuminate/Queue/MemoryStoreQueue';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { ConnectorInterface } from 'Illuminate/Queue/Connectors/ConnectorInterface';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: `Illuminate\Queue\Connectors\RedisConnector`. */
export class MemoryStoreConnector implements ConnectorInterface {
    /** Establish a queue connection. */
    public connect(config: ArrayAccessible): Queue {
        return new MemoryStoreQueue(
            (config.queue as string | undefined) ?? 'default',
            (config.retry_after as number | undefined) ?? 60,
            (config.block_for as number | undefined) ?? 0,
            (config.expiration as number | undefined) ?? 604800,
            (config.prefix as string | undefined) ?? 'queue:',
            config.after_commit as boolean | undefined,
        );
    }
}
