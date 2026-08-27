/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { Request } from "Illuminate/Http/Request";
import { Response } from "Illuminate/Http/Response";
import { Router } from "Illuminate/Routing/Router";
import type { Route } from "Illuminate/Routing/Route";

function router(): Router {
    const container = new Container();
    const built = new Router(new Dispatcher(), container);

    container.instance("router", built);

    return built;
}

/**
 * What `Router::current()` answers while requests overlap.
 *
 * PHP keeps the current route and request in two properties, which is exact
 * there: one process serves one request, so whatever is in them is this
 * request's. Here the router is a singleton and a remote handler is a
 * coroutine -- a yield inside a route lets the next request match, overwrite
 * both, and leave the first one reading about the second when it wakes.
 *
 * The guarantee these cases pin is that the accessors answer about the request
 * doing the asking. Not that they are cleared afterwards: PHP does not clear
 * them either, and terminable middleware runs after the response.
 *
 * Two threads are driven by hand rather than with `task.wait()`, so the order
 * is exact and there is no timing to be flaky about. It is the same shape a
 * yield produces for real: a request parks mid-handler, another runs to
 * completion, the first wakes up.
 */
export = (): void => {
    describe("Routing.Router.CurrentRequest", () => {
        /**
         * Dispatch `t/one` on its own thread, park it inside the handler, run
         * `t/two` to completion on this one, then let the first finish.
         *
         * Answers what each of them saw `Router::current()` say, by the id in
         * the route's own parameters.
         */
        function whileOverlapping(): Map<string, unknown> {
            const r = router();
            const seen = new Map<string, unknown>();

            r.get("t/{id}", (id: string) => {
                if (id === "one") {
                    coroutine.yield();
                }

                seen.set(id, (r.current() as Route).parameter("id"));

                return new Response(id);
            });

            const first = coroutine.create(() => {
                r.dispatch(new Request({} as Player, "GET", "t/one"));
            });

            coroutine.resume(first);

            // The second request matches while the first is parked, which is
            // what overwrites the router's two fields today.
            r.dispatch(new Request({} as Player, "GET", "t/two"));

            coroutine.resume(first);

            return seen;
        }

        it("Router::current() answers about the request asking, not the one that matched last", () => {
            const seen = whileOverlapping();

            expect(seen.get("two")).to.equal("two");
            expect(seen.get("one")).to.equal("one");
        });

        it("Request::route() answers about the request asking, as it already did", () => {
            const r = router();
            const seen = new Map<string, unknown>();

            const one = new Request({} as Player, "GET", "t/one");

            r.get("t/{id}", (id: string) => {
                if (id === "one") {
                    coroutine.yield();
                }

                seen.set(id, (one.route() as Route).parameter("id"));

                return new Response(id);
            });

            const first = coroutine.create(() => {
                r.dispatch(one);
            });

            coroutine.resume(first);
            r.dispatch(new Request({} as Player, "GET", "t/two"));
            coroutine.resume(first);

            expect(seen.get("one")).to.equal("one");
        });

        it("Router::getCurrentRequest() is the request being dispatched on this thread", () => {
            const r = router();
            const seen = new Map<string, unknown>();

            r.get("t/{id}", (id: string) => {
                if (id === "one") {
                    coroutine.yield();
                }

                seen.set(id, r.getCurrentRequest());

                return new Response(id);
            });

            const one = new Request({} as Player, "GET", "t/one");
            const two = new Request({} as Player, "GET", "t/two");

            const first = coroutine.create(() => {
                r.dispatch(one);
            });

            coroutine.resume(first);
            r.dispatch(two);
            coroutine.resume(first);

            expect(seen.get("two")).to.equal(two);
            expect(seen.get("one")).to.equal(one);
        });

        it("keeps answering after the request it dispatched has finished", () => {
            // PHP does not clear these either, and terminable middleware runs
            // after the response -- so a dispatch leaves them readable rather
            // than emptied.
            const r = router();

            r.get("t/{id}", (id: string) => new Response(id));

            const one = new Request({} as Player, "GET", "t/one");

            r.dispatch(one);

            expect(r.getCurrentRequest()).to.equal(one);
            expect((r.current() as Route).parameter("id")).to.equal("one");
        });
    });
};
