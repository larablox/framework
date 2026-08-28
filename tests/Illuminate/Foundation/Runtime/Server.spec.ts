/// <reference types="@rbxts/testez/globals" />
import { Application } from 'Illuminate/Foundation/Application';
import { Kernel } from 'Illuminate/Foundation/Http/Kernel';
import { RuntimeException } from 'Illuminate/Exception';
import { Server } from 'Illuminate/Foundation/Runtime/Server';
import { Worker } from 'Illuminate/Foundation/Runtime/Worker';
import { expectThrows } from '../../TestHelpers';
import type { RemoteGateway } from 'Illuminate/Http/RemoteGateway';

/**
 * No PHP counterpart: Octane's server is the runtime under PHP rather than a
 * class in it, so there is nothing upstream to port a test from.
 */
export = (): void => {
    describe('Foundation.Runtime.Server', () => {
        /**
         * An application booted far enough to start a server on.
         *
         * `bootstrapWith([])` marks it bootstrapped without running anything,
         * so `Kernel::bootstrap()` becomes a no-op and no configuration
         * repository is needed.
         */
        function application(): Application {
            const app = new Application();

            app.singleton(Kernel);
            app.singleton(Worker);

            app.bootstrapWith([]);

            return app;
        }

        /**
         * A gateway that refuses while `refuses()` says so.
         *
         * The real one attaches to remotes that this test place does not have
         * -- and would block on `WaitForChild` looking for them -- but what is
         * under test is only what the server does when attaching fails.
         */
        function gateway(refuses: () => boolean): RemoteGateway {
            return {
                listen: (): void => {
                    if (refuses()) {
                        throw new RuntimeException('the remotes are not there');
                    }
                },
                stop: (): void => {},
            } as unknown as RemoteGateway;
        }

        it('can be booted again once the gateway stops refusing, and does not blame the worker', () => {
            const app = application();
            let refuses = true;

            const server = new Server(
                app,
                app.make<Worker>(Worker),
                gateway(() => refuses),
            );

            // `boot()` starts the worker before it attaches, so this leaves the
            // worker running while the server counts itself as not booted.
            expectThrows(() => server.boot([]), 'the remotes are not there');

            expect(server.hasBooted()).to.equal(false);

            refuses = false;

            // Whatever kept the gateway from attaching has been fixed, so
            // starting again should work. It is the same call that failed --
            // nothing about the worker changed in between.
            server.boot([]);

            expect(server.hasBooted()).to.equal(true);
        });
    });
};
