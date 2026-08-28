/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Inject } from "Illuminate/Container/Attributes/Inject";

/**
 * PHP: `Illuminate\Tests\Container\ContainerExtendTest`.
 *
 * Ported in full. PHP's `$container['foo'] = ...` array-access sugar is
 * spelled `container.offsetSet('foo', ...)` throughout -- `agent_docs/
 * laravel-parity.md` documents `offsetSet`/`offsetGet` as the ported part of
 * `ArrayAccess` (the `[]` syntax itself is `__get`/`__set` sugar, which is not
 * portable).
 */
export = (): void => {
    describe("Container extend", () => {
        class ExtendableRecord {
            public name?: string;
            public age?: number;
            public foo?: string;
            public bar?: string;
            public baz?: string;
        }

        it("extend() decorates a resolved value, and works for shared closures", () => {
            // PHP: ContainerExtendTest::testExtendedBindings
            const container = new Container();
            container.offsetSet("foo", () => "foo");
            container.extend("foo", (old: string) => old + "bar");

            expect(container.make("foo")).to.equal("foobar");

            const container2 = new Container();
            container2.singleton("foo", () => {
                const record = new ExtendableRecord();
                record.name = "taylor";

                return record;
            });
            container2.extend("foo", (old: ExtendableRecord) => {
                old.age = 26;

                return old;
            });

            const result = container2.make<ExtendableRecord>("foo");

            expect(result.name).to.equal("taylor");
            expect(result.age).to.equal(26);
            expect(result).to.equal(container2.make("foo"));
        });

        it("extend() preserves an existing shared instance and chains multiple extenders", () => {
            // PHP: ContainerExtendTest::testExtendInstancesArePreserved
            const container = new Container();
            container.bind("foo", () => {
                const record = new ExtendableRecord();
                record.foo = "bar";

                return record;
            });

            const obj = new ExtendableRecord();
            obj.foo = "foo";
            container.instance("foo", obj);
            container.extend("foo", (o: ExtendableRecord) => {
                o.bar = "baz";

                return o;
            });
            container.extend("foo", (o: ExtendableRecord) => {
                o.baz = "foo";

                return o;
            });

            expect(container.make<ExtendableRecord>("foo").foo).to.equal("foo");
            expect(container.make<ExtendableRecord>("foo").bar).to.equal("baz");
            expect(container.make<ExtendableRecord>("foo").baz).to.equal("foo");
        });

        it("extend() is lazily initialized", () => {
            // PHP: ContainerExtendTest::testExtendIsLazyInitialized
            class ContainerLazyExtendStub {
                public static initialized = false;

                public init(): void {
                    ContainerLazyExtendStub.initialized = true;
                }
            }
            ContainerLazyExtendStub.initialized = false;

            const container = new Container();
            container.bind(ContainerLazyExtendStub);
            container.extend(ContainerLazyExtendStub, (obj: ContainerLazyExtendStub) => {
                obj.init();

                return obj;
            });
            expect(ContainerLazyExtendStub.initialized).to.equal(false);
            container.make(ContainerLazyExtendStub);
            expect(ContainerLazyExtendStub.initialized).to.equal(true);
        });

        it("extend() can be registered before the binding it extends", () => {
            // PHP: ContainerExtendTest::testExtendCanBeCalledBeforeBind
            const container = new Container();
            container.extend("foo", (old: string) => old + "bar");
            container.offsetSet("foo", () => "foo");

            expect(container.make("foo")).to.equal("foobar");
        });

        it("extend() fires the rebinding callback for an existing instance", () => {
            // PHP: ContainerExtendTest::testExtendInstanceRebindingCallback
            let rebound = false;

            const container = new Container();
            container.rebinding("foo", () => {
                rebound = true;
            });

            const obj = new ExtendableRecord();
            container.instance("foo", obj);

            container.extend("foo", (o: ExtendableRecord) => o);

            expect(rebound).to.equal(true);
        });

        it("extend() fires the rebinding callback for a resolved bind()", () => {
            // PHP: ContainerExtendTest::testExtendBindRebindingCallback
            let rebound = false;

            const container = new Container();
            container.rebinding("foo", () => {
                rebound = true;
            });
            container.bind("foo", () => new ExtendableRecord());

            expect(rebound).to.equal(false);

            container.make("foo");

            container.extend("foo", (o: ExtendableRecord) => o);

            expect(rebound).to.equal(true);
        });

        it("extend() works on an aliased binding", () => {
            // PHP: ContainerExtendTest::testExtensionWorksOnAliasedBindings
            const container = new Container();
            container.singleton("something", () => "some value");
            container.alias("something", "something-alias");
            container.extend("something-alias", (value: string) => value + " extended");

            expect(container.make("something")).to.equal("some value extended");
        });

        it("multiple extend() calls compose in registration order", () => {
            // PHP: ContainerExtendTest::testMultipleExtends
            const container = new Container();
            container.offsetSet("foo", () => "foo");
            container.extend("foo", (old: string) => old + "bar");
            container.extend("foo", (old: string) => old + "baz");

            expect(container.make("foo")).to.equal("foobarbaz");
        });

        it("forgetExtenders() removes the extenders registered for a binding", () => {
            // PHP: ContainerExtendTest::testUnsetExtend
            const container = new Container();
            container.bind("foo", () => {
                const record = new ExtendableRecord();
                record.foo = "bar";

                return record;
            });

            container.extend("foo", (obj: ExtendableRecord) => {
                obj.bar = "baz";

                return obj;
            });

            container.offsetUnset("foo");
            container.forgetExtenders("foo");

            container.bind("foo", () => "foo");

            expect(container.make("foo")).to.equal("foo");
        });

        it("extend() sees the contextually-bound value it is decorating", () => {
            // PHP: ContainerExtendTest::testExtendContextualBinding
            abstract class ContainerExtendInterfaceStub {}

            class ContainerExtendInterfaceImplementationStub extends ContainerExtendInterfaceStub {
                public constructor(public readonly value: string) {
                    super();
                }
            }

            class ContainerExtendConsumesInterfaceStub {
                public constructor(
                    @Inject(ContainerExtendInterfaceStub)
                    public readonly stub: ContainerExtendInterfaceImplementationStub,
                ) {}
            }

            const container = new Container();
            container
                .when(ContainerExtendConsumesInterfaceStub)
                .needs(ContainerExtendInterfaceStub)
                .give(() => new ContainerExtendInterfaceImplementationStub("foo"));

            let observed: ContainerExtendInterfaceImplementationStub | undefined;
            container.extend(ContainerExtendInterfaceStub, (instance: ContainerExtendInterfaceImplementationStub) => {
                observed = instance;

                return new ContainerExtendInterfaceImplementationStub("bar");
            });

            const result = container.make(ContainerExtendConsumesInterfaceStub);

            expect(observed instanceof ContainerExtendInterfaceImplementationStub).to.equal(true);
            expect((observed as ContainerExtendInterfaceImplementationStub).value).to.equal("foo");
            expect(result.stub.value).to.equal("bar");
        });

        it("extend() registered after the first resolution still sees the contextual value", () => {
            // PHP: ContainerExtendTest::testExtendContextualBindingAfterResolution
            // https://github.com/laravel/framework/issues/53501
            abstract class ContainerExtendInterfaceStub {}

            class ContainerExtendInterfaceImplementationStub extends ContainerExtendInterfaceStub {
                public constructor(public readonly value: string) {
                    super();
                }
            }

            class ContainerExtendConsumesInterfaceStub {
                public constructor(
                    @Inject(ContainerExtendInterfaceStub)
                    public readonly stub: ContainerExtendInterfaceImplementationStub,
                ) {}
            }

            const container = new Container();
            container
                .when(ContainerExtendConsumesInterfaceStub)
                .needs(ContainerExtendInterfaceStub)
                .give(() => new ContainerExtendInterfaceImplementationStub("foo"));

            container.make(ContainerExtendConsumesInterfaceStub);

            let observed: ContainerExtendInterfaceImplementationStub | undefined;
            container.extend(ContainerExtendInterfaceStub, (instance: ContainerExtendInterfaceImplementationStub) => {
                observed = instance;

                return new ContainerExtendInterfaceImplementationStub("bar");
            });

            const result = container.make(ContainerExtendConsumesInterfaceStub);

            expect(observed instanceof ContainerExtendInterfaceImplementationStub).to.equal(true);
            expect((observed as ContainerExtendInterfaceImplementationStub).value).to.equal("foo");
            expect(result.stub.value).to.equal("bar");
        });
    });
};
