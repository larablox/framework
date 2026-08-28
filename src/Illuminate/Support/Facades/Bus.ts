import { Facade } from 'Illuminate/Support/Facades/Facade';
import { Forwards } from 'Illuminate/Support/Facades/Forwards';
import { Dispatcher } from 'Illuminate/Bus/Dispatcher';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Forwarded } from 'Illuminate/Support/Facades/Forwards';

/**
 * @see Illuminate/Bus/Dispatcher
 */
@Forwards()
export class Bus extends Facade {
    declare public static dispatch: Forwarded<Dispatcher['dispatch']>;
    declare public static dispatchSync: Forwarded<Dispatcher['dispatchSync']>;
    declare public static dispatchNow: Forwarded<Dispatcher['dispatchNow']>;
    declare public static dispatchToQueue: Forwarded<Dispatcher['dispatchToQueue']>;
    declare public static hasCommandHandler: Forwarded<Dispatcher['hasCommandHandler']>;
    declare public static getCommandHandler: Forwarded<Dispatcher['getCommandHandler']>;
    declare public static batch: Forwarded<Dispatcher['batch']>;
    declare public static findBatch: Forwarded<Dispatcher['findBatch']>;
    declare public static pipeThrough: Forwarded<Dispatcher['pipeThrough']>;
    declare public static map: Forwarded<Dispatcher['map']>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return Dispatcher;
    }
}
