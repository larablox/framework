/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';
import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import { PreparingResponse } from 'Illuminate/Routing/Events/PreparingResponse';
import { Request } from 'Illuminate/Http/Request';
import { ResponsePrepared } from 'Illuminate/Routing/Events/ResponsePrepared';
import { RouteMatched } from 'Illuminate/Routing/Events/RouteMatched';
import { Route } from 'Illuminate/Routing/Route';
import { Router } from 'Illuminate/Routing/Router';
import { Routing } from 'Illuminate/Routing/Events/Routing';

/**
 * PHP: `Illuminate\Tests\Routing\RoutingRouteTest`, the events fired around
 * dispatch (`testRouterFiresRoutedEvent`, `testRouterFiresRouteMatchingEvent`,
 * `testItDispatchesEventsWhilePreparingRequest`).
 *
 * PHP's `Router::matched()` is a thin `$this->events->listen(RouteMatched::class,
 * ...)` wrapper (`matched()` is not ported -- `Router.ts`'s class comment), so
 * `testRouterFiresRoutedEvent` below listens for `RouteMatched` directly
 * instead, which is exactly what it would do.
 */
export = (): void => {
    describe('Routing.Route.Events', () => {
        // PHP: RoutingRouteTest::testRouterFiresRoutedEvent
        it('dispatchToRoute() fires RouteMatched with the request and the matched route', () => {
            const events = new Dispatcher();
            const container = new Container();
            const r = new Router(events, container);

            r.get('foo/bar', () => '');

            const request = new Request({} as Player, 'GET', 'foo/bar');

            let seenRequest: Request | undefined;
            let seenRoute: Route | undefined;

            events.listen(RouteMatched, (event: RouteMatched) => {
                seenRequest = event.request;
                seenRoute = event.route;
            });

            r.dispatchToRoute(request);

            expect(seenRequest).to.equal(request);
            expect(seenRoute?.uri()).to.equal('foo/bar');
        });

        // PHP: RoutingRouteTest::testRouterFiresRouteMatchingEvent
        it('dispatchToRoute() fires Routing with the request before it is matched', () => {
            const events = new Dispatcher();
            const container = new Container();
            const r = new Router(events, container);

            r.get('foo/bar', () => '');

            const request = new Request({} as Player, 'GET', 'foo/bar');
            let seenRequest: Request | undefined;

            events.listen(Routing, (event: Routing) => {
                seenRequest = event.request;
            });

            r.dispatchToRoute(request);

            expect(seenRequest).to.equal(request);
        });

        // PHP: RoutingRouteTest::testItDispatchesEventsWhilePreparingRequest
        it('dispatch() fires PreparingResponse and ResponsePrepared twice each, before and after toResponse()', () => {
            const events = new Dispatcher();
            const preparing = new Array<PreparingResponse>();
            const prepared = new Array<ResponsePrepared>();

            events.listen(PreparingResponse, (event: PreparingResponse) => {
                preparing.push(event);
            });
            events.listen(ResponsePrepared, (event: ResponsePrepared) => {
                prepared.push(event);
            });

            const container = new Container();
            const r = new Router(events, container);
            r.get('foo/bar', () => 'hello');

            const request = new Request({} as Player, 'GET', 'foo/bar');
            const response = r.dispatch(request);

            expect(response.content()).to.equal('hello');

            expect(preparing.size()).to.equal(2);
            expect(preparing[0].request).to.equal(request);
            expect(preparing[0].response).to.equal('hello');
            expect(preparing[1].request).to.equal(request);
            expect(preparing[1].response).to.equal(response);

            expect(prepared.size()).to.equal(2);
            expect(prepared[0].request).to.equal(request);
            expect(prepared[0].response).to.equal(response);
            expect(prepared[1].request).to.equal(request);
            expect(prepared[1].response).to.equal(response);
        });
    });
};
