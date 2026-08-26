/// <reference types="@rbxts/testez/globals" />
import { Arr } from "Illuminate/Support/Arr";
import { Container } from "Illuminate/Container/Container";
import { Repository as ConfigRepository } from "Illuminate/Config/Repository";
import { NullConnector } from "Illuminate/Queue/Connectors/NullConnector";
import { NullQueue } from "Illuminate/Queue/NullQueue";
import { QueueManager } from "Illuminate/Queue/QueueManager";
import { SyncConnector } from "Illuminate/Queue/Connectors/SyncConnector";
import { SyncQueue } from "Illuminate/Queue/SyncQueue";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { ArrayAccessible } from "Illuminate/Support/Arr";

/**
 * PHP: `Illuminate\Tests\Queue\QueueManagerTest`.
 *
 * Upstream hands `QueueManager` an untyped array `$app = ['config' => ...]`
 * and mocks the connector and the resolved queue with Mockery expectations
 * (`shouldReceive('setConnectionName')->once()`, ...). `QueueManager.ts` only
 * ever calls `bound()`/`make()` on its `Application` (see `getConfig()`/
 * `events()`), so a real `Container` with a real `Config/Repository` is used
 * instead -- the same shortcut `CacheManager.spec.ts`'s `makeApp()` takes --
 * and the connectors/queues below are the real `SyncConnector`/`SyncQueue`
 * and `NullConnector`/`NullQueue`, asserted on their actual post-conditions
 * (`getConnectionName()`, identity across calls) rather than a mocked call.
 *
 * Not ported: `testEnumConnectionCanBeResolved`, `testEnumConnectionCanBeChecked`,
 * `testSetDefaultDriverAcceptsBackedEnum` -- `connection()`/`connected()`/
 * `setDefaultDriver()` take a plain `string` here (see `QueueManager.ts`), with
 * no separate backed-enum form to distinguish from the plain-string cases
 * below.
 */

function makeApp(config: ArrayAccessible): Application {
    const container = new Container();

    // The fixtures below are written with dotted keys for readability, but
    // `Repository` addresses a *nested* table -- and `set()` writes into one,
    // so a flat `"queue.default"` key would be shadowed the moment
    // `setDefaultDriver()` wrote a nested one beside it.
    container.singleton(
        "config",
        () => new ConfigRepository(Arr.undot(config)),
    );

    return container as unknown as Application;
}

export = (): void => {
    describe("QueueManager", () => {
        // PHP: QueueManagerTest::testDefaultConnectionCanBeResolved
        it("resolves the default connection through its registered connector", () => {
            const app = makeApp({
                "queue.default": "sync",
                "queue.connections.sync": { driver: "sync" },
            });
            const manager = new QueueManager(app);
            manager.addConnector("sync", () => new SyncConnector());

            const queue = manager.connection("sync");

            expect(queue instanceof SyncQueue).to.equal(true);
            expect(queue.getConnectionName()).to.equal("sync");
            expect(manager.connection("sync")).to.equal(queue);
        });

        // PHP: QueueManagerTest::testOtherConnectionCanBeResolved
        it("resolves a non-default connection by name", () => {
            const app = makeApp({
                "queue.default": "sync",
                "queue.connections.foo": { driver: "bar" },
            });
            const manager = new QueueManager(app);
            manager.addConnector("bar", () => new SyncConnector());

            const queue = manager.connection("foo");

            expect(queue.getConnectionName()).to.equal("foo");
        });

        // PHP: QueueManagerTest::testNullConnectionCanBeResolved
        it("resolves the null connection when the default driver is 'null'", () => {
            const app = makeApp({ "queue.default": "null" });
            const manager = new QueueManager(app);
            manager.addConnector("null", () => new NullConnector());

            const queue = manager.connection("null");

            expect(queue instanceof NullQueue).to.equal(true);
            expect(queue.getConnectionName()).to.equal("null");
        });

        // PHP: no direct equivalent -- exercises `getConfig()`'s "no name given"
        // branch, `{ driver: 'null' }`, the same branch `testNullConnectionCanBeResolved`
        // reaches by explicit name.
        it("falls back to a null driver config when no connection is named", () => {
            const app = makeApp({});
            const manager = new QueueManager(app);
            manager.addConnector("null", () => new NullConnector());

            const queue = manager.connection();

            expect(queue instanceof NullQueue).to.equal(true);
        });

        it("connected() reports whether a connection has already been resolved", () => {
            const app = makeApp({
                "queue.default": "sync",
                "queue.connections.sync": { driver: "sync" },
            });
            const manager = new QueueManager(app);
            manager.addConnector("sync", () => new SyncConnector());

            expect(manager.connected("sync")).to.equal(false);
            manager.connection("sync");
            expect(manager.connected("sync")).to.equal(true);
        });

        it("push() forwards to the default connection", () => {
            const app = makeApp({
                "queue.default": "sync",
                "queue.connections.sync": { driver: "sync" },
            });
            const manager = new QueueManager(app);
            manager.addConnector("sync", () => new SyncConnector());

            let fired = false;

            class Handler {
                public fire(): void {
                    fired = true;
                }
            }

            manager.push(Handler);

            expect(fired).to.equal(true);
        });

        it("getDefaultDriver()/setDefaultDriver() read and write the config", () => {
            const app = makeApp({
                "queue.default": "sync",
                "queue.connections.sync": { driver: "sync" },
            });
            const manager = new QueueManager(app);

            expect(manager.getDefaultDriver()).to.equal("sync");

            manager.setDefaultDriver("other");

            expect(manager.getDefaultDriver()).to.equal("other");
        });
    });
};
