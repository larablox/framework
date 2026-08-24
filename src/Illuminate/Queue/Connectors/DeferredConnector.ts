import { DeferredQueue } from "Illuminate/Queue/DeferredQueue";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { ConnectorInterface } from "Illuminate/Queue/Connectors/ConnectorInterface";
import type { Queue } from "Illuminate/Contracts/Queue/Queue";

/** PHP: `Illuminate\Queue\Connectors\DeferredConnector`. */
export class DeferredConnector implements ConnectorInterface {
    /** Establish a queue connection. */
    public connect(config: ArrayAccessible): Queue {
        return new DeferredQueue(config.after_commit as boolean | undefined);
    }
}
