import { Facade } from 'Illuminate/Support/Facades/Facade';
import { Forwards } from 'Illuminate/Support/Facades/Forwards';
import type { Forwarded } from 'Illuminate/Support/Facades/Forwards';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Repository } from 'Illuminate/Contracts/Config/Repository';
import type { Repository as ConfigRepository } from 'Illuminate/Config/Repository';

/**
 * @see Illuminate/Config/Repository
 */
@Forwards()
export class Config extends Facade {
    declare public static has: Forwarded<Repository['has']>;
    declare public static get: Forwarded<Repository['get']>;
    declare public static getMany: Forwarded<Repository['getMany']>;
    declare public static set: Forwarded<Repository['set']>;
    declare public static prepend: Forwarded<Repository['prepend']>;
    declare public static push: Forwarded<Repository['push']>;
    declare public static all: Forwarded<Repository['all']>;
    declare public static string: Forwarded<ConfigRepository['string']>;
    declare public static integer: Forwarded<ConfigRepository['integer']>;
    declare public static boolean: Forwarded<ConfigRepository['boolean']>;
    declare public static array: Forwarded<ConfigRepository['array']>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return 'config';
    }
}
