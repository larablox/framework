import { Facade } from "Illuminate/Support/Facades/Facade";
import { Forwards } from "Illuminate/Support/Facades/Forwards";
import { Repository } from "Illuminate/Log/Context/Repository";
import type { Abstract } from "Illuminate/Container/Types";
import type { Forwarded } from "Illuminate/Support/Facades/Forwards";

/**
 * @see Illuminate/Log/Context/Repository
 */
@Forwards()
export class Context extends Facade {
    declare public static has: Forwarded<Repository["has"]>;
    declare public static missing: Forwarded<Repository["missing"]>;
    declare public static hasHidden: Forwarded<Repository["hasHidden"]>;
    declare public static missingHidden: Forwarded<Repository["missingHidden"]>;
    declare public static all: Forwarded<Repository["all"]>;
    declare public static allHidden: Forwarded<Repository["allHidden"]>;
    declare public static get: Forwarded<Repository["get"]>;
    declare public static getHidden: Forwarded<Repository["getHidden"]>;
    declare public static pull: Forwarded<Repository["pull"]>;
    declare public static pullHidden: Forwarded<Repository["pullHidden"]>;
    declare public static only: Forwarded<Repository["only"]>;
    declare public static onlyHidden: Forwarded<Repository["onlyHidden"]>;
    declare public static except: Forwarded<Repository["except"]>;
    declare public static exceptHidden: Forwarded<Repository["exceptHidden"]>;
    declare public static add: Forwarded<Repository["add"]>;
    declare public static addHidden: Forwarded<Repository["addHidden"]>;
    declare public static addIf: Forwarded<Repository["addIf"]>;
    declare public static addHiddenIf: Forwarded<Repository["addHiddenIf"]>;
    declare public static remember: Forwarded<Repository["remember"]>;
    declare public static rememberHidden: Forwarded<
        Repository["rememberHidden"]
    >;
    declare public static forget: Forwarded<Repository["forget"]>;
    declare public static forgetHidden: Forwarded<Repository["forgetHidden"]>;
    declare public static push: Forwarded<Repository["push"]>;
    declare public static pop: Forwarded<Repository["pop"]>;
    declare public static pushHidden: Forwarded<Repository["pushHidden"]>;
    declare public static popHidden: Forwarded<Repository["popHidden"]>;
    declare public static increment: Forwarded<Repository["increment"]>;
    declare public static decrement: Forwarded<Repository["decrement"]>;
    declare public static stackContains: Forwarded<Repository["stackContains"]>;
    declare public static hiddenStackContains: Forwarded<
        Repository["hiddenStackContains"]
    >;
    declare public static scope: Forwarded<Repository["scope"]>;
    declare public static isEmpty: Forwarded<Repository["isEmpty"]>;
    declare public static dehydrating: Forwarded<Repository["dehydrating"]>;
    declare public static hydrated: Forwarded<Repository["hydrated"]>;
    declare public static flush: Forwarded<Repository["flush"]>;
    declare public static dehydrate: Forwarded<Repository["dehydrate"]>;
    declare public static hydrate: Forwarded<Repository["hydrate"]>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return Repository;
    }
}
