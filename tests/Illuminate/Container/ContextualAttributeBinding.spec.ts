/// <reference types="@rbxts/testez/globals" />
import { Config } from "Illuminate/Container/Attributes/Config";
import { Container } from "Illuminate/Container/Container";
import { Context } from "Illuminate/Container/Attributes/Context";
import { Give } from "Illuminate/Container/Attributes/Give";
import { Inject } from "Illuminate/Container/Attributes/Inject";
import { Tag } from "Illuminate/Container/Attributes/Tag";
import { addParameterAttribute } from "Illuminate/Container/Attributes/Inject";
import { Repository as ContextRepository } from "Illuminate/Log/Context/Repository";
import type { ContextualAttribute } from "Illuminate/Contracts/Container/ContextualAttribute";

/**
 * PHP: `Illuminate\Tests\Container\ContextualAttributeBindingTest`.
 *
 * Not ported:
 * - `testAuthedAttribute`, `testCacheAttribute`, `testDatabaseAttribute`,
 *   `testAuthAttribute`, `testLogAttribute`, `testRouteParameterAttribute`,
 *   `testRouteParameterAttributeWithouthParameterName`, `testStorageAttribute`:
 *   every one of these exercises a contextual attribute this port has not
 *   shipped yet -- `Auth`, `Authenticated`, `Cache`, `CurrentUser`,
 *   `Database`, `RouteParameter`'s resolution, `Storage` (`RouteParameter`
 *   exists in `Container/Attributes/RouteParameter.ts` but is unused by
 *   anything ported, see `agent_docs/laravel-parity.md`'s "Контекстные
 *   атрибуты параметров") -- and all but `RouteParameter` additionally lean
 *   on Mockery (`m::mock(...)`), which this codebase has no equivalent of
 *   (`CLAUDE.md`).
 * - `testParameterIsPassedToContextualAttributeResolver` /
 *   `...OnAppCall`: both assert that a `resolve()` hook receives a third
 *   `ReflectionParameter $parameter` argument and reads its name back out.
 *   `ContextualAttribute.resolve` here (`Contracts/Container/ContextualAttribute.ts`)
 *   is only ever called with `(attribute, container)` -- there is no
 *   `ReflectionParameter` to pass, since parameter reflection does not
 *   survive compilation at all (the reason `Inject` exists in the first
 *   place).
 *
 * Adapted:
 * - Every closure-parameter attribute test (`testInjectionWithAttributeOnAppCall`,
 *   `testAttributeOnAppCall`, `testNestedAttributeOnAppCall`, `testTagAttribute`)
 *   is rewritten to resolve the same fixture class directly through
 *   `container.make()`, or through `container.call()` against an annotated
 *   static method, instead of an inline closure -- TypeScript parameter
 *   decorators do not exist on closures (see `ContainerCall.spec.ts`'s class
 *   comment for the same limitation).
 * - `testContextAttribute` / `testContextAttributeInteractingWithHidden`
 *   replace the Mockery-mocked `Illuminate\Log\Context\Repository` with a
 *   small hand-written fake bound in its place.
 */
