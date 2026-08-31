/// <reference types="@rbxts/testez/globals" />

/**
 * PHP: `Illuminate\Tests\Routing\RouteBindingTest`.
 *
 * Not ported at all. Every case in the PHP file exercises
 * `RouteBinding::forModel()` against an `Illuminate\Database\Eloquent\Model`
 * (one of them a `SoftDeletes` model, to cover `Route::withTrashed()`) --
 * there is neither a `RouteBinding` class nor `Illuminate\Database` in this
 * port (`agent_docs/porting-plan.md`: the database layer has not been
 * started). `Route::bind()`, the part of route binding that *is* ported, is
 * exercised directly against `Router`/`RouteParameterBinder` instead --
 * see `tests/Illuminate/Routing/Route/` for `Router::bind()`-driven cases
 * taken from `RoutingRouteTest`.
 */
export = (): void => {
    describe('Routing.RouteBinding', () => {});
};
