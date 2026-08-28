import { ResolvesRouteDependencies } from 'Illuminate/Routing/ResolvesRouteDependencies';
import type { CallableDispatcher as CallableDispatcherContract } from 'Illuminate/Routing/Contracts/CallableDispatcher';
import type { Container } from 'Illuminate/Contracts/Container/Container';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused in the code, but declaration emit writes the specifier from this import; without it the `.d.ts` keeps the baseUrl path, which no consumer can resolve.
import type { ResolvesRouteDependenciesShape } from 'Illuminate/Routing/ResolvesRouteDependencies';
import type { Route } from 'Illuminate/Routing/Route';

/**
 * PHP: `Illuminate\Routing\CallableDispatcher`.
 *
 * PHP reads the closure's type hints and resolves whatever it asks for --
 * usually the request -- placing the route parameters around them. A closure
 * has no class to hang parameter attributes on (decorators only reach class
 * members) and no signature that survives compilation, so there is nothing to
 * read and the argument list is fixed instead:
 *
 * > **the request first, then the route parameters in the order the URI names
 * > them.**
 *
 * ```ts
 * Route.get("shop/{item}", (request, item) => ...);
 * ```
 *
 * A closure that needs anything else should be a controller method, where the
 * parameter attributes work.
 */
export class CallableDispatcher extends ResolvesRouteDependencies() implements CallableDispatcherContract {
    /** Create a new callable dispatcher instance. */
    public constructor(container: Container) {
        super();

        this.container = container;
    }

    /** Dispatch a request to a given callable. */
    public dispatch(route: Route, callable: Callback): unknown {
        return callable(...this.resolveParameters(route));
    }

    /** Resolve the parameters for the callable. */
    protected resolveParameters(route: Route): Array<defined> {
        const values = new Array<defined>();

        if (this.container.bound('request')) {
            values.push(this.container.make('request') as defined);
        }

        for (const value of route.parametersWithoutNulls().values()) {
            values.push(value);
        }

        return values;
    }
}
