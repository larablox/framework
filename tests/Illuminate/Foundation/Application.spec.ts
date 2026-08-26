/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../TestHelpers";
import { Application } from "Illuminate/Foundation/Application";
import type { Container } from "Illuminate/Contracts/Container/Container";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { LogManager } from "Illuminate/Log/LogManager";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { QueueManager } from "Illuminate/Queue/QueueManager";
import { Reflector } from "Illuminate/Support/Reflector";
import { RegisterFacades } from "Illuminate/Foundation/Bootstrap/RegisterFacades";
import { Repository as ConfigRepository } from "Illuminate/Config/Repository";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type {
    Abstract,
    Concrete,
    Constructor,
} from "Illuminate/Container/Types";

/**
 * PHP: `Illuminate\Tests\Foundation\FoundationApplicationTest`.
 *
 * `agent_docs/porting-plan.md`'s "### Foundation" section and `Application.ts`'s
 * class comment list what a place has no counterpart for: paths, `.env`,
 * locales (`setLocale`/`LocaleUpdated`), `runningInConsole`/`runningUnitTests`/
 * `hasDebugModeEnabled`, maintenance mode, `abort()`, `Macroable`, config-path
 * merging, route/event caches, and the `translator`/`auth.password` container
 * aliases. Every upstream test that exercises one of those has no analogue
 * here and is dropped, grouped by theme below rather than case by case:
 *
 * - `testSetLocaleSetsLocaleAndFiresLocaleChangedEvent` -- no `setLocale()`,
 *   no `translator`, no `LocaleUpdated`.
 * - `testEnvironmentHelpers`'s `runningUnitTests()` assertions, `testDebugHelper`
 *   -- `runningUnitTests()`/`hasDebugModeEnabled()` are not ported (the rest of
 *   `testEnvironmentHelpers` -- `isLocal()`/`isProduction()` -- is ported below
 *   as `testEnvironment` is).
 * - `testMethodAfterLoadingEnvironmentAddsClosure` -- `afterLoadingEnvironment()`
 *   and the `LoadEnvironmentVariables` bootstrapper read `.env`; neither exists.
 * - `testGetNamespace`, `testCachePathsResolveToBootstrapCacheDirectory` and
 *   every `testEnvPathsAre*`/`testMacroable`/`testUseConfigPath`/
 *   `testMergingConfig` -- paths, `Macroable`, and config-path merging off a
 *   real filesystem; `LoadConfiguration` here takes its items from
 *   `LoadConfiguration.using()` instead (see `LoadConfiguration.spec.ts`).
 * - `testAbortThrowsNotFoundHttpException`, `testAbortThrowsHttpException`,
 *   `testAbortAcceptsHeaders` -- `abort()` is not ported.
 * - `test_routes_are_cached`, `test_routes_are_not_cached_by_instance_falls_back_to_file`,
 *   `test_events_are_cached_uses_container_instance`,
 *   `test_events_are_cached_checks_filesystem_if_not_set` -- route/event caches
 *   and the `files` binding are not ported.
 * - `testCoreContainerAliasesAreRegisteredByDefault` -- adapted below to the
 *   aliases this port's `registerCoreContainerAliases()` actually registers
 *   (`config`, `events`, `log`, `queue`) rather than upstream's
 *   `translator`/`auth.password*`, which have no ported concrete class.
 *
 * `ApplicationBasicServiceProviderStub`/`ApplicationDeferred*Stub`/
 * `AbstractClass`/`ConcreteClass`/`NonContractBackedClass`/`ConcreteTerminator`
 * below stand in for PHP's fixture classes of the same shape; PHP's Mockery
 * mocks of `ServiceProvider` (`testServiceProvidersAreCorrectlyRegistered`,
 * `...WhenRegisterMethodIsNotFilled`) become a plain fixture subclass with a
 * `register()` override, since there is no mocking framework here.
 */