export = (): void => {
    describe("Contextual attribute bindings", () => {
        abstract class ContainerTestContract {}

        class ContainerTestImplA extends ContainerTestContract {}

        class ContainerTestImplB extends ContainerTestContract {}

        interface ContainerTestAttributeThatResolvesContractImpl extends ContextualAttribute {
            readonly name: "A" | "B";
        }

        function ContainerTestAttributeThatResolvesContractImpl(
            name: "A" | "B",
        ) {
            const instance: ContainerTestAttributeThatResolvesContractImpl = {
                name,
            };

            return (
                owner: object,
                propertyKey: unknown,
                parameterIndex: number,
            ): void => {
                addParameterAttribute(
                    owner,
                    propertyKey,
                    parameterIndex,
                    ContainerTestAttributeThatResolvesContractImpl,
                    instance,
                );
            };
        }

        class ContainerTestHasAttributeThatResolvesToImplA {
            public constructor(
                @ContainerTestAttributeThatResolvesContractImpl("A")
                public readonly property: ContainerTestContract,
            ) {}
        }

        class ContainerTestHasAttributeThatResolvesToImplB {
            public constructor(
                @ContainerTestAttributeThatResolvesContractImpl("B")
                public readonly property: ContainerTestContract,
            ) {}
        }

        it("resolves a dependency through whenHasAttribute()", () => {
            // PHP: ContextualAttributeBindingTest::testDependencyCanBeResolvedFromAttributeBinding
            const container = new Container();

            container.bind(
                ContainerTestContract,
                () => new ContainerTestImplB(),
            );
            container.whenHasAttribute(
                ContainerTestAttributeThatResolvesContractImpl,
                (attribute: ContainerTestAttributeThatResolvesContractImpl) =>
                    attribute.name === "A"
                        ? new ContainerTestImplA()
                        : new ContainerTestImplB(),
            );

            const classA = container.make(
                ContainerTestHasAttributeThatResolvesToImplA,
            );

            expect(
                classA instanceof ContainerTestHasAttributeThatResolvesToImplA,
            ).to.equal(true);
            expect(classA.property instanceof ContainerTestImplA).to.equal(
                true,
            );

            const classB = container.make(
                ContainerTestHasAttributeThatResolvesToImplB,
            );

            expect(
                classB instanceof ContainerTestHasAttributeThatResolvesToImplB,
            ).to.equal(true);
            expect(classB.property instanceof ContainerTestImplB).to.equal(
                true,
            );
        });

        class SimpleDependency extends ContainerTestContract {}

        class ComplexDependency extends ContainerTestContract {
            // PHP overrides this by name (`['param' => true]`); with no
            // parameter names here it is overridden by position, and only an
            // annotated parameter takes a positional override at all.
            public constructor(
                @Inject("$param") public readonly param: boolean,
            ) {
                super();
            }
        }

        class GiveTestSimple {
            public constructor(
                @Give(SimpleDependency)
                public readonly dependency: ContainerTestContract,
            ) {}
        }

        class GiveTestComplex {
            public constructor(
                @Give(ComplexDependency, [true])
                public readonly dependency: ComplexDependency,
            ) {}
        }

        it("resolves a simple dependency through Give()", () => {
            // PHP: ContextualAttributeBindingTest::testSimpleDependencyCanBeResolvedCorrectlyFromGiveAttributeBinding
            const container = new Container();
            container.bind(ContainerTestContract, ContainerTestImplA);

            const resolution = container.make(GiveTestSimple);

            expect(resolution.dependency instanceof SimpleDependency).to.equal(
                true,
            );
        });

        it("resolves a dependency with constructor parameters through Give()", () => {
            // PHP: ContextualAttributeBindingTest::testComplexDependencyCanBeResolvedCorrectlyFromGiveAttributeBinding
            const container = new Container();
            container.bind(ContainerTestContract, ContainerTestImplA);

            const resolution = container.make(GiveTestComplex);

            expect(resolution.dependency instanceof ComplexDependency).to.equal(
                true,
            );
            expect(resolution.dependency.param).to.equal(true);
        });

        /** A tiny stand-in for `Illuminate\Config\Repository`, get(key) only. */
        class FakeConfigRepository {
            public constructor(
                private readonly items: Record<string, unknown>,
            ) {}

            public get(key: string, defaultValue?: unknown): unknown {
                const value = this.items[key];

                return value !== undefined ? value : defaultValue;
            }
        }

        interface ContainerTestConfigValue extends ContextualAttribute {
            readonly key: string;
        }

        function ContainerTestConfigValue(key: string) {
            const instance: ContainerTestConfigValue = { key };

            return (
                owner: object,
                propertyKey: unknown,
                parameterIndex: number,
            ): void => {
                addParameterAttribute(
                    owner,
                    propertyKey,
                    parameterIndex,
                    ContainerTestConfigValue,
                    instance,
                );
            };
        }

        class ContainerTestHasConfigValueProperty {
            public constructor(
                @ContainerTestConfigValue("app.timezone")
                public readonly timezone: string,
            ) {}
        }

        it("resolves a scalar dependency through whenHasAttribute()", () => {
            // PHP: ContextualAttributeBindingTest::testScalarDependencyCanBeResolvedFromAttributeBinding
            const container = new Container();
            container.singleton(
                "config",
                () =>
                    new FakeConfigRepository({
                        "app.timezone": "Europe/Paris",
                    }),
            );

            container.whenHasAttribute(
                ContainerTestConfigValue,
                (attribute: ContainerTestConfigValue, c) =>
                    c.make<FakeConfigRepository>("config").get(attribute.key),
            );

            const classInstance = container.make(
                ContainerTestHasConfigValueProperty,
            );

            expect(
                classInstance instanceof ContainerTestHasConfigValueProperty,
            ).to.equal(true);
            expect(classInstance.timezone).to.equal("Europe/Paris");
        });

        interface ContainerTestConfigValueWithResolve extends ContextualAttribute {
            readonly key: string;
        }

        function ContainerTestConfigValueWithResolve(key: string) {
            const instance: ContainerTestConfigValueWithResolve = {
                key,
                resolve: (attribute: ContainerTestConfigValueWithResolve, c) =>
                    c.make<FakeConfigRepository>("config").get(attribute.key),
            };

            return (
                owner: object,
                propertyKey: unknown,
                parameterIndex: number,
            ): void => {
                addParameterAttribute(
                    owner,
                    propertyKey,
                    parameterIndex,
                    ContainerTestConfigValueWithResolve,
                    instance,
                );
            };
        }

        class ContainerTestHasConfigValueWithResolveProperty {
            public constructor(
                @ContainerTestConfigValueWithResolve("app.env")
                public readonly env: string,
            ) {}
        }

        it("resolves a scalar dependency through the attribute's own resolve()", () => {
            // PHP: ContextualAttributeBindingTest::testScalarDependencyCanBeResolvedFromAttributeResolveMethod
            const container = new Container();
            container.singleton(
                "config",
                () => new FakeConfigRepository({ "app.env": "production" }),
            );

            const classInstance = container.make(
                ContainerTestHasConfigValueWithResolveProperty,
            );

            expect(
                classInstance instanceof
                    ContainerTestHasConfigValueWithResolveProperty,
            ).to.equal(true);
            expect(classInstance.env).to.equal("production");
        });

        class Person {
            public name = "Taylor";
            public role?: string;
        }

        type ContainerTestConfigValueWithResolveAndAfter = ContextualAttribute;

        function ContainerTestConfigValueWithResolveAndAfter() {
            const instance: ContainerTestConfigValueWithResolveAndAfter = {
                resolve: () => new Person(),
                after: (_attribute: never, value: Person) => {
                    value.role = "Developer";
                },
            };

            return (
                owner: object,
                propertyKey: unknown,
                parameterIndex: number,
            ): void => {
                addParameterAttribute(
                    owner,
                    propertyKey,
                    parameterIndex,
                    ContainerTestConfigValueWithResolveAndAfter,
                    instance,
                );
            };
        }

        class ContainerTestHasConfigValueWithResolvePropertyAndAfterCallback {
            public constructor(
                @ContainerTestConfigValueWithResolveAndAfter()
                public readonly person: Person,
            ) {}
        }

        it("runs the attribute's after() callback once the dependency resolves", () => {
            // PHP: ContextualAttributeBindingTest::testDependencyWithAfterCallbackAttributeCanBeResolved
            const container = new Container();

            const classInstance = container.make(
                ContainerTestHasConfigValueWithResolvePropertyAndAfterCallback,
            );

            expect(classInstance.person.role).to.equal("Developer");
        });

        it("make() resolves the same attributed dependency call() would (adapted -- see class comment)", () => {
            // PHP: ContextualAttributeBindingTest::testInjectionWithAttributeOnAppCall
            const container = new Container();

            const hasAttribute = container.make(
                ContainerTestHasConfigValueWithResolvePropertyAndAfterCallback,
            );

            expect(hasAttribute.person.name).to.equal("Taylor");
        });

        class ConfigTest {
            public constructor(
                @Config("foo") public readonly foo: string,
                @Config("bar") public readonly bar: string,
            ) {}
        }

        it("resolves two Config()-attributed dependencies", () => {
            // PHP: ContextualAttributeBindingTest::testConfigAttribute
            const container = new Container();
            container.singleton(
                "config",
                () => new FakeConfigRepository({ foo: "foo", bar: "bar" }),
            );

            const classInstance = container.make(ConfigTest);

            expect(classInstance.foo).to.equal("foo");
            expect(classInstance.bar).to.equal("bar");
        });

        class TimezoneObject {
            public constructor(
                @Config("app.timezone") public readonly timezone?: string,
            ) {}
        }

        it("Config() resolves the configured key (adapted -- see class comment)", () => {
            // PHP: ContextualAttributeBindingTest::testAttributeOnAppCall / testNestedAttributeOnAppCall
            //
            // Upstream's second half reads `'app.locale' => null` back as
            // `null`. There is no such value here -- a Luau table cannot hold
            // `nil`, so the key simply does not exist, and an attribute that
            // resolves to nothing has no parameter default to fall back to
            // (`Container.resolveDependencies()` diagnoses it instead). The
            // sub-case is dropped.
            const container = new Container();
            container.singleton(
                "config",
                () =>
                    new FakeConfigRepository({
                        "app.timezone": "Europe/Paris",
                    }),
            );

            const timezoneObject = container.make(TimezoneObject);
            expect(timezoneObject.timezone).to.equal("Europe/Paris");
        });

        class TagTest {
            public constructor(
                @Tag("numbers") public readonly integers: unknown,
            ) {}
        }

        it("resolves a Tag()-attributed dependency into every tagged binding (adapted -- see class comment)", () => {
            // PHP: ContextualAttributeBindingTest::testTagAttribute
            const container = new Container();
            container.bind("one", () => 1);
            container.bind("two", () => 2);
            container.tag(["one", "two"], "numbers");

            const classInstance = container.make(TagTest);
            const values = (
                classInstance.integers as { toArray(): Array<unknown> }
            ).toArray();

            expect(values[0]).to.equal(1);
            expect(values[1]).to.equal(2);
        });

        /**
         * A hand-written fake for `Illuminate\Log\Context\Repository`,
         * standing in for the Mockery mock upstream builds -- see class
         * comment.
         */
        class FakeContextRepository {
            public getCallCount = 0;
            public getHiddenCallCount = 0;

            public get(key: string, defaultValue?: unknown): unknown {
                this.getCallCount++;
                expect(key).to.equal("foo");
                expect(defaultValue).to.equal(undefined);

                return "foo";
            }

            public getHidden(key: string, defaultValue?: unknown): unknown {
                this.getHiddenCallCount++;
                expect(key).to.equal("bar");
                expect(defaultValue).to.equal(undefined);

                return "bar";
            }
        }

        class ContextTest {
            public constructor(@Context("foo") public readonly foo: string) {}
        }

        class ContextHiddenTest {
            public constructor(
                @Context("bar", undefined, true) public readonly foo: string,
            ) {}
        }

        it("resolves a Context()-attributed dependency", () => {
            // PHP: ContextualAttributeBindingTest::testContextAttribute
            const container = new Container();
            const fake = new FakeContextRepository();
            container.singleton(ContextRepository, () => fake as never);

            const classInstance = container.make(ContextTest);

            expect(classInstance.foo).to.equal("foo");
            expect(fake.getCallCount).to.equal(1);
        });

        it("Context(hidden: true) reads from the hidden context instead", () => {
            // PHP: ContextualAttributeBindingTest::testContextAttributeInteractingWithHidden
            const container = new Container();
            const fake = new FakeContextRepository();
            container.singleton(ContextRepository, () => fake as never);

            const classInstance = container.make(ContextHiddenTest);

            expect(classInstance.foo).to.equal("bar");
            expect(fake.getHiddenCallCount).to.equal(1);
            expect(fake.getCallCount).to.equal(0);
        });
    });
};
