import { Facade } from "Illuminate/Support/Facades/Facade";
import { Forwards } from "Illuminate/Support/Facades/Forwards";
import { RateLimiter as Limiter } from "Illuminate/Cache/RateLimiter";
import type { Abstract } from "Illuminate/Container/Types";
import type { Forwarded } from "Illuminate/Support/Facades/Forwards";

/**
 * @see Illuminate/Cache/RateLimiter
 */
@Forwards()
export class RateLimiter extends Facade {
    declare public static for: Forwarded<Limiter["for"]>;
    declare public static limiter: Forwarded<Limiter["limiter"]>;
    declare public static attempt: Forwarded<Limiter["attempt"]>;
    declare public static tooManyAttempts: Forwarded<
        Limiter["tooManyAttempts"]
    >;
    declare public static hit: Forwarded<Limiter["hit"]>;
    declare public static increment: Forwarded<Limiter["increment"]>;
    declare public static decrement: Forwarded<Limiter["decrement"]>;
    declare public static attempts: Forwarded<Limiter["attempts"]>;
    declare public static resetAttempts: Forwarded<Limiter["resetAttempts"]>;
    declare public static remaining: Forwarded<Limiter["remaining"]>;
    declare public static retriesLeft: Forwarded<Limiter["retriesLeft"]>;
    declare public static clear: Forwarded<Limiter["clear"]>;
    declare public static availableIn: Forwarded<Limiter["availableIn"]>;

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        return Limiter;
    }
}
