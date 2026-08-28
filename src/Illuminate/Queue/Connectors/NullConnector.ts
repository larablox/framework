import { NullQueue } from 'Illuminate/Queue/NullQueue';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { ConnectorInterface } from 'Illuminate/Queue/Connectors/ConnectorInterface';
import type { Queue } from 'Illuminate/Contracts/Queue/Queue';

/** PHP: `Illuminate\Queue\Connectors\NullConnector`. */
export class NullConnector implements ConnectorInterface
{
    /** Establish a queue connection: a null queue has nothing to configure. */
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above */
    public connect(config: ArrayAccessible): Queue
    {
        return new NullQueue();
    }
}
