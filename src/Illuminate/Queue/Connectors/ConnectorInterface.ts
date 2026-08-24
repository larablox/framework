import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Queue } from "Illuminate/Contracts/Queue/Queue";

/** PHP: `Illuminate\Queue\Connectors\ConnectorInterface`. */
export interface ConnectorInterface {
    /** Establish a queue connection. */
    connect(config: ArrayAccessible): Queue;
}
