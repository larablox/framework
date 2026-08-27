/// <reference types="@rbxts/testez/globals" />
import { Application } from "Illuminate/Foundation/Application";
import { Kernel } from "Illuminate/Foundation/Http/Kernel";
import { Request } from "Illuminate/Http/Request";
import { Response } from "Illuminate/Http/Response";
import { Router } from "Illuminate/Routing/Router";
import { Worker } from "Illuminate/Foundation/Runtime/Worker";
import type { Route } from "Illuminate/Routing/Route";

/**
 * No PHP counterpart: `Laravel\Octane\Worker` has no test to port, and the
 * property under test here does not exist there. An Octane worker serves one
 * request at a time, so nothing can take the kernel away from it mid-request;
 * a remote handler is a coroutine and something can.
 */
export = (): void => {
    describe("Foundation.Runtime.Worker", () => {
        /**
         * An application booted far enough to serve a request.
         *
         * `bootstrapWith([])` marks it bootstrapped without running anything,
         * so `Kernel::bootstrap()` becomes a no-op; `boot([])` warms nothing,
         * which is what keeps this from needing a configuration repository.
         */
        function booted(terminated: Array<string>): Application {
            const app = new Application();

            app.singleton(Kernel);
            app.singleton(Worker);

            app.bootstrapWith([]);

            app.make<Router>("router").get(
                "t/{id}",
                (request: Request, id: string) => {
                    // The route's container is this request's sandbox, so the
                    // callback is registered there and nowhere else. It fires
                    // only if that sandbox is the application terminated.
                    const sandbox = (
                        request.route() as Route
                    ).getContainer() as Application;

                    sandbox.terminating(() => {
                        terminated.push(id);
                    });

                    return new Response("ok");
                },
            );

            return app;
        }

        it("terminates the sandbox its own request ran on, not whatever the kernel points at now", () => {
            const terminated = new Array<string>();
            const app = booted(terminated);
            const worker = app.make<Worker>(Worker);

            worker.boot([]);

            worker.handle(new Request({} as Player, "GET", "t/one"));

            // What every other request does to the shared kernel: `handle()`
            // points it at its own sandbox and `flushSandbox()` puts it back on
            // the root. Termination is deferred, so it runs after this.
            app.make<Kernel>(Kernel).setApplication(app);

            // Let the deferred termination run.
            task.wait();

            expect(terminated.size()).to.equal(1);
            expect(terminated[0]).to.equal("one");
        });

        it("reports each request's own duration, even once another request has been handled", () => {
            const app = booted(new Array<string>());
            const kernel = app.make<Kernel>(Kernel);
            const reported = new Array<number>();

            // Below any elapsed time, so both requests are always over it.
            kernel.whenRequestLifecycleIsLongerThan(-1, (startedAt: number) => {
                reported.push(startedAt);
            });

            const first = app.sandbox();
            const second = app.sandbox();
            const one = new Request({} as Player, "GET", "t/one");
            const two = new Request({} as Player, "GET", "t/two");

            // Overlapping without yielding: both are in flight before either
            // terminates, which is all it takes.
            const answeredOne = kernel.handle(one, first);
            const answeredTwo = kernel.handle(two, second);

            kernel.terminate(one, answeredOne, first);
            kernel.terminate(two, answeredTwo, second);

            // With the start time on the kernel, the second `handle()` would
            // overwrite the first's, the first's `terminate()` would report
            // that and then clear it, and the second would find nothing left
            // and report nothing at all.
            expect(reported.size()).to.equal(2);
        });
    });
};
