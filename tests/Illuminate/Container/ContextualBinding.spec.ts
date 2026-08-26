/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Inject } from "Illuminate/Container/Attributes/Inject";
import { Variadic } from "Illuminate/Container/Attributes/Variadic";

/**
 * PHP: `Illuminate\Tests\Container\ContextualBindingTest`.
 *
 * Every fixture constructor below is annotated with `@Inject`/`@Variadic`
 * standing in for PHP's type hints (`CLAUDE.md`,
 * `agent_docs/laravel-parity.md`'s "Автоворинг"). Two adaptations follow from
 * that:
 *
 * - `ContainerTestContextWithOptionalInnerDependency`'s `?ContainerTestContextInjectOne
 *   $inner = null` constructor parameter is left *unannotated*: an
 *   unannotated parameter is simply never passed an argument, so the
 *   compiled constructor's own TypeScript default applies -- the closest
 *   this port has to "no binding, fall back to the default" (see
 *   `agent_docs/laravel-parity.md`'s "Значения по умолчанию у параметров").
 * - `ContainerTestContextInjectFromConfigIndividualValues.alias` is
 *   annotated with `@Inject("$alias")` in every test, including
 *   `testContextualBindingGivesValuesFromConfigOptionalValueNull`, where PHP
 *   leaves the parameter with no contextual binding at all and relies on its
 *   default value. This port's primitive resolution
 *   (`Container.resolvePrimitive()`) has no such fallback for an *annotated*
 *   primitive with no contextual binding -- it throws
 *   `BindingResolutionException` unconditionally, unlike a class parameter's
 *   unannotated-default path. The "no value configured" case is instead
 *   modeled with an explicit contextual binding that gives `undefined`,
 *   which reaches the same assertion (`alias` ends up `undefined`) through
 *   an explicit binding rather than the PHP's implicit "nothing bound plus a
 *   default parameter value".
 *
 * `testContextualBindingWorksForMethodInvocation`'s "first class callable
 * syntax" half (`$container->call($object->method(...))`) is not ported:
 * PHP 8.1's first-class callable syntax turns a bound method into a
 * `Closure` carrying its own reflection; a plain property access on a
 * roblox-ts instance (`object.method`) is an unbound function value with no
 * such reflection, and `BoundMethod.getCallDependencies()` only reads
 * declared dependencies off an *array* callable (`Util.isArray(callback)`),
 * never a bare function -- see `ContainerCall.spec.ts`'s class comment for
 * the same limitation.
 */
