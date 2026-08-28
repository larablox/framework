import { Facade } from 'Illuminate/Support/Facades/Facade';
import { Factory } from 'Illuminate/Http/Client/Factory';
import { Forwards } from 'Illuminate/Support/Facades/Forwards';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Forwarded } from 'Illuminate/Support/Facades/Forwards';

/**
 * @see Illuminate/Http/Client/Factory
 *
 * PHP's `Http` facade is the outgoing HTTP client, and that is exactly what it
 * is here: the client calling the server. The other direction --  a request
 * arriving and being handled -- is `Illuminate\Http\Request` and the router,
 * as it is in PHP.
 *
 * The faking helpers (`fake`, `assertSent`, `preventStrayRequests`) are not
 * forwarded; they are not ported.
 */
@Forwards()
export class Http extends Facade {
    declare public static createPendingRequest: Forwarded<Factory['createPendingRequest']>;

    declare public static withoutWaiting: Forwarded<Factory['withoutWaiting']>;

    declare public static unreliable: Forwarded<Factory['unreliable']>;

    declare public static retry: Forwarded<Factory['retry']>;

    declare public static throw: Forwarded<Factory['throw']>;

    declare public static throwIf: Forwarded<Factory['throwIf']>;

    declare public static get: Forwarded<Factory['get']>;

    declare public static post: Forwarded<Factory['post']>;

    declare public static put: Forwarded<Factory['put']>;

    declare public static patch: Forwarded<Factory['patch']>;

    declare public static delete: Forwarded<Factory['delete']>;

    declare public static send: Forwarded<Factory['send']>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return Factory;
    }
}
