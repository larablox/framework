import { Facade } from 'Illuminate/Support/Facades/Facade';
import { Forwards } from 'Illuminate/Support/Facades/Forwards';
import type { Forwarded } from 'Illuminate/Support/Facades/Forwards';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';

/**
 * @see Illuminate/Foundation/Application
 */
@Forwards()
export class App extends Facade {
    declare public static version: Forwarded<Application['version']>;
    declare public static environment: Forwarded<Application['environment']>;
    declare public static bound: Forwarded<Application['bound']>;
    declare public static make: Forwarded<Application['make']>;
    declare public static call: Forwarded<Application['call']>;
    declare public static bind: Forwarded<Application['bind']>;
    declare public static singleton: Forwarded<Application['singleton']>;
    declare public static instance: Forwarded<Application['instance']>;
    declare public static register: Forwarded<Application['register']>;
    declare public static boot: Forwarded<Application['boot']>;
    declare public static booted: Forwarded<Application['booted']>;
    declare public static booting: Forwarded<Application['booting']>;
    declare public static terminating: Forwarded<Application['terminating']>;
    declare public static terminate: Forwarded<Application['terminate']>;
    declare public static hasBeenBootstrapped: Forwarded<Application['hasBeenBootstrapped']>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return 'app';
    }
}
