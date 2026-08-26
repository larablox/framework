/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";

/**
 * PHP: `Illuminate\Tests\Container\ResolvingCallbackTest`.
 *
 * Ported in full. PHP's ad hoc `new stdClass` with a dynamically added
 * `->name` property is replaced with a small `Std` fixture class carrying an
 * optional `name` field -- Luau tables backing a compiled class cannot grow
 * new fields at runtime the way a PHP `stdClass` can.
 */
export = (): void => {
    describe("Resolving callbacks", () => {
        class Std {
            public name?: string;
        }

        abstract class ResolvingContractStub {}

        class ResolvingImplementationStub extends ResolvingContractStub {}

        class ResolvingImplementationStubTwo extends ResolvingContractStub {}

        it("resolving() callbacks are called for specific abstracts", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForSpecificAbstracts
            const container = new Container();
            container.resolving("foo", (object: Std) => {
                object.name = "taylor";
            });
            container.bind("foo", () => new Std());
            const instance = container.make<Std>("foo");

            expect(instance.name).to.equal("taylor");
        });

        it("resolving() callbacks with no abstract are called globally", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalled
            const container = new Container();
            container.resolving((object: Std) => {
                object.name = "taylor";
            });
            container.bind("foo", () => new Std());
            const instance = container.make<Std>("foo");

            expect(instance.name).to.equal("taylor");
        });

        it("resolving() callbacks are called for a type", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForType
            const container = new Container();
            container.resolving(Std, (object: Std) => {
                object.name = "taylor";
            });
            container.bind("foo", () => new Std());
            const instance = container.make<Std>("foo");

            expect(instance.name).to.equal("taylor");
        });

        it("resolving() callbacks fire when called through an alias", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksShouldBeFiredWhenCalledWithAliases
            const container = new Container();
            container.alias(Std, "std");
            container.resolving("std", (object: Std) => {
                object.name = "taylor";
            });
            container.bind("foo", () => new Std());
            const instance = container.make<Std>("foo");

            expect(instance.name).to.equal("taylor");
        });

        it("resolving() callbacks are called once per resolution for an implementation", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledOnceForImplementation
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);
        });

        it("global resolving() callbacks are called once per resolution for an implementation", () => {
            // PHP: ResolvingCallbackTest::testGlobalResolvingCallbacksAreCalledOnceForImplementation
            const container = new Container();

            let callCounter = 0;
            container.resolving(() => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(2);
        });

        it("resolving() callbacks are called once per resolution for singleton concretes", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledOnceForSingletonConcretes
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);
            container.bind(ResolvingImplementationStub);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(3);
        });

        it("resolving() callbacks can still be added after the first resolution", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksCanStillBeAddedAfterTheFirstResolution
            const container = new Container();

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingImplementationStub);

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);
        });

        it("resolving() callbacks are canceled when the interface is rebound to another concrete", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCanceledWhenInterfaceGetsBoundToSomeOtherConcrete
            const container = new Container();

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            let callCounter = 0;
            container.resolving(ResolvingImplementationStub, () => {
                callCounter++;
            });

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.bind(
                ResolvingContractStub,
                ResolvingImplementationStubTwo,
            );
            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);
        });

        it("resolving() callbacks are called once per resolution for string abstractions", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledOnceForStringAbstractions
            const container = new Container();

            let callCounter = 0;
            container.resolving("foo", () => {
                callCounter++;
            });

            container.bind("foo", ResolvingImplementationStub);

            container.make("foo");
            expect(callCounter).to.equal(1);

            container.make("foo");
            expect(callCounter).to.equal(2);
        });

        it("resolving() callbacks for concretes are called once per string abstraction resolution", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksForConcretesAreCalledOnceForStringAbstractions
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingImplementationStub, () => {
                callCounter++;
            });

            container.bind("foo", ResolvingImplementationStub);
            container.bind("bar", ResolvingImplementationStub);
            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make("foo");
            expect(callCounter).to.equal(2);

            container.make("bar");
            expect(callCounter).to.equal(3);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(4);
        });

        it("resolving() callbacks are called once per resolution for an implementation (closure concrete)", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledOnceForImplementation2
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(
                ResolvingContractStub,
                () => new ResolvingImplementationStub(),
            );

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(3);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(4);
        });

        it("rebinding does not affect resolving() callbacks", () => {
            // PHP: ResolvingCallbackTest::testRebindingDoesNotAffectResolvingCallbacks
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);
            container.bind(
                ResolvingContractStub,
                () => new ResolvingImplementationStub(),
            );

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(3);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(4);
        });

        it("resolving()/afterResolving() callbacks receive the resolved object and the container", () => {
            // PHP: ResolvingCallbackTest::testParametersPassedIntoResolvingCallbacks
            const container = new Container();

            container.resolving(
                ResolvingContractStub,
                (obj: unknown, app: unknown) => {
                    expect(obj instanceof ResolvingContractStub).to.equal(true);
                    expect(
                        obj instanceof ResolvingImplementationStubTwo,
                    ).to.equal(true);
                    expect(app).to.equal(container);
                },
            );

            container.afterResolving(
                ResolvingContractStub,
                (obj: unknown, app: unknown) => {
                    expect(obj instanceof ResolvingContractStub).to.equal(true);
                    expect(
                        obj instanceof ResolvingImplementationStubTwo,
                    ).to.equal(true);
                    expect(app).to.equal(container);
                },
            );

            container.afterResolving((obj: unknown, app: unknown) => {
                expect(obj instanceof ResolvingContractStub).to.equal(true);
                expect(obj instanceof ResolvingImplementationStubTwo).to.equal(
                    true,
                );
                expect(app).to.equal(container);
            });

            container.bind(
                ResolvingContractStub,
                ResolvingImplementationStubTwo,
            );
            container.make(ResolvingContractStub);
        });

        it("resolving() callbacks are called when a rebind happens", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCallWhenRebindHappens
            const container = new Container();

            let resolvingCallCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                resolvingCallCounter++;
            });

            let rebindCallCounter = 0;
            container.rebinding(ResolvingContractStub, () => {
                rebindCallCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingContractStub);
            expect(resolvingCallCounter).to.equal(1);
            expect(rebindCallCounter).to.equal(0);

            container.bind(
                ResolvingContractStub,
                ResolvingImplementationStubTwo,
            );
            expect(resolvingCallCounter).to.equal(2);
            expect(rebindCallCounter).to.equal(1);

            container.make(ResolvingImplementationStubTwo);
            expect(resolvingCallCounter).to.equal(3);
            expect(rebindCallCounter).to.equal(1);

            container.bind(
                ResolvingContractStub,
                () => new ResolvingImplementationStubTwo(),
            );
            expect(resolvingCallCounter).to.equal(4);
            expect(rebindCallCounter).to.equal(2);

            container.make(ResolvingContractStub);
            expect(resolvingCallCounter).to.equal(5);
            expect(rebindCallCounter).to.equal(2);
        });

        it("resolving() callbacks aren't called when no rebindings are registered", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksArentCalledWhenNoRebindingsAreRegistered
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.bind(
                ResolvingContractStub,
                ResolvingImplementationStubTwo,
            );
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStubTwo);
            expect(callCounter).to.equal(2);

            container.bind(
                ResolvingContractStub,
                () => new ResolvingImplementationStubTwo(),
            );
            expect(callCounter).to.equal(2);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(3);
        });

        it("rebinding does not affect multiple resolving() callbacks", () => {
            // PHP: ResolvingCallbackTest::testRebindingDoesNotAffectMultipleResolvingCallbacks
            const container = new Container();

            let callCounter = 0;

            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.resolving(ResolvingImplementationStubTwo, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);

            container.make(ResolvingImplementationStubTwo);
            expect(callCounter).to.equal(4);
        });

        it("resolving() callbacks are called for interfaces", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForInterfaces
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingContractStub);

            expect(callCounter).to.equal(1);
        });

        it("resolving() callbacks attached on the interface are called for the concrete too", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForConcretesWhenAttachedOnInterface
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingImplementationStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);
        });

        it("resolving() callbacks attached on the concrete are called for the concrete", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForConcretesWhenAttachedOnConcretes
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingImplementationStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);
        });

        it("resolving() callbacks for concretes fire without any binding", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForConcretesWithNoBinding
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingImplementationStub, () => {
                callCounter++;
            });

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);
            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);
        });

        it("resolving() callbacks for interfaces fire for a concrete resolved with no binding", () => {
            // PHP: ResolvingCallbackTest::testResolvingCallbacksAreCalledForInterFacesWithNoBinding
            const container = new Container();

            let callCounter = 0;
            container.resolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(2);
        });

        it("afterResolving() callbacks are called once per resolution for an implementation", () => {
            // PHP: ResolvingCallbackTest::testAfterResolvingCallbacksAreCalledOnceForImplementation
            const container = new Container();

            let callCounter = 0;
            container.afterResolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(2);
        });

        it("beforeResolving() callbacks are called for a type", () => {
            // PHP: ResolvingCallbackTest::testBeforeResolvingCallbacksAreCalled
            const container = new Container();
            let callCounter = 0;

            container.bind(ResolvingContractStub, ResolvingImplementationStub);

            container.beforeResolving(ResolvingContractStub, () => {
                callCounter++;
            });

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);

            container.make(ResolvingContractStub);
            expect(callCounter).to.equal(2);
        });

        it("global beforeResolving() callbacks are called for anything", () => {
            // PHP: ResolvingCallbackTest::testGlobalBeforeResolvingCallbacksAreCalled
            const container = new Container();
            let callCounter = 0;

            container.beforeResolving(() => {
                callCounter++;
            });

            container.make(ResolvingImplementationStub);
            expect(callCounter).to.equal(1);
        });
    });
};