export = (): void => {
    describe("Foundation.Application", () => {
        class ApplicationBasicServiceProviderStub extends ServiceProvider {
            public registerCalls = 0;

            public register(): void {
                this.registerCalls += 1;
            }
        }

        abstract class AbstractClass {}

        class ConcreteClass extends AbstractClass {}

        class NonContractBackedClass {}

        class BindingsProviderStub extends ServiceProvider {
            public bindings: Array<[Abstract, Concrete]> = [
                [AbstractClass, ConcreteClass],
            ];
        }

        class SingletonsProviderStub extends ServiceProvider {
            public singletons: Array<[Abstract, Concrete] | Abstract> = [
                NonContractBackedClass,
                [AbstractClass, ConcreteClass],
            ];
        }

        class ApplicationDeferredServiceProviderStub extends ServiceProvider {
            public static initialized = false;

            public register(): void {
                ApplicationDeferredServiceProviderStub.initialized = true;
                this.app.instance("foo", "foo");
            }

            public provides(): Array<Abstract> {
                return ["foo"];
            }
        }

        class ApplicationDeferredSharedServiceProviderStub extends ServiceProvider {
            public register(): void {
                this.app.singleton("foo", () => ({}));
            }

            public provides(): Array<Abstract> {
                return ["foo"];
            }
        }

        class ApplicationDeferredServiceProviderCountStub extends ServiceProvider {
            public static count = 0;

            public register(): void {
                ApplicationDeferredServiceProviderCountStub.count += 1;
                this.app.instance("foo", {});
            }

            public provides(): Array<Abstract> {
                return ["foo"];
            }
        }

        class ApplicationFactoryProviderStub extends ServiceProvider {
            public register(): void {
                let count = 0;

                this.app.bind("foo", () => {
                    count += 1;

                    return count;
                });
            }

            public provides(): Array<Abstract> {
                return ["foo"];
            }
        }

        class ApplicationMultiProviderStub extends ServiceProvider {
            public register(): void {
                this.app.singleton("foo", () => "foo");
                this.app.singleton(
                    "bar",
                    (app: Container) => `${app.make<string>("foo")}bar`,
                );
            }

            public provides(): Array<Abstract> {
                return ["foo", "bar"];
            }
        }

        abstract class SampleInterface {
            public abstract getPrimitive(): unknown;
        }

        class SampleImplementation extends SampleInterface {
            public constructor(private readonly primitive: unknown) {
                super();
            }

            public getPrimitive(): unknown {
                return this.primitive;
            }
        }

        class InterfaceToImplementationDeferredServiceProvider extends ServiceProvider {
            public register(): void {
                this.app.bind(SampleInterface, SampleImplementation);
            }

            public provides(): Array<Abstract> {
                return [SampleInterface];
            }
        }

        class SampleImplementationDeferredServiceProvider extends ServiceProvider {
            public register(): void {
                this.app
                    .when(SampleImplementation)
                    .needs("$primitive")
                    .give(() => "foo");
            }

            public provides(): Array<Abstract> {
                return [SampleImplementation];
            }
        }

        class ConcreteTerminator {
            public static counter = 0;

            public terminate(): void {
                ConcreteTerminator.counter += 1;
            }
        }

        function deferredServices(
            entries: Array<[Abstract, Constructor<ServiceProvider>]>,
        ): OrderedMap<Abstract, Constructor<ServiceProvider>> {
            const services = new OrderedMap<
                Abstract,
                Constructor<ServiceProvider>
            >();

            for (const [service, provider] of entries) {
                services.set(service, provider);
            }

            return services;
        }

        function hasLoadedProvider(
            app: Application,
            ctor: Constructor<ServiceProvider>,
        ): boolean {
            for (const [provider] of app.getLoadedProviders()) {
                if (provider === ctor) {
                    return true;
                }
            }

            return false;
        }

        it("register() runs the provider and marks it loaded", () => {
            // PHP: FoundationApplicationTest::testServiceProvidersAreCorrectlyRegistered
            const app = new Application();
            const provider = new ApplicationBasicServiceProviderStub(app);
            app.register(provider);

            expect(provider.registerCalls).to.equal(1);
            expect(
                hasLoadedProvider(app, ApplicationBasicServiceProviderStub),
            ).to.equal(true);
        });

        it("register() binds classes declared on the provider's `bindings`", () => {
            // PHP: FoundationApplicationTest::testClassesAreBoundWhenServiceProviderIsRegistered
            const app = new Application();
            const provider = new BindingsProviderStub(app);
            app.register(provider);

            expect(hasLoadedProvider(app, BindingsProviderStub)).to.equal(true);

            const instance = app.make(AbstractClass);
            expect(instance instanceof ConcreteClass).to.equal(true);
            expect(instance === app.make(AbstractClass)).to.equal(false);
        });

        it("register() builds singletons declared on the provider's `singletons`", () => {
            // PHP: FoundationApplicationTest::testSingletonsAreCreatedWhenServiceProviderIsRegistered
            const app = new Application();
            const provider = new SingletonsProviderStub(app);
            app.register(provider);

            expect(hasLoadedProvider(app, SingletonsProviderStub)).to.equal(
                true,
            );

            const instance = app.make(AbstractClass);
            expect(instance instanceof ConcreteClass).to.equal(true);
            expect(instance === app.make(AbstractClass)).to.equal(true);

            const other = app.make(NonContractBackedClass);
            expect(other instanceof NonContractBackedClass).to.equal(true);
            expect(other === app.make(NonContractBackedClass)).to.equal(true);
        });

        it("register()'s default `register()` is a no-op, and the provider still loads", () => {
            // PHP: FoundationApplicationTest::testServiceProvidersAreCorrectlyRegisteredWhenRegisterMethodIsNotFilled
            class BareProviderStub extends ServiceProvider {}

            const app = new Application();
            app.register(new BareProviderStub(app));

            expect(hasLoadedProvider(app, BareProviderStub)).to.equal(true);
        });

        it("providerIsLoaded() answers per class", () => {
            // PHP: FoundationApplicationTest::testServiceProvidersCouldBeLoaded
            const app = new Application();
            app.register(new ApplicationBasicServiceProviderStub(app));

            expect(
                app.providerIsLoaded(ApplicationBasicServiceProviderStub),
            ).to.equal(true);
            expect(app.providerIsLoaded(BindingsProviderStub)).to.equal(false);
        });

        it("a deferred service is bound before its provider registers", () => {
            // PHP: FoundationApplicationTest::testDeferredServicesMarkedAsBound
            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationDeferredServiceProviderStub],
                ]),
            );

            expect(app.bound("foo")).to.equal(true);
            expect(app.make("foo")).to.equal("foo");
        });

        it("a deferred singleton is shared once its provider registers", () => {
            // PHP: FoundationApplicationTest::testDeferredServicesAreSharedProperly
            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationDeferredSharedServiceProviderStub],
                ]),
            );

            expect(app.bound("foo")).to.equal(true);

            const one = app.make("foo");
            const two = app.make("foo");
            expect(one).to.equal(two);
        });

        it("extend() reaches a deferred service once it resolves", () => {
            // PHP: FoundationApplicationTest::testDeferredServicesCanBeExtended
            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationDeferredServiceProviderStub],
                ]),
            );
            app.extend("foo", (instance: unknown) => `${instance}bar`);

            expect(app.make("foo")).to.equal("foobar");
        });

        it("a deferred provider only registers once", () => {
            // PHP: FoundationApplicationTest::testDeferredServiceProviderIsRegisteredOnlyOnce
            ApplicationDeferredServiceProviderCountStub.count = 0;

            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationDeferredServiceProviderCountStub],
                ]),
            );

            const obj = app.make("foo");
            expect(obj).to.equal(app.make("foo"));
            expect(ApplicationDeferredServiceProviderCountStub.count).to.equal(
                1,
            );
        });

        it("an existing instance short-circuits the deferred provider", () => {
            // PHP: FoundationApplicationTest::testDeferredServiceDontRunWhenInstanceSet
            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationDeferredServiceProviderStub],
                ]),
            );
            app.instance("foo", "bar");

            expect(app.make("foo")).to.equal("bar");
        });

        it("a deferred provider is not registered until the service is actually resolved", () => {
            // PHP: FoundationApplicationTest::testDeferredServicesAreLazilyInitialized
            ApplicationDeferredServiceProviderStub.initialized = false;

            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationDeferredServiceProviderStub],
                ]),
            );

            expect(app.bound("foo")).to.equal(true);
            expect(ApplicationDeferredServiceProviderStub.initialized).to.equal(
                false,
            );

            app.extend("foo", (instance: unknown) => `${instance}bar`);
            expect(ApplicationDeferredServiceProviderStub.initialized).to.equal(
                false,
            );

            expect(app.make("foo")).to.equal("foobar");
            expect(ApplicationDeferredServiceProviderStub.initialized).to.equal(
                true,
            );
        });

        it("a deferred provider may bind a factory instead of a singleton", () => {
            // PHP: FoundationApplicationTest::testDeferredServicesCanRegisterFactories
            const app = new Application();
            app.setDeferredServices(
                deferredServices([["foo", ApplicationFactoryProviderStub]]),
            );

            expect(app.bound("foo")).to.equal(true);
            expect(app.make("foo")).to.equal(1);
            expect(app.make("foo")).to.equal(2);
            expect(app.make("foo")).to.equal(3);
        });

        it("one provider may supply several deferred services", () => {
            // PHP: FoundationApplicationTest::testSingleProviderCanProvideMultipleDeferredServices
            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    ["foo", ApplicationMultiProviderStub],
                    ["bar", ApplicationMultiProviderStub],
                ]),
            );

            expect(app.make("foo")).to.equal("foo");
            expect(app.make("bar")).to.equal("foobar");
        });

        it("resolving through an interface loads the deferred provider that binds it", () => {
            // PHP: FoundationApplicationTest::testDeferredServiceIsLoadedWhenAccessingImplementationThroughInterface
            const app = new Application();
            app.setDeferredServices(
                deferredServices([
                    [
                        SampleInterface,
                        InterfaceToImplementationDeferredServiceProvider,
                    ],
                    [
                        SampleImplementation,
                        SampleImplementationDeferredServiceProvider,
                    ],
                ]),
            );

            const instance = app.make<SampleInterface>(SampleInterface);
            expect(instance.getPrimitive()).to.equal("foo");
        });

        it("environment() reads and matches the bound `env` value", () => {
            // PHP: FoundationApplicationTest::testEnvironment
            const app = new Application();
            app.instance("env", "foo");

            expect(app.environment()).to.equal("foo");

            expect(app.environment("foo")).to.equal(true);
            expect(app.environment("f*")).to.equal(true);
            expect(app.environment("foo", "bar")).to.equal(true);
            expect(app.environment(["foo", "bar"])).to.equal(true);

            expect(app.environment("qux")).to.equal(false);
            expect(app.environment("q*")).to.equal(false);
            expect(app.environment("qux", "bar")).to.equal(false);
            expect(app.environment(["qux", "bar"])).to.equal(false);
        });

        it("isLocal()/isProduction() read the `env` value (adapted -- see class comment)", () => {
            // PHP: FoundationApplicationTest::testEnvironmentHelpers
            const localApp = new Application();
            localApp.instance("env", "local");
            expect(localApp.isLocal()).to.equal(true);
            expect(localApp.isProduction()).to.equal(false);

            const production = new Application();
            production.instance("env", "production");
            expect(production.isProduction()).to.equal(true);
            expect(production.isLocal()).to.equal(false);
        });

        it("beforeBootstrapping() registers a `bootstrapping: <name>` listener", () => {
            // PHP: FoundationApplicationTest::testBeforeBootstrappingAddsClosure
            const app = new Application();
            const closure = (): void => {};

            app.beforeBootstrapping(RegisterFacades, closure);

            const name = `bootstrapping: ${Reflector.className(RegisterFacades)}`;
            expect(
                app.make<Dispatcher>("events").getListeners(name).size() > 0,
            ).to.equal(true);
        });

        it("afterBootstrapping() registers a `bootstrapped: <name>` listener", () => {
            // PHP: FoundationApplicationTest::testAfterBootstrappingAddsClosure
            const app = new Application();
            const closure = (): void => {};

            app.afterBootstrapping(RegisterFacades, closure);

            const name = `bootstrapped: ${Reflector.className(RegisterFacades)}`;
            expect(
                app.make<Dispatcher>("events").getListeners(name).size() > 0,
            ).to.equal(true);
        });

        it("terminate() runs the terminating callbacks in order", () => {
            // PHP: FoundationApplicationTest::testTerminationTests
            const app = new Application();
            const result = new Array<number>();

            app.terminating(() => result.push(1));
            app.terminating(() => result.push(2));
            app.terminating(() => result.push(3));

            app.terminate();

            expectDeepEqual(result, [1, 2, 3]);
        });

        it("terminating() accepts a [instance, method] callable", () => {
            // PHP: FoundationApplicationTest::testTerminationCallbacksCanAcceptAtNotation
            //
            // PHP registers `ConcreteTerminator::class.'@terminate'`, a string
            // the container resolves and calls; here the port's `terminating()`
            // takes a `CallableTarget` directly, so the instance/method pair is
            // handed over the same way `container.call()`'s array form is used
            // elsewhere in this port's tests (see `ContainerCall.spec.ts`).
            ConcreteTerminator.counter = 0;

            const app = new Application();
            app.terminating([new ConcreteTerminator(), "terminate"]);

            app.terminate();

            expect(ConcreteTerminator.counter).to.equal(1);
        });

        it("boot() fires the booting callbacks once", () => {
            // PHP: FoundationApplicationTest::testBootingCallbacks
            const app = new Application();
            let counter = 0;

            app.booting((booted: Application) => {
                counter += 1;
                expect(booted).to.equal(app);
            });
            app.booting((booted: Application) => {
                counter += 1;
                expect(booted).to.equal(app);
            });

            app.boot();

            expect(counter).to.equal(2);
        });

        it("booted() fires immediately once already booted, otherwise on boot()", () => {
            // PHP: FoundationApplicationTest::testBootedCallbacks
            const app = new Application();
            let counter = 0;
            const closure = (booted: Application): void => {
                counter += 1;
                expect(booted).to.equal(app);
            };

            app.booting(closure);
            app.booted(closure);
            app.booted(closure);
            app.boot();

            expect(counter).to.equal(3);

            app.booted(closure);

            expect(counter).to.equal(4);
        });

        it("registers the core container aliases this port supports (adapted -- see class comment)", () => {
            // PHP: FoundationApplicationTest::testCoreContainerAliasesAreRegisteredByDefault
            const app = new Application();

            expect(app.isAlias(ConfigRepository)).to.equal(true);
            expect(app.getAlias(ConfigRepository)).to.equal("config");

            expect(app.isAlias(Dispatcher)).to.equal(true);
            expect(app.getAlias(Dispatcher)).to.equal("events");

            expect(app.isAlias(LogManager)).to.equal(true);
            expect(app.getAlias(LogManager)).to.equal("log");

            expect(app.isAlias(QueueManager)).to.equal(true);
            expect(app.getAlias(QueueManager)).to.equal("queue");
        });
    });
};
