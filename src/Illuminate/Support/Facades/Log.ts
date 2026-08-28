import { Facade } from "Illuminate/Support/Facades/Facade";
import { Forwards } from "Illuminate/Support/Facades/Forwards";
import type { Abstract } from "Illuminate/Container/Types";
import type { Forwarded } from "Illuminate/Support/Facades/Forwards";
import type { LogManager } from "Illuminate/Log/LogManager";
import type { Logger } from "Illuminate/Log/Logger";

/**
 * @see Illuminate/Log/LogManager
 */
@Forwards()
export class Log extends Facade {
    declare public static emergency: Forwarded<LogManager["emergency"]>;
    declare public static alert: Forwarded<LogManager["alert"]>;
    declare public static critical: Forwarded<LogManager["critical"]>;
    declare public static error: Forwarded<LogManager["error"]>;
    declare public static warning: Forwarded<LogManager["warning"]>;
    declare public static notice: Forwarded<LogManager["notice"]>;
    declare public static info: Forwarded<LogManager["info"]>;
    declare public static debug: Forwarded<LogManager["debug"]>;
    declare public static log: Forwarded<LogManager["log"]>;
    declare public static channel: Forwarded<LogManager["channel"]>;
    declare public static driver: Forwarded<LogManager["driver"]>;
    declare public static stack: Forwarded<LogManager["stack"]>;
    declare public static build: Forwarded<LogManager["build"]>;
    declare public static extend: Forwarded<LogManager["extend"]>;
    declare public static forgetChannel: Forwarded<LogManager["forgetChannel"]>;
    declare public static getChannels: Forwarded<LogManager["getChannels"]>;
    declare public static getDefaultDriver: Forwarded<LogManager["getDefaultDriver"]>;
    declare public static setDefaultDriver: Forwarded<LogManager["setDefaultDriver"]>;
    declare public static shareContext: Forwarded<LogManager["shareContext"]>;
    declare public static sharedContext: Forwarded<LogManager["sharedContext"]>;
    declare public static withoutContext: Forwarded<LogManager["withoutContext"]>;
    declare public static flushSharedContext: Forwarded<LogManager["flushSharedContext"]>;
    declare public static listen: Forwarded<Logger["listen"]>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return "log";
    }
}
