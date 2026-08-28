import { Limit } from 'Illuminate/Cache/RateLimiting/Limit';

/** PHP: `Illuminate\Cache\RateLimiting\GlobalLimit`. */
export class GlobalLimit extends Limit
{
    /** Create a new limit instance. */
    public constructor(maxAttempts: number, decaySeconds = 60)
    {
        super('', maxAttempts, decaySeconds);
    }
}
