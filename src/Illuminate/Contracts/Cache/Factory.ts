import type { Repository } from 'Illuminate/Contracts/Cache/Repository';

/** PHP: `Illuminate\Contracts\Cache\Factory`. */
export interface Factory
{
    /** Get a cache store instance by name. */
    store(name?: string): Repository;
}
