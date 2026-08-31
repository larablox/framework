import { SyncQueue } from 'Illuminate/Queue/SyncQueue';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { ConnectorInterface } from 'Illuminate/Queue/Connectors/ConnectorInterface';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: `Illuminate\Queue\Connectors\SyncConnector`. */
export class SyncConnector implements ConnectorInterface
{
    /** Establish a queue connection. */
    public connect(config: ArrayAccessible): Queue
    {
        return new SyncQueue(config.after_commit as boolean | undefined);
    }
}
