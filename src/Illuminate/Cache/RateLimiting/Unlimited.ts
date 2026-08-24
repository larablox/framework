import { GlobalLimit } from "Illuminate/Cache/RateLimiting/GlobalLimit";

/**
 * PHP: `Illuminate\Cache\RateLimiting\Unlimited`.
 *
 * PHP passes `PHP_INT_MAX`; the widest integer Luau counts exactly is 2^53.
 */
export class Unlimited extends GlobalLimit {
    /** Create a new limit instance. */
    public constructor() {
        super(2 ** 53);
    }
}
