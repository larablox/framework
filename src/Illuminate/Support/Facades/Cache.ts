import { Facade } from "Illuminate/Support/Facades/Facade";
import { Forwards } from "Illuminate/Support/Facades/Forwards";
import type { Abstract } from "Illuminate/Container/Types";
import type { CacheManager } from "Illuminate/Cache/CacheManager";
import type { Forwarded } from "Illuminate/Support/Facades/Forwards";
import type { Repository } from "Illuminate/Cache/Repository";

/**
 * @see Illuminate/Cache/CacheManager
 *
 * PHP forwards anything the manager does not answer to the default store
 * through `__call`; the store's own methods are listed here instead, and the
 * facade resolves `cache.store` so they land on the repository.
 */
@Forwards()
export class Cache extends Facade {
    declare public static has: Forwarded<Repository["has"]>;
    declare public static missing: Forwarded<Repository["missing"]>;
    declare public static get: Forwarded<Repository["get"]>;
    declare public static many: Forwarded<Repository["many"]>;
    declare public static pull: Forwarded<Repository["pull"]>;
    declare public static put: Forwarded<Repository["put"]>;
    declare public static putMany: Forwarded<Repository["putMany"]>;
    declare public static add: Forwarded<Repository["add"]>;
    declare public static increment: Forwarded<Repository["increment"]>;
    declare public static decrement: Forwarded<Repository["decrement"]>;
    declare public static forever: Forwarded<Repository["forever"]>;
    declare public static remember: Forwarded<Repository["remember"]>;
    declare public static sear: Forwarded<Repository["sear"]>;
    declare public static rememberForever: Forwarded<
        Repository["rememberForever"]
    >;
    declare public static touch: Forwarded<Repository["touch"]>;
    declare public static forget: Forwarded<Repository["forget"]>;
    declare public static clear: Forwarded<Repository["clear"]>;
    declare public static lock: Forwarded<Repository["lock"]>;
    declare public static restoreLock: Forwarded<Repository["restoreLock"]>;
    declare public static string: Forwarded<Repository["string"]>;
    declare public static integer: Forwarded<Repository["integer"]>;
    declare public static boolean: Forwarded<Repository["boolean"]>;
    declare public static array: Forwarded<Repository["array"]>;
    declare public static getStore: Forwarded<Repository["getStore"]>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return "cache.store";
    }
}

/**
 * The manager itself, for `Cache.store("array")` and friends.
 *
 * PHP reaches both through one facade because `CacheManager::__call` forwards
 * to the default store; with no `__call` the two surfaces are two classes.
 */
@Forwards()
export class CacheStores extends Facade {
    declare public static store: Forwarded<CacheManager["store"]>;
    declare public static driver: Forwarded<CacheManager["driver"]>;
    declare public static build: Forwarded<CacheManager["build"]>;
    declare public static repository: Forwarded<CacheManager["repository"]>;
    declare public static extend: Forwarded<CacheManager["extend"]>;
    declare public static forgetDriver: Forwarded<CacheManager["forgetDriver"]>;
    declare public static purge: Forwarded<CacheManager["purge"]>;
    declare public static getDefaultDriver: Forwarded<
        CacheManager["getDefaultDriver"]
    >;
    declare public static setDefaultDriver: Forwarded<
        CacheManager["setDefaultDriver"]
    >;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return "cache";
    }
}
