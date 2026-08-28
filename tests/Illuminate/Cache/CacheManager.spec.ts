/// <reference types="@rbxts/testez/globals" />
import { ArrayStore } from "Illuminate/Cache/ArrayStore";
import { CacheManager } from "Illuminate/Cache/CacheManager";
import { Container } from "Illuminate/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { InvalidArgumentException } from "Illuminate/Exception";
import { NullStore } from "Illuminate/Cache/NullStore";
import { Repository } from "Illuminate/Cache/Repository";
import { Repository as ConfigRepository } from "Illuminate/Config/Repository";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { ArrayAccessible } from "Illuminate/Support/Arr";

/**
 * PHP: `Illuminate\Tests\Cache\CacheManagerTest`.
 *
 * `CacheManager` here takes an `Application`, but only ever calls
 * `bound()`/`make()` on it (see `CacheManager.ts`'s `repository()`/
 * `getConfig()`/`getDefaultDriver()`/`setDefaultDriver()`). The real
 * `Container` (`Illuminate/Container/Container`) already implements every one
 * of those; it is not the full `Application` interface (no `version()`,
 * `environment()`, service-provider registration, ...), so it is handed to
 * `CacheManager` through a cast, the same shortcut PHP's untyped array
 * `$app = ['config' => ...]` takes in `testForgetDriverForgets` below --
 * standing up the real `Foundation/Application.ts` for this would boot far
 * more than these tests exercise.
 *
 * Not ported, no equivalent in this port's `CacheManager.ts` (see its own
 * class comment for the driver list): the `storage` driver
 * (`testItCanCreateStorageDriver`, `StorageStore` does not exist here), the
 * memoized-store `refreshEventDispatcher()`/`memo()` machinery
 * (`testItRefreshesDispatcherOnAllStores`, `testItPurgesMemoizedStoreObjects`
 * -- adapted below to `purge()`'s plain "drop the cached repository" effect,
 * which is all this port's `purge()` does), Mockery partial mocks
 * (`testForgetDriver`'s `shouldAllowMockingProtectedMethods()->makePartial()`
 * -- there is no partial-mock equivalent, and the same "forgetting purges the
 * resolved repository" ground is already covered by
 * `testForgetDriverForgets` below), and PHP backed/unit enum store names
 * (`testEnumStoreCanBeResolved`, `testEnumDriverCanBeResolved`,
 * `testForgetDriverAcceptsEnum`, `testPurgeAcceptsEnum`,
 * `testSetDefaultDriverAcceptsEnum` -- a store name here is already a plain
 * string, with no separate enum-name form to distinguish it from; the same
 * resolve/forget/purge/setDefaultDriver mechanics are covered by their
 * plain-string counterparts elsewhere in this file).
 */

/** Builds an `Application` out of a real `Container`, config included. */
function makeApp(config: ArrayAccessible): Application {
    const container = new Container();
    container.singleton("config", () => new ConfigRepository(config));

    return container as unknown as Application;
}