export = (): void => {
    describe("Contextual bindings", () => {
        abstract class IContainerContextContractStub {}

        class ContainerContextNonContractStub {}

        class ContainerContextImplementationStub extends IContainerContextContractStub {}

        class ContainerContextImplementationStubTwo extends IContainerContextContractStub {}

        class ContainerImplementationStub extends IContainerContextContractStub {}

        class ContainerConcreteStub {}

        class ContainerTestContextInjectInstantiations extends IContainerContextContractStub {
            public static instantiations = 0;

            public constructor() {
                super();
                ContainerTestContextInjectInstantiations.instantiations++;
            }
        }

        class ContainerTestContextInjectOne {
            public constructor(
                @Inject(IContainerContextContractStub)
                public readonly impl: IContainerContextContractStub,
            ) {}
        }

        class ContainerTestContextInjectTwo {
            public constructor(
                @Inject(IContainerContextContractStub)
                public readonly impl: IContainerContextContractStub,
            ) {}
        }

        class ContainerTestContextInjectThree {
            public constructor(
                @Inject(IContainerContextContractStub)
                public readonly impl: IContainerContextContractStub,
            ) {}
        }

        class ContainerTestContextWithOptionalInnerDependency {
            public constructor(
                public readonly inner?: ContainerTestContextInjectOne,
            ) {}
        }

        class ContainerTestContextInjectTwoInstances {
            public constructor(
                @Inject(ContainerTestContextWithOptionalInnerDependency)
                public readonly implOne: ContainerTestContextWithOptionalInnerDependency,
                @Inject(ContainerTestContextInjectTwo)
                public readonly implTwo: ContainerTestContextInjectTwo,
            ) {}
        }

        class ContainerTestContextInjectArray {
            public constructor(
                @Inject("$stubs") public readonly stubs: Array<unknown>,
            ) {}
        }

        class ContainerTestContextInjectVariadic {
            public readonly stubs: Array<IContainerContextContractStub>;

            public constructor(
                @Variadic(IContainerContextContractStub)
                ...stubs: Array<IContainerContextContractStub>
            ) {
                this.stubs = stubs;
            }
        }

        class ContainerTestContextInjectVariadicAfterNonVariadic {
            public readonly stubs: Array<IContainerContextContractStub>;

            public constructor(
                @Inject(ContainerContextNonContractStub)
                public readonly other: ContainerContextNonContractStub,
                @Variadic(IContainerContextContractStub)
                ...stubs: Array<IContainerContextContractStub>
            ) {
                this.stubs = stubs;
            }
        }

        class ContainerTestContextInjectFromConfigIndividualValues {
            public constructor(
                @Inject("$username") public readonly username: unknown,
                @Inject("$password") public readonly password: unknown,
                @Inject("$alias") public readonly alias: unknown = undefined,
            ) {}
        }

        class ContainerTestContextInjectFromConfigArray {
            public constructor(
                @Inject("$settings")
                public readonly settings: Map<string, unknown>,
            ) {}
        }

        class ContainerTestContextInjectMethodArgument {
            public method(
                @Inject(IContainerContextContractStub)
                dependency: IContainerContextContractStub,
            ): IContainerContextContractStub {
                return dependency;
            }
        }

        it("injects a different implementation depending on the requesting class", () => {
            // PHP: ContextualBindingTest::testContainerCanInjectDifferentImplementationsDependingOnContext
            let container = new Container();

            container.bind(
                IContainerContextContractStub,
                ContainerContextImplementationStub,
            );

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStub);
            container
                .when(ContainerTestContextInjectTwo)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            let one = container.make(ContainerTestContextInjectOne);
            let two = container.make(ContainerTestContextInjectTwo);

            expect(
                one.impl instanceof ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                two.impl instanceof ContainerContextImplementationStubTwo,
            ).to.equal(true);

            // Test with closures
            container = new Container();

            container.bind(
                IContainerContextContractStub,
                ContainerContextImplementationStub,
            );

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStub);
            container
                .when(ContainerTestContextInjectTwo)
                .needs(IContainerContextContractStub)
                .give((c) => c.make(ContainerContextImplementationStubTwo));

            one = container.make(ContainerTestContextInjectOne);
            two = container.make(ContainerTestContextInjectTwo);

            expect(
                one.impl instanceof ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                two.impl instanceof ContainerContextImplementationStubTwo,
            ).to.equal(true);

            // Test nesting to make the same 'abstract' in different context
            container = new Container();

            container.bind(
                IContainerContextContractStub,
                ContainerContextImplementationStub,
            );

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give((c) => c.make(IContainerContextContractStub));

            one = container.make(ContainerTestContextInjectOne);

            expect(
                one.impl instanceof ContainerContextImplementationStub,
            ).to.equal(true);
        });

        it("applies to an existing instance binding", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForExistingInstancedBindings
            const container = new Container();

            container.instance(
                IContainerContextContractStub,
                new ContainerImplementationStub(),
            );

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("applies to an instance binding registered afterward", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForNewlyInstancedBindings
            const container = new Container();

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            container.instance(
                IContainerContextContractStub,
                new ContainerImplementationStub(),
            );

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("applies through an existing alias of an instance binding", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksOnExistingAliasedInstances
            const container = new Container();

            container.instance("stub", new ContainerImplementationStub());
            container.alias("stub", IContainerContextContractStub);

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("applies through an alias of an instance binding registered afterward", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksOnNewAliasedInstances
            const container = new Container();

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            container.instance("stub", new ContainerImplementationStub());
            container.alias("stub", IContainerContextContractStub);

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("applies through an alias of a plain binding registered afterward", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksOnNewAliasedBindings
            const container = new Container();

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            container.bind("stub", ContainerContextImplementationStub);
            container.alias("stub", IContainerContextContractStub);

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("does not follow a stale alias", () => {
            // PHP: ContextualBindingTest::testContextualBindingDoesNotFollowStaleAliases
            const container = new Container();

            container
                .when(ContainerTestContextInjectOne)
                .needs("stale")
                .give(ContainerContextImplementationStub);
            container
                .when(ContainerTestContextInjectOne)
                .needs("live")
                .give(ContainerContextImplementationStubTwo);

            container.alias(IContainerContextContractStub, "stale");
            container.alias("unrelated", "stale");
            container.alias(IContainerContextContractStub, "live");

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("applies to multiple classes at once", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForMultipleClasses
            const container = new Container();

            container.bind(
                IContainerContextContractStub,
                ContainerContextImplementationStub,
            );

            container
                .when([
                    ContainerTestContextInjectTwo,
                    ContainerTestContextInjectThree,
                ])
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);

            expect(
                container.make(ContainerTestContextInjectTwo).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);

            expect(
                container.make(ContainerTestContextInjectThree).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("does not override a class's own non-contextual resolution", () => {
            // PHP: ContextualBindingTest::testContextualBindingDoesntOverrideNonContextualResolution
            const container = new Container();

            container.instance(
                "stub",
                new ContainerContextImplementationStub(),
            );
            container.alias("stub", IContainerContextContractStub);

            container
                .when(ContainerTestContextInjectTwo)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStubTwo);

            expect(
                container.make(ContainerTestContextInjectTwo).impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);

            expect(
                container.make(ContainerTestContextInjectOne).impl instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);
        });

        it("does not rebuild a contextually bound instance on every resolution", () => {
            // PHP: ContextualBindingTest::testContextuallyBoundInstancesAreNotUnnecessarilyRecreated
            ContainerTestContextInjectInstantiations.instantiations = 0;

            const container = new Container();

            container.instance(
                IContainerContextContractStub,
                new ContainerImplementationStub(),
            );
            container.instance(
                ContainerTestContextInjectInstantiations,
                new ContainerTestContextInjectInstantiations(),
            );

            expect(
                ContainerTestContextInjectInstantiations.instantiations,
            ).to.equal(1);

            container
                .when(ContainerTestContextInjectOne)
                .needs(IContainerContextContractStub)
                .give(ContainerTestContextInjectInstantiations);

            container.make(ContainerTestContextInjectOne);
            container.make(ContainerTestContextInjectOne);
            container.make(ContainerTestContextInjectOne);
            container.make(ContainerTestContextInjectOne);

            expect(
                ContainerTestContextInjectInstantiations.instantiations,
            ).to.equal(1);
        });

        class ContainerInjectVariableStub {
            public constructor(
                @Inject("$something") public readonly something: unknown,
            ) {}
        }

        it("injects a simple contextual primitive", () => {
            // PHP: ContextualBindingTest::testContainerCanInjectSimpleVariable
            let container = new Container();
            container
                .when(ContainerInjectVariableStub)
                .needs("$something")
                .give(() => 100);
            let instance = container.make(ContainerInjectVariableStub);
            expect(instance.something).to.equal(100);

            container = new Container();
            container
                .when(ContainerInjectVariableStub)
                .needs("$something")
                .give((c) => c.make(ContainerConcreteStub));
            instance = container.make(ContainerInjectVariableStub);
            expect(
                instance.something instanceof ContainerConcreteStub,
            ).to.equal(true);
        });

        it("resolves aliased contextual targets", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksWithAliasedTargets
            const container = new Container();

            container.bind(
                IContainerContextContractStub,
                ContainerContextImplementationStub,
            );
            container.alias(IContainerContextContractStub, "interface-stub");

            container.alias(ContainerContextImplementationStub, "stub-1");

            container
                .when(ContainerTestContextInjectOne)
                .needs("interface-stub")
                .give("stub-1");
            container
                .when(ContainerTestContextInjectTwo)
                .needs("interface-stub")
                .give(ContainerContextImplementationStubTwo);

            const one = container.make(ContainerTestContextInjectOne);
            const two = container.make(ContainerTestContextInjectTwo);

            expect(
                one.impl instanceof ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                two.impl instanceof ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("applies a contextual binding through a nested optional dependency", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForNestedOptionalDependencies
            const container = new Container();

            container
                .when(ContainerTestContextInjectTwoInstances)
                .needs(ContainerTestContextInjectTwo)
                .give(
                    () =>
                        new ContainerTestContextInjectTwo(
                            new ContainerContextImplementationStubTwo(),
                        ),
                );

            const resolvedInstance = container.make(
                ContainerTestContextInjectTwoInstances,
            );

            expect(
                resolvedInstance.implOne instanceof
                    ContainerTestContextWithOptionalInnerDependency,
            ).to.equal(true);
            expect(resolvedInstance.implOne.inner).to.equal(undefined);

            expect(
                resolvedInstance.implTwo instanceof
                    ContainerTestContextInjectTwo,
            ).to.equal(true);
            expect(
                resolvedInstance.implTwo.impl instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("resolves a variadic dependency through a contextual closure", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForVariadicDependencies
            const container = new Container();

            container
                .when(ContainerTestContextInjectVariadic)
                .needs(IContainerContextContractStub)
                .give((c) => [
                    c.make(ContainerContextImplementationStub),
                    c.make(ContainerContextImplementationStubTwo),
                ]);

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(2);
            expect(
                resolvedInstance.stubs[0] instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                resolvedInstance.stubs[1] instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("resolves an empty list for a variadic dependency with nothing bound", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForVariadicDependenciesWithNothingBound
            const container = new Container();

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(0);
        });

        it("resolves a variadic dependency that follows a non-variadic one", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForVariadicAfterNonVariadicDependencies
            const container = new Container();

            container
                .when(ContainerTestContextInjectVariadicAfterNonVariadic)
                .needs(IContainerContextContractStub)
                .give((c) => [
                    c.make(ContainerContextImplementationStub),
                    c.make(ContainerContextImplementationStubTwo),
                ]);

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadicAfterNonVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(2);
            expect(
                resolvedInstance.stubs[0] instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                resolvedInstance.stubs[1] instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("resolves an empty list for a trailing variadic with nothing bound", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForVariadicAfterNonVariadicDependenciesWithNothingBound
            const container = new Container();

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadicAfterNonVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(0);
        });

        it("resolves a variadic dependency given as a plain array, without a factory closure", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForVariadicDependenciesWithoutFactory
            const container = new Container();

            container
                .when(ContainerTestContextInjectVariadic)
                .needs(IContainerContextContractStub)
                .give([
                    ContainerContextImplementationStub,
                    ContainerContextImplementationStubTwo,
                ]);

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(2);
            expect(
                resolvedInstance.stubs[0] instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                resolvedInstance.stubs[1] instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("giveTagged() resolves an empty array primitive when no tags are defined", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesTagsForArrayWithNoTagsDefined
            const container = new Container();

            container
                .when(ContainerTestContextInjectArray)
                .needs("$stubs")
                .giveTagged("stub");

            const resolvedInstance = container.make(
                ContainerTestContextInjectArray,
            );

            expect(resolvedInstance.stubs.size()).to.equal(0);
        });

        it("giveTagged() resolves an empty variadic when no tags are defined", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesTagsForVariadicWithNoTagsDefined
            const container = new Container();

            container
                .when(ContainerTestContextInjectVariadic)
                .needs(IContainerContextContractStub)
                .giveTagged("stub");

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(0);
        });

        it("giveTagged() resolves every tagged entry into an array dependency", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesTagsForArray
            const container = new Container();

            container.tag(
                [
                    ContainerContextImplementationStub,
                    ContainerContextImplementationStubTwo,
                ],
                ["stub"],
            );

            container
                .when(ContainerTestContextInjectArray)
                .needs("$stubs")
                .giveTagged("stub");

            const resolvedInstance = container.make(
                ContainerTestContextInjectArray,
            );

            expect(resolvedInstance.stubs.size()).to.equal(2);
            expect(
                resolvedInstance.stubs[0] instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                resolvedInstance.stubs[1] instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        it("giveTagged() resolves every tagged entry into a variadic dependency", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesTagsForVariadic
            const container = new Container();

            container.tag(
                [
                    ContainerContextImplementationStub,
                    ContainerContextImplementationStubTwo,
                ],
                ["stub"],
            );

            container
                .when(ContainerTestContextInjectVariadic)
                .needs(IContainerContextContractStub)
                .giveTagged("stub");

            const resolvedInstance = container.make(
                ContainerTestContextInjectVariadic,
            );

            expect(resolvedInstance.stubs.size()).to.equal(2);
            expect(
                resolvedInstance.stubs[0] instanceof
                    ContainerContextImplementationStub,
            ).to.equal(true);
            expect(
                resolvedInstance.stubs[1] instanceof
                    ContainerContextImplementationStubTwo,
            ).to.equal(true);
        });

        /** A tiny stand-in for `Illuminate\Config\Repository`, get(key, default) only. */
        class FakeConfigRepository {
            public constructor(
                private readonly items: Map<string, Map<string, unknown>>,
            ) {}

            public get(key: string, defaultValue?: unknown): unknown {
                const [section, item] = key.split(".") as [string, string];
                const value = this.items.get(section)?.get(item);

                return value !== undefined ? value : defaultValue;
            }
        }

        it("giveConfig() with no value configured falls back to an explicit undefined binding (adapted -- see class comment)", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesValuesFromConfigOptionalValueNull
            const container = new Container();

            container.singleton(
                "config",
                () =>
                    new FakeConfigRepository(
                        new Map([
                            [
                                "test",
                                new Map<string, unknown>([
                                    ["username", "laravel"],
                                    ["password", "hunter42"],
                                ]),
                            ],
                        ]),
                    ),
            );

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$username")
                .giveConfig("test.username");

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$password")
                .giveConfig("test.password");

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$alias")
                .give(() => undefined);

            const resolvedInstance = container.make(
                ContainerTestContextInjectFromConfigIndividualValues,
            );

            expect(resolvedInstance.username).to.equal("laravel");
            expect(resolvedInstance.password).to.equal("hunter42");
            expect(resolvedInstance.alias).to.equal(undefined);
        });

        it("giveConfig() resolves every configured value", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesValuesFromConfigOptionalValueSet
            const container = new Container();

            container.singleton(
                "config",
                () =>
                    new FakeConfigRepository(
                        new Map([
                            [
                                "test",
                                new Map<string, unknown>([
                                    ["username", "laravel"],
                                    ["password", "hunter42"],
                                    ["alias", "lumen"],
                                ]),
                            ],
                        ]),
                    ),
            );

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$username")
                .giveConfig("test.username");

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$password")
                .giveConfig("test.password");

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$alias")
                .giveConfig("test.alias");

            const resolvedInstance = container.make(
                ContainerTestContextInjectFromConfigIndividualValues,
            );

            expect(resolvedInstance.username).to.equal("laravel");
            expect(resolvedInstance.password).to.equal("hunter42");
            expect(resolvedInstance.alias).to.equal("lumen");
        });

        it("giveConfig() falls back to its default when the key is missing", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesValuesFromConfigWithDefault
            const container = new Container();

            container.singleton(
                "config",
                () =>
                    new FakeConfigRepository(
                        new Map([
                            [
                                "test",
                                new Map<string, unknown>([
                                    ["password", "hunter42"],
                                ]),
                            ],
                        ]),
                    ),
            );

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$username")
                .giveConfig("test.username", "DEFAULT_USERNAME");

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$password")
                .giveConfig("test.password");

            container
                .when(ContainerTestContextInjectFromConfigIndividualValues)
                .needs("$alias")
                .give(() => undefined);

            const resolvedInstance = container.make(
                ContainerTestContextInjectFromConfigIndividualValues,
            );

            expect(resolvedInstance.username).to.equal("DEFAULT_USERNAME");
            expect(resolvedInstance.password).to.equal("hunter42");
            expect(resolvedInstance.alias).to.equal(undefined);
        });

        it("giveConfig() resolves a whole config section as one array dependency", () => {
            // PHP: ContextualBindingTest::testContextualBindingGivesValuesFromConfigArray
            const container = new Container();

            const settings = new Map<string, unknown>([
                ["username", "laravel"],
                ["password", "hunter42"],
                ["alias", "lumen"],
            ]);

            container.singleton(
                "config",
                () =>
                    ({
                        get: (key: string) =>
                            key === "test" ? settings : undefined,
                    }) as never,
            );

            container
                .when(ContainerTestContextInjectFromConfigArray)
                .needs("$settings")
                .giveConfig("test");

            const resolvedInstance = container.make(
                ContainerTestContextInjectFromConfigArray,
            );

            expect(resolvedInstance.settings.get("username")).to.equal(
                "laravel",
            );
            expect(resolvedInstance.settings.get("password")).to.equal(
                "hunter42",
            );
            expect(resolvedInstance.settings.get("alias")).to.equal("lumen");
        });

        it("applies a contextual binding to a method's declared dependency (adapted -- see class comment)", () => {
            // PHP: ContextualBindingTest::testContextualBindingWorksForMethodInvocation (array-callable half only)
            const container = new Container();

            container
                .when(ContainerTestContextInjectMethodArgument)
                .needs(IContainerContextContractStub)
                .give(ContainerContextImplementationStub);

            const object = new ContainerTestContextInjectMethodArgument();

            const value = container.call([object, "method"]);
            expect(
                value instanceof ContainerContextImplementationStub,
            ).to.equal(true);
        });
    });
};
