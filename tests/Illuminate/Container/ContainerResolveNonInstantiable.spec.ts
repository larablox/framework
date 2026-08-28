/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { Variadic } from 'Illuminate/Container/Attributes/Variadic';

/**
 * PHP: `Illuminate\Tests\Container\ContainerResolveNonInstantiableTest`.
 *
 * `testResolvingNonInstantiableWithDefaultRemovesWiths` is not ported. Upstream
 * relies on `Container::resolveClass()` catching a failed auto-build of an
 * *unannotated, non-trailing* `?TestInterface $testObject = null` parameter and
 * substituting its default, while the *later* `int $i = 0` parameter is still
 * overridable by name. This port has no such catch-and-default fallback for a
 * class dependency (`Container.ts::resolveClass` always just calls `make()`);
 * the only way an unannotated parameter contributes nothing is via the
 * "trailing unannotated parameter" rule (`agent_docs/laravel-parity.md`), and
 * that rule requires every parameter *before* it to be annotated -- a gap in
 * the middle is diagnosed with `BindingResolutionException`, not silently
 * defaulted (`Attributes/Inject.ts`'s `collect()`). Reproducing this scenario
 * would need `testObject` to be a non-trailing unannotated parameter ahead of
 * an annotated, overridable `i`, which is exactly the unsupported case.
 */
export = (): void => {
    describe('Container resolve non-instantiable', () => {
        abstract class TestInterface
        {}

        class ChildClass
        {
            public readonly objects: Array<TestInterface>;

            // A rest parameter, not a single array one: a variadic dependency
            // is spread into separate arguments, the same way PHP's
            // `TestInterface ...$objects` receives them.
            public constructor(@Variadic(TestInterface) ...objects: Array<TestInterface>)
            {
                this.objects = objects;
            }
        }

        class VariadicParentClass
        {
            public constructor(
                @Inject(ChildClass) public readonly child: ChildClass,
                @Inject('$i') public readonly i = 0,
            )
            {}
        }

        class VariadicPrimitive
        {
            public readonly params: Array<unknown>;

            public constructor(@Variadic('$params') ...params: Array<unknown>)
            {
                this.params = params;
            }
        }

        it('resolving a variadic non-instantiable dependency still resets the parameter stack', () => {
            // PHP: ContainerResolveNonInstantiableTest::testResolvingNonInstantiableWithVariadicRemovesWiths
            const container = new Container();
            const parent = container.make(
                VariadicParentClass,
                new Map([
                    [
                        '$i',
                        42,
                    ],
                ]),
            );

            expect(parent.child.objects.size()).to.equal(0);
            expect(parent.i).to.equal(42);
        });

        it('a variadic primitive dependency with nothing bound resolves to an empty list', () => {
            // PHP: ContainerResolveNonInstantiableTest::testResolveVariadicPrimitive
            const container = new Container();
            const parent = container.make(VariadicPrimitive);

            expect(parent.params.size()).to.equal(0);
        });
    });
};
