import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';
import type { Route } from 'Illuminate/Routing/Route';

/** PHP: `Illuminate\Routing\Contracts\ControllerDispatcher`. */
export interface ControllerDispatcher {
    /** Dispatch a request to a given controller and method. */
    dispatch(route: Route, controller: object, method: string): unknown;

    /** Get the middleware for the controller instance. */
    getMiddleware(controller: object, method: string): Array<Pipe>;
}
