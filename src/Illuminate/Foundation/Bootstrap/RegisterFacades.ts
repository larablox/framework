import { Facade } from 'Illuminate/Support/Facades/Facade';
import type { Application, Bootstrapper } from 'Illuminate/Contracts/Foundation/Application';

/**
 * PHP: `Illuminate\Foundation\Bootstrap\RegisterFacades`.
 *
 * `AliasLoader` is not ported: it registers a PHP autoloader so `\Config`
 * resolves to the facade class without an import. TypeScript modules have no
 * global namespace to alias into -- a facade is imported like anything else.
 */
export class RegisterFacades implements Bootstrapper
{
    /** Bootstrap the given application. */
    public bootstrap(app: Application): void
    {
        Facade.clearResolvedInstances();

        Facade.setFacadeApplication(app);
    }
}
