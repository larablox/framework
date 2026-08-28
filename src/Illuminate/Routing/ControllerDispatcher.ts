import { ResolvesRouteDependencies } from 'Illuminate/Routing/ResolvesRouteDependencies';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ControllerDispatcher as ControllerDispatcherContract } from 'Illuminate/Routing/Contracts/ControllerDispatcher';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused in the code, but declaration emit writes the specifier from this import; without it the `.d.ts` keeps the baseUrl path, which no consumer can resolve.
import type { ResolvesRouteDependenciesShape } from 'Illuminate/Routing/ResolvesRouteDependencies';
import type { Route } from 'Illuminate/Routing/Route';

/**
 * What a controller may expose to the dispatcher.
 *
 * Both are declared as properties rather than methods, which is what makes
 * roblox-ts compile the call with a dot: the receiver is then passed by hand,
 * and the signatures say so. Declaring them as methods would emit a colon call
 * and hand the controller in twice.
 */
interface DispatchableController {
    callAction?: (receiver: object, method: string, parameters: Array<defined>) => unknown;
    getMiddleware?: (receiver: object) => Array<Pipe>;
}

/** PHP: `Illuminate\Routing\ControllerDispatcher`. */
export class ControllerDispatcher extends ResolvesRouteDependencies() implements ControllerDispatcherContract {
    /** Create a new controller dispatcher instance. */
    public constructor(container: Container) {
        super();

        this.container = container;
    }

    /** Dispatch a request to a given controller and method. */
    public dispatch(route: Route, controller: object, method: string): unknown {
        const parameters = this.resolveParameters(route, controller, method);

        const dispatchable = controller as DispatchableController;

        if (dispatchable.callAction !== undefined) {
            return dispatchable.callAction(controller, method, parameters);
        }

        const action = (controller as unknown as Record<string, Callback>)[method];

        return action(controller, ...parameters);
    }

    /** Resolve the parameters for the controller method. */
    protected resolveParameters(route: Route, controller: object, method: string): Array<defined> {
        return this.resolveClassMethodDependencies(route.parametersWithoutNulls(), controller, method);
    }

    /**
     * Get the middleware for the controller instance.
     *
     * PHP filters the list by the method through `ControllerMiddlewareOptions`
     * (`only`, `except`), which is not ported, so the method is unused here.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the PHP signature.
    public getMiddleware(controller: object, method: string): Array<Pipe> {
        const dispatchable = controller as DispatchableController;

        if (dispatchable.getMiddleware === undefined) {
            return [];
        }

        return dispatchable.getMiddleware(controller);
    }
}
