import { Facade } from 'Illuminate/Support/Facades/Facade';
import { Forwards } from 'Illuminate/Support/Facades/Forwards';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Forwarded } from 'Illuminate/Support/Facades/Forwards';
import type { QueueManager } from 'Illuminate/Queue/QueueManager';

/**
 * @see Illuminate/Queue/QueueManager
 */
@Forwards()
export class Queue extends Facade {
    declare public static connection: Forwarded<QueueManager['connection']>;
    declare public static connected: Forwarded<QueueManager['connected']>;
    declare public static extend: Forwarded<QueueManager['extend']>;
    declare public static addConnector: Forwarded<QueueManager['addConnector']>;
    declare public static before: Forwarded<QueueManager['before']>;
    declare public static after: Forwarded<QueueManager['after']>;
    declare public static exceptionOccurred: Forwarded<QueueManager['exceptionOccurred']>;
    declare public static failing: Forwarded<QueueManager['failing']>;
    declare public static getDefaultDriver: Forwarded<QueueManager['getDefaultDriver']>;
    declare public static setDefaultDriver: Forwarded<QueueManager['setDefaultDriver']>;
    declare public static getName: Forwarded<QueueManager['getName']>;
    declare public static size: Forwarded<QueueManager['size']>;
    declare public static push: Forwarded<QueueManager['push']>;
    declare public static pushOn: Forwarded<QueueManager['pushOn']>;
    declare public static pushRaw: Forwarded<QueueManager['pushRaw']>;
    declare public static later: Forwarded<QueueManager['later']>;
    declare public static laterOn: Forwarded<QueueManager['laterOn']>;
    declare public static bulk: Forwarded<QueueManager['bulk']>;
    declare public static pop: Forwarded<QueueManager['pop']>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return 'queue';
    }
}
