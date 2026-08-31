import type { Route } from 'Illuminate/Routing/Route';

/** PHP: `Illuminate\Routing\Contracts\CallableDispatcher`. */
export interface CallableDispatcher
{
    /** Dispatch a request to a given callable. */
    dispatch(route: Route, callable: Callback): unknown;
}