export = (): void => {
    describe("CacheManager", () => {
        // PHP: CacheManagerTest::testCustomDriverClosureBoundObjectIsCacheManager
        // (adapted -- PHP asserts the closure is bound to the `CacheManager`
        // instance via `Closure::fromCallable($this)`; there is no `$this`
        // rebinding here, so this collapses into the same "extend() registers
        // a creator that store() calls" ground `testInvokableObjectDriverClosure`
        // below already covers.)
        //
        // PHP: CacheManagerTest::testCustomDriverStaticClosure
        it("a custom driver creator registered with extend() is used to build the store", () => {
            const app = makeApp({
                cache: { stores: { custom: { driver: "custom" } } },
            });
            const manager = new CacheManager(app);
            const driver = { flag: true };

            manager.extend("custom", () => driver as never);

            expect(manager.store("custom")).to.equal(driver);
        });

        // PHP: CacheManagerTest::test_custom_driver_overrides_internal_drivers
        it("a custom creator for a built-in driver name overrides the built-in driver", () => {
            const app = makeApp({
                cache: { stores: { my_store: { driver: "array" } } },
            });
            const manager = new CacheManager(app);
            const myArrayDriver = { flag: "mm(u_u)mm" };

            manager.extend("array", () => myArrayDriver as never);

            expect(manager.store("my_store")).to.equal(myArrayDriver);
        });

        // PHP: CacheManagerTest::testItCanBuildRepositories
        it("build() builds a repository straight from a driver config, without a registered store", () => {
            const app = makeApp({});
            const manager = new CacheManager(app);

            const arrayCache = manager.build({ driver: "array" });
            const nullCache = manager.build({ driver: "null" });

            expect(arrayCache.getStore() instanceof ArrayStore).to.equal(true);
            expect(nullCache.getStore() instanceof NullStore).to.equal(true);
        });

        // PHP: CacheManagerTest::testItMakesRepositoryWhenContainerHasNoDispatcher
        it("repository() has no event dispatcher when the container has none bound", () => {
            const app = makeApp({
                cache: { stores: { my_store: { driver: "array" } } },
            });
            expect(app.bound("events")).to.equal(false);

            let manager = new CacheManager(app);
            const theStore = new NullStore();
            let repo = manager.repository(theStore) as Repository;

            expect(repo.getEventDispatcher()).to.equal(undefined);
            expect(repo.getStore()).to.equal(theStore);

            // Binding a dispatcher after the repository's birth has no effect.
            app.bind("events", () => new Dispatcher());

            expect(repo.getEventDispatcher()).to.equal(undefined);

            // A repository born after the binding gets one.
            manager = new CacheManager(app);
            repo = manager.repository(new NullStore()) as Repository;
            expect(repo.getEventDispatcher()).never.to.equal(undefined);
        });

        // PHP: CacheManagerTest::testItSetsDefaultDriverChangesGlobalConfig
        it("setDefaultDriver() writes cache.default in the shared config", () => {
            const app = makeApp({
                cache: {
                    default: "store_1",
                    stores: { store_1: { driver: "array" } },
                },
            });
            const manager = new CacheManager(app);

            manager.setDefaultDriver("><((((@>");

            expect(app.make<ConfigRepository>("config").get("cache.default")).to.equal("><((((@>");
        });

        // PHP: CacheManagerTest::testItPurgesMemoizedStoreObjects (adapted --
        // no MemoizedStore here, see class comment; asserts the same "purge()
        // drops only the named cached repository" contract)
        it("purge() only drops the named cached repository, and the rest are memoized between store() calls", () => {
            const app = makeApp({
                cache: {
                    stores: {
                        store_1: { driver: "array" },
                        store_2: { driver: "null" },
                    },
                },
            });
            const manager = new CacheManager(app);

            const repo1 = manager.store("store_1");
            const repo2 = manager.store("store_1");
            const repo3 = manager.store("store_2");
            const repo4 = manager.store("store_2");

            expect(repo1).to.equal(repo2);
            expect(repo3).to.equal(repo4);
            expect(repo1).never.to.equal(repo3);

            manager.purge("store_1");

            const repo5 = manager.store("store_1");
            expect(repo5).never.to.equal(repo1);

            const repo6 = manager.store("store_2");
            expect(repo6).to.equal(repo3);
        });

        // PHP: CacheManagerTest::testForgetDriverForgets
        it("forgetDriver() drops the cached repository so a fresh one is built next time", () => {
            const manager = new CacheManager(
                makeApp({
                    cache: { stores: { forget: { driver: "forget" } } },
                }),
            );
            manager.extend("forget", () => new ArrayStore() as never);

            manager.store("forget").forever("foo", "bar");
            expect(manager.store("forget").get("foo")).to.equal("bar");

            manager.forgetDriver("forget");

            expect(manager.store("forget").get("foo")).to.equal(undefined);
        });

        // PHP: CacheManagerTest::testThrowExceptionWhenUnknownDriverIsUsed
        it("resolving an unknown driver throws", () => {
            const manager = new CacheManager(
                makeApp({
                    cache: {
                        stores: {
                            my_store: { driver: "unknown_taxi_driver" },
                        },
                    },
                }),
            );

            const [ok, err] = pcall(() => manager.store("my_store"));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
        });

        // PHP: CacheManagerTest::testThrowExceptionWhenUnknownStoreIsUsed
        it("resolving an undefined store throws", () => {
            const manager = new CacheManager(
                makeApp({
                    cache: { stores: { my_store: { driver: "array" } } },
                }),
            );

            const [ok, err] = pcall(() => manager.store("alien_store"));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
        });

        // PHP: CacheManagerTest::testMakesRepositoryWithoutDispatcherWhenEventsDisabled
        it("events: false in the store config skips the event dispatcher", () => {
            const app = makeApp({
                cache: {
                    stores: {
                        my_store: { driver: "array" },
                        my_store_without_events: {
                            driver: "array",
                            events: false,
                        },
                    },
                },
            });
            app.bind("events", () => new Dispatcher());

            const manager = new CacheManager(app);

            const repo = manager.store("my_store") as Repository;
            expect(repo.getEventDispatcher()).never.to.equal(undefined);

            const repoWithoutEvents = manager.store("my_store_without_events") as Repository;
            expect(repoWithoutEvents.getEventDispatcher()).to.equal(undefined);
        });
    });
};
