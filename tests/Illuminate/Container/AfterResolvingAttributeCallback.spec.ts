/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Inject } from "Illuminate/Container/Attributes/Inject";
import { addParameterAttribute } from "Illuminate/Container/Attributes/Inject";
import { Attributes } from "Illuminate/Container/Attributes/Attributes";
import type { ContextualAttribute } from "Illuminate/Contracts/Container/ContextualAttribute";

/**
 * PHP: `Illuminate\Tests\Container\AfterResolvingAttributeCallbackTest`.
 *
 * `testCallbackIsCalledOnAppCall` is not ported: it puts the attribute
 * directly on a closure parameter (`function (#[ContainerTestOnTenant(...)]
 * HasTenantImpl $property) {...}`). Parameter decorators only exist on class
 * members in TypeScript -- a bare arrow function's parameters have no syntax
 * to attach one to, so this scenario has no TS spelling at all (not just an
 * unported feature, but an unrepresentable one). `BoundMethod.getCallDependencies`
 * confirms this from the other end: it returns `[]` for anything that isn't an
 * array callable, so a closure passed to `Container::call()` never carries any
 * declared dependency here.
 *
 * PHP's `Tenant` enum is a plain string union (`"TenantA" | "TenantB"`) --
 * enums do not exist as a runtime concept independent of the class/string
 * split this port already uses for `Abstract`.
 */
export = (): void => {
    describe("After resolving attribute callbacks", () => {
        type Tenant = "TenantA" | "TenantB";

        const Tenant = {
            TenantA: "TenantA" as Tenant,
            TenantB: "TenantB" as Tenant,
        };

        /** PHP: `#[Attribute(Attribute::TARGET_PARAMETER)] final readonly class ContainerTestOnTenant`. */
        interface ContainerTestOnTenant extends ContextualAttribute {
            readonly tenant: Tenant;
        }

        function ContainerTestOnTenant(tenant: Tenant) {
            const instance: ContainerTestOnTenant = {
                tenant,
                resolve: () => undefined,
            };

            return (owner: object, propertyKey: unknown, parameterIndex: number): void => {
                addParameterAttribute(owner, propertyKey, parameterIndex, ContainerTestOnTenant, instance);
            };
        }

        class HasTenantImpl {
            public tenant?: Tenant;

            public onTenant(tenant: Tenant): void {
                this.tenant = tenant;
            }
        }

        class ContainerTestHasTenantImplPropertyWithTenantA {
            public constructor(
                @Inject(HasTenantImpl)
                @ContainerTestOnTenant(Tenant.TenantA)
                public readonly property: HasTenantImpl,
            ) {}
        }

        class ContainerTestHasTenantImplPropertyWithTenantB {
            public constructor(
                @Inject(HasTenantImpl)
                @ContainerTestOnTenant(Tenant.TenantB)
                public readonly property: HasTenantImpl,
            ) {}
        }

        /** PHP: `#[Attribute(Attribute::TARGET_CLASS)] final readonly class ContainerTestConfiguresClass`. */
        function ContainerTestConfiguresClass(value: string) {
            return (target: object): void => {
                Attributes.add(target, ContainerTestConfiguresClass, { value });
            };
        }

        interface ContainerTestConfiguresClassAttribute {
            readonly value: string;
        }

        @ContainerTestConfiguresClass("the-right-value")
        class ContainerTestHasSelfConfiguringAttributeAndConstructor {
            public constructor(@Inject("$value") public value: string) {}
        }

        /** PHP: `#[Attribute(Attribute::TARGET_CLASS)] final class ContainerTestBootable`. */
        function ContainerTestBootable() {
            return (target: object): void => {
                Attributes.add(target, ContainerTestBootable, {});
            };
        }

        @ContainerTestBootable()
        class ContainerTestHasBootable {
            public hasBooted = false;

            public booting(): void {
                this.hasBooted = true;
            }
        }

        it("afterResolvingAttribute() runs after the annotated dependency resolves", () => {
            // PHP: AfterResolvingAttributeCallbackTest::testCallbackIsCalledAfterDependencyResolutionWithAttribute
            const container = new Container();

            container.afterResolvingAttribute(
                ContainerTestOnTenant,
                (attribute: ContainerTestOnTenant, hasTenantImpl: HasTenantImpl) => {
                    hasTenantImpl.onTenant(attribute.tenant);
                },
            );

            const hasTenantA = container.make(ContainerTestHasTenantImplPropertyWithTenantA);
            expect(hasTenantA.property instanceof HasTenantImpl).to.equal(true);
            expect(hasTenantA.property.tenant).to.equal(Tenant.TenantA);

            const hasTenantB = container.make(ContainerTestHasTenantImplPropertyWithTenantB);
            expect(hasTenantB.property instanceof HasTenantImpl).to.equal(true);
            expect(hasTenantB.property.tenant).to.equal(Tenant.TenantB);
        });

        it("afterResolvingAttribute() runs after the class carrying the attribute itself resolves", () => {
            // PHP: AfterResolvingAttributeCallbackTest::testCallbackIsCalledAfterClassWithAttributeIsResolved
            const container = new Container();

            container.afterResolvingAttribute(
                ContainerTestBootable,
                (_attribute: unknown, instance: ContainerTestHasBootable, c) => {
                    if (typeIs(instance.booting, "function")) {
                        c.call([instance, "booting"]);
                    }
                },
            );

            const instance = container.make(ContainerTestHasBootable);

            expect(instance instanceof ContainerTestHasBootable).to.equal(true);
            expect(instance.hasBooted).to.equal(true);
        });

        it("afterResolvingAttribute() runs after a class with both a constructor and the attribute resolves", () => {
            // PHP: AfterResolvingAttributeCallbackTest::testCallbackIsCalledAfterClassWithConstructorAndAttributeIsResolved
            const container = new Container();

            container.afterResolvingAttribute(
                ContainerTestConfiguresClass,
                (
                    attribute: ContainerTestConfiguresClassAttribute,
                    instance: ContainerTestHasSelfConfiguringAttributeAndConstructor,
                ) => {
                    instance.value = attribute.value;
                },
            );

            container
                .when(ContainerTestHasSelfConfiguringAttributeAndConstructor)
                .needs("$value")
                .give("no-the-right-value");

            const instance = container.make(ContainerTestHasSelfConfiguringAttributeAndConstructor);

            expect(instance instanceof ContainerTestHasSelfConfiguringAttributeAndConstructor).to.equal(true);
            expect(instance.value).to.equal("the-right-value");
        });
    });
};
