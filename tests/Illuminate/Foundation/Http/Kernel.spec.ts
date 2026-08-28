/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Application } from 'Illuminate/Foundation/Application';
import { Container } from 'Illuminate/Container/Container';
import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import { Kernel } from 'Illuminate/Foundation/Http/Kernel';
import { Request } from 'Illuminate/Http/Request';
import { Response } from 'Illuminate/Http/Response';
import { Router } from 'Illuminate/Routing/Router';
import { SubstituteBindings } from 'Illuminate/Routing/Middleware/SubstituteBindings';
import { Terminating } from 'Illuminate/Foundation/Events/Terminating';
import { ThrottleRequests } from 'Illuminate/Routing/Middleware/ThrottleRequests';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Tests\Foundation\Http\KernelTest`.
 *
 * `testGetRouteMiddleware` is not ported: `Kernel.ts`'s class comment says
 * plainly that `$routeMiddleware` -- "PHP itself marks deprecated" -- has no
 * counterpart here; there is no `getRouteMiddleware()` to call.
 *
 * `testGetMiddlewarePriority`, `testAddToMiddlewarePriorityAfter` and
 * `testAddToMiddlewarePriorityBefore` are adapted to the priority list this
 * port's `Kernel` actually ships (`ThrottleRequests`, `SubstituteBindings`,
 * per `Kernel.ts`'s class comment: "PHP's list is longer only because it has
 * more middleware to order; what is here is PHP's list with everything
 * unported struck out, in PHP's order") rather than upstream's eleven-entry
 * list, most of which (`EncryptCookies`, `StartSession`,
 * `AuthenticatesRequests`, `AuthenticatesSessions`, `Authorize`,
 * `HandlePrecognitiveRequests`, `ThrottleRequestsWithRedis`) name components
 * that are not ported. A fixture middleware class fills in for the entry
 * being moved, since the mechanics under test -- `addToMiddlewarePriorityAfter`/
 * `Before`'s splice logic -- do not depend on which two classes bracket it.
 */
export = (): void => {
    describe('Foundation.Http.Kernel', () => {
        class ValidateSignatureStub {}

        function application(): Application {
            return new Application();
        }

        function router(): Router {
            return new Router(new Dispatcher(), new Container());
        }

        it('getMiddlewareGroups() starts empty', () => {
            // PHP: KernelTest::testGetMiddlewareGroups
            const kernel = new Kernel(application(), router());

            expectDeepEqual(kernel.getMiddlewareGroups(), {});
        });

        it("getMiddlewarePriority() returns this port's shorter default list (adapted -- see class comment)", () => {
            // PHP: KernelTest::testGetMiddlewarePriority
            const kernel = new Kernel(application(), router());

            expectDeepEqual(kernel.getMiddlewarePriority(), [ThrottleRequests, SubstituteBindings] as Array<Pipe>);
        });

        it('addToMiddlewarePriorityAfter() splices the entry in after the named middleware (adapted -- see class comment)', () => {
            // PHP: KernelTest::testAddToMiddlewarePriorityAfter
            const kernel = new Kernel(application(), router());

            // Anchored on the *last* entry of this port's shortened priority
            // list. Upstream anchors mid-list; anchoring on the first entry
            // instead would land on PHP's own corner, where `$index` never
            // moves off its initial `0` and `array_splice()` puts the new
            // entry in front of the anchor rather than after it.
            kernel.addToMiddlewarePriorityAfter([SubstituteBindings], ValidateSignatureStub);

            expectDeepEqual(kernel.getMiddlewarePriority(), [
                ThrottleRequests,
                SubstituteBindings,
                ValidateSignatureStub,
            ] as Array<Pipe>);
        });

        it('addToMiddlewarePriorityBefore() splices the entry in before the named middleware (adapted -- see class comment)', () => {
            // PHP: KernelTest::testAddToMiddlewarePriorityBefore
            const kernel = new Kernel(application(), router());

            kernel.addToMiddlewarePriorityBefore([SubstituteBindings], ValidateSignatureStub);

            expectDeepEqual(kernel.getMiddlewarePriority(), [
                ThrottleRequests,
                ValidateSignatureStub,
                SubstituteBindings,
            ] as Array<Pipe>);
        });

        it("terminate() dispatches Terminating, runs terminable middleware, then the app's terminating callbacks", () => {
            // PHP: KernelTest::testItTriggersTerminatingEvent
            const called = new Array<string>();
            const app = application();
            const events = new Dispatcher(app);
            app.instance('events', events);

            const kernel = new Kernel(app, router());

            class TerminatingMiddlewareStub {
                public handle(request: Request, _next: (request: Request) => Response): Response {
                    return _next(request);
                }

                public terminate(): void {
                    called.push('terminating middleware');
                }
            }

            app.instance('terminating-middleware', new TerminatingMiddlewareStub());
            kernel.setGlobalMiddleware(['terminating-middleware']);

            events.listen(Terminating, () => {
                called.push('terminating event');
            });
            app.terminating(() => {
                called.push('terminating callback');
            });

            kernel.terminate(new Request({} as Player, 'GET', '/'), new Response());

            expectDeepEqual(called, ['terminating event', 'terminating middleware', 'terminating callback']);
        });
    });
};
