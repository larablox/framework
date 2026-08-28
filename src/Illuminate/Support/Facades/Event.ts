import { Facade } from "Illuminate/Support/Facades/Facade";
import { Forwards } from "Illuminate/Support/Facades/Forwards";
import type { Forwarded } from "Illuminate/Support/Facades/Forwards";
import type { Abstract } from "Illuminate/Container/Types";
import type { Dispatcher } from "Illuminate/Contracts/Events/Dispatcher";
import type { Dispatcher as EventDispatcher } from "Illuminate/Events/Dispatcher";

/**
 * @see Illuminate/Events/Dispatcher
 */
@Forwards()
export class Event extends Facade {
    declare public static listen: Forwarded<Dispatcher["listen"]>;
    declare public static hasListeners: Forwarded<Dispatcher["hasListeners"]>;
    declare public static hasWildcardListeners: Forwarded<EventDispatcher["hasWildcardListeners"]>;
    declare public static push: Forwarded<Dispatcher["push"]>;
    declare public static flush: Forwarded<Dispatcher["flush"]>;
    declare public static subscribe: Forwarded<Dispatcher["subscribe"]>;
    declare public static until: Forwarded<Dispatcher["until"]>;
    declare public static dispatch: Forwarded<Dispatcher["dispatch"]>;
    declare public static getListeners: Forwarded<EventDispatcher["getListeners"]>;
    declare public static makeListener: Forwarded<EventDispatcher["makeListener"]>;
    declare public static createClassListener: Forwarded<EventDispatcher["createClassListener"]>;
    declare public static forget: Forwarded<Dispatcher["forget"]>;
    declare public static forgetPushed: Forwarded<Dispatcher["forgetPushed"]>;
    declare public static getRawListeners: Forwarded<EventDispatcher["getRawListeners"]>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return "events";
    }
}
