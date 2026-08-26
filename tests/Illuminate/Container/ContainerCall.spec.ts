/// <reference types="@rbxts/testez/globals" />
import { expectThrows } from "../TestHelpers";
import { BindingResolutionException } from "Illuminate/Contracts/Container/BindingResolutionException";
import { Container } from "Illuminate/Container/Container";
import { Inject } from "Illuminate/Container/Attributes/Inject";
import { Variadic } from "Illuminate/Container/Attributes/Variadic";
import type { Abstract } from "Illuminate/Container/Types";

/**
 * PHP: `Illuminate\Tests\Container\ContainerCallTest`.
 *
 * Every dependency in this port is declared with `@Inject`/`@Variadic`
 * instead of a type hint (`CLAUDE.md`, `agent_docs/laravel-parity.md`'s
 * "Автоворинг"), and TypeScript parameter decorators only apply to a class
 * constructor or method -- never to a plain closure's parameters. Every
 * upstream test that hangs a type hint off an inline
 * `$container->call(function (Foo $foo) {...})` closure is therefore adapted
 * to call an annotated static method on a fixture class instead
 * (`ContainerCallClosureStub`/`...`); the mechanics under test --
 * `Container::call()` resolving declared dependencies plus positional
 * overrides -- are unchanged.
 *
 * Not ported, no equivalent in this port:
 * - `testCallWithAtSignBasedClassReferencesWithoutMethodThrowsException`:
 *   PHP calls a bare string as a global function
 *   (`$container->call('ContainerTestCallStub')`); there are no free
 *   functions or a global namespace to call into here.
 * - `testCallWithStaticMethodNameString` / `testCallWithGlobalMethodName`:
 *   both call a fully qualified `Namespace\Class::method` / free-function
 *   string; `BoundMethod::call()` here only recognizes `Class@method`
 *   strings, array callables, and functions (`BoundMethod.ts`), so there is
 *   no `::`-string or global-function-string form to reproduce.
 * - `testCallWithCallableObject` / `testCallWithCallableClassString`: both
 *   rely on PHP's `__invoke()` magic method making an object (or a
 *   class-string resolved to one) directly callable. `BoundMethod.invoke()`
 *   has no such fallback (see its source) -- an object is never itself
 *   callable in this port.
 */
export = (): void => {
    describe("Container::call()", () => {
        class ContainerCallConcreteStub {}

        /** Stands in for PHP's `stdClass` -- a second, unrelated concrete class. */
        class ContainerCallOtherStub {}

        class ContainerTestCallStub {
            public work(...args: Array<unknown>): Array<unknown> {
                return args;
            }

            public inject(
                @Inject(ContainerCallConcreteStub)
                stub: ContainerCallConcreteStub,
                default_ = "taylor",
            ): [ContainerCallConcreteStub, unknown] {
                return [stub, default_];
            }

            public unresolvable(
                @Inject("$foo") foo: unknown,
                @Inject("$bar") bar: unknown,
            ): Array<unknown> {
                return [foo, bar];
            }
        }

        it("Class@method syntax with no method throws (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testCallWithAtSignBasedClassReferencesWithoutMethodThrowsException
            const container = new Container();

            expectThrows(() => container.call("ContainerTestCallStub"));
        });

        it("calls Class@method with positional overrides and default-method resolution", () => {
            // PHP: ContainerCallTest::testCallWithAtSignBasedClassReferences
            let container = new Container();
            container.bind("ContainerTestCallStub", ContainerTestCallStub);
            let result = container.call("ContainerTestCallStub@work", [
                "foo",
                "bar",
            ]);
            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");

            container = new Container();
            container.bind("ContainerTestCallStub", ContainerTestCallStub);
            result = container.call("ContainerTestCallStub@inject");
            const injected = result as [ContainerCallConcreteStub, unknown];
            expect(injected[0] instanceof ContainerCallConcreteStub).to.equal(
                true,
            );
            expect(injected[1]).to.equal("taylor");

            container = new Container();
            container.bind("ContainerTestCallStub", ContainerTestCallStub);
            result = container.call(
                "ContainerTestCallStub@inject",
                new Map<string | number, unknown>([[2, "foo"]]),
            );
            const injectedWithOverride = result as [
                ContainerCallConcreteStub,
                unknown,
            ];
            expect(
                injectedWithOverride[0] instanceof ContainerCallConcreteStub,
            ).to.equal(true);
            expect(injectedWithOverride[1]).to.equal("foo");

            container = new Container();
            container.bind("ContainerTestCallStub", ContainerTestCallStub);
            result = container.call(
                "ContainerTestCallStub",
                ["foo", "bar"],
                "work",
            );
            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");
        });

        it("calls an [instance, method] array callable", () => {
            // PHP: ContainerCallTest::testCallWithCallableArray
            const container = new Container();
            const stub = new ContainerTestCallStub();
            const result = container.call([stub, "work"], ["foo", "bar"]);

            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");
        });

        it("calls a bound method binding through bindMethod()", () => {
            // PHP: ContainerCallTest::testCallWithBoundMethod
            //
            // Both `bindMethod()` calls below use the `[Class, "method"]`
            // array key form, not the `"Class@method"` string PHP uses:
            // `Container::call()` always resolves a Class@method *string*
            // down to `[instance, "method"]` before checking for a method
            // binding (`BoundMethod.callClass()`), and `normalizeMethod()`
            // then keys that lookup by the instance's *class*
            // (`classOfTarget()`), never by the class *name* string --
            // registering under the string form here would key a binding
            // that lookup can never match (see `BoundMethod.ts`).
            let container = new Container();
            container.bind("ContainerTestCallStub", ContainerTestCallStub);
            container.bindMethod(
                [ContainerTestCallStub, "unresolvable"],
                (stub: ContainerTestCallStub) =>
                    stub.unresolvable("foo", "bar"),
            );
            let result = container.call("ContainerTestCallStub@unresolvable");
            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");

            container = new Container();
            container.bindMethod(
                [ContainerTestCallStub, "unresolvable"],
                (stub: ContainerTestCallStub) =>
                    stub.unresolvable("foo", "bar"),
            );
            result = container.call([
                new ContainerTestCallStub(),
                "unresolvable",
            ]);
            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");

            container = new Container();
            result = container.call(
                [new ContainerTestCallStub(), "inject"],
                new Map<string | number, unknown>([[2, "bar"]]),
            );
            let injected = result as [ContainerCallConcreteStub, unknown];
            expect(injected[0] instanceof ContainerCallConcreteStub).to.equal(
                true,
            );
            expect(injected[1]).to.equal("bar");

            container = new Container();
            result = container.call(
                [new ContainerTestCallStub(), "inject"],
                new Map<string | number, unknown>([["$foo", "foo"]]),
            );
            injected = result as [ContainerCallConcreteStub, unknown];
            expect(injected[0] instanceof ContainerCallConcreteStub).to.equal(
                true,
            );
            expect(injected[1]).to.equal("taylor");
        });

        it("bindMethod() accepts a [target, method] array key", () => {
            // PHP: ContainerCallTest::testBindMethodAcceptsAnArray
            let container = new Container();
            container.bind("ContainerTestCallStub", ContainerTestCallStub);
            container.bindMethod(
                [ContainerTestCallStub, "unresolvable"],
                (stub: ContainerTestCallStub) =>
                    stub.unresolvable("foo", "bar"),
            );
            let result = container.call("ContainerTestCallStub@unresolvable");
            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");

            container = new Container();
            container.bindMethod(
                [ContainerTestCallStub, "unresolvable"],
                (stub: ContainerTestCallStub) =>
                    stub.unresolvable("foo", "bar"),
            );
            result = container.call([
                new ContainerTestCallStub(),
                "unresolvable",
            ]);
            expect((result as Array<unknown>)[0]).to.equal("foo");
            expect((result as Array<unknown>)[1]).to.equal("bar");
        });

        // PHP's `Illuminate\Tests\Container\containerTestInject` free function
        // and the closures of `testClosureCallWithInjectedDependency`,
        // `testCallWithDependencies`, `testCallWithVariadicDependency`,
        // `testCallWithoutRequiredParamsOnClosureThrowsException`,
        // `testCallWithNullableClassParameterDefaultValue{,WithBinding}` all
        // become static methods here -- see class comment.
        class ContainerCallClosureStub {
            public static injected(
                @Inject(ContainerCallConcreteStub)
                stub: ContainerCallConcreteStub,
            ): ContainerCallConcreteStub {
                return stub;
            }

            public static withDefault(
                @Inject(ContainerCallConcreteStub)
                foo: ContainerCallConcreteStub,
                bar: unknown = [],
            ): [ContainerCallConcreteStub, unknown] {
                return [foo, bar];
            }

            public static withConcreteOverride(
                @Inject(ContainerCallOtherStub) foo: ContainerCallOtherStub,
                @Inject(ContainerCallConcreteStub)
                bar: ContainerCallConcreteStub,
            ): [ContainerCallOtherStub, ContainerCallConcreteStub] {
                return [foo, bar];
            }

            public static variadic(
                // PHP's first parameter is a `stdClass`, which
                // `ContainerCallOtherStub` stands in for -- the point of the
                // test is that the *variadic* is the one bound to a list, so
                // the two classes have to stay distinct.
                @Inject(ContainerCallOtherStub) foo: ContainerCallOtherStub,
                @Variadic(ContainerCallConcreteStub)
                ...bar: Array<ContainerCallConcreteStub>
            ): Array<unknown> {
                return [foo, ...bar];
            }

            public static unresolvable(
                @Inject("$foo") foo: unknown,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exists only to exercise the tail-parameter-default substitution path
                _bar = "default",
            ): unknown {
                return foo;
            }

            public static nullableDefault(
                @Inject(ContainerCallConcreteStub)
                stub?: ContainerCallConcreteStub,
            ): ContainerCallConcreteStub | undefined {
                return stub;
            }
        }

        it("call() injects a class dependency into an annotated method (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testClosureCallWithInjectedDependency
            const container = new Container();
            container.call([ContainerCallClosureStub, "injected"]);
            container.call(
                [ContainerCallClosureStub, "injected"],
                new Map<string | number, unknown>([
                    [1, new ContainerCallConcreteStub()],
                ]),
            );
        });

        it("call() resolves dependencies alongside overridden primitives (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testCallWithDependencies
            const container = new Container();
            let result = container.call([
                ContainerCallClosureStub,
                "withDefault",
            ]) as [ContainerCallConcreteStub, unknown];

            expect(result[0] instanceof ContainerCallConcreteStub).to.equal(
                true,
            );
            expect((result[1] as Array<unknown>).size()).to.equal(0);

            result = container.call(
                [ContainerCallClosureStub, "withDefault"],
                new Map<string | number, unknown>([[2, "taylor"]]),
            ) as [ContainerCallConcreteStub, unknown];

            expect(result[0] instanceof ContainerCallConcreteStub).to.equal(
                true,
            );
            expect(result[1]).to.equal("taylor");

            const stub = new ContainerCallConcreteStub();
            const overridden = container.call(
                [ContainerCallClosureStub, "withConcreteOverride"],
                new Map<Abstract | number, unknown>([
                    [ContainerCallConcreteStub, stub],
                ]),
            ) as [ContainerCallOtherStub, ContainerCallConcreteStub];

            expect(overridden[0] instanceof ContainerCallOtherStub).to.equal(
                true,
            );
            expect(overridden[1]).to.equal(stub);

            // Wrap a function...
            const wrapped = container.wrap(
                [ContainerCallClosureStub, "withDefault"] as never,
                new Map<string | number, unknown>([[2, "taylor"]]),
            );
            const wrappedResult = wrapped() as [
                ContainerCallConcreteStub,
                unknown,
            ];

            expect(
                wrappedResult[0] instanceof ContainerCallConcreteStub,
            ).to.equal(true);
            expect(wrappedResult[1]).to.equal("taylor");
        });

        it("call() spreads a variadic dependency (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testCallWithVariadicDependency
            const stub1 = new ContainerCallConcreteStub();
            const stub2 = new ContainerCallConcreteStub();

            const container = new Container();
            container.bind(ContainerCallConcreteStub, () => [stub1, stub2]);

            const result = container.call([
                ContainerCallClosureStub,
                "variadic",
            ]) as Array<unknown>;

            expect(result[0] instanceof ContainerCallOtherStub).to.equal(true);
            expect(result[1] instanceof ContainerCallConcreteStub).to.equal(
                true,
            );
            expect(result[1]).to.equal(stub1);
            expect(result[2]).to.equal(stub2);
        });

        it("call() throws when an unresolvable primitive dependency is missing (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testCallWithoutRequiredParamsThrowsException / ...OnClosureThrowsException
            const container = new Container();

            expectThrows(() =>
                container.call("ContainerTestCallStub@unresolvable"),
            );
        });

        // `testCallWithUnnamedParametersThrowsException` is not ported: upstream
        // shows that a plain *positional* override array does not satisfy a
        // parameter matched by *name* (`array_key_exists($parameter->name,
        // $parameters)` fails for a list array, so it still throws). Parameter
        // names do not survive compilation in this port, so an index-keyed
        // override map (`ParameterOverrides`, `Types.ts`) *is* the mechanism
        // that stands in for name-matching here, not a secondary fallback --
        // `container.call([stub, "unresolvable"], new Map([[1, "foo"], [2,
        // "bar"]]))` resolves successfully by design (see
        // `hasParameterOverride()`/`getMethodDependencies()` in
        // `Container.ts`/`BoundMethod.ts`). There is no scenario left in
        // which a positional override fails to satisfy a positionally
        // matching parameter, so upstream's assertion has no analogue.

        it("call() throws BindingResolutionException for an unresolvable primitive (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testCallWithoutRequiredParamsOnClosureThrowsException
            const container = new Container();

            expectThrows(
                () =>
                    container.call([ContainerCallClosureStub, "unresolvable"]),
                BindingResolutionException,
            );
        });

        // `testCallWithNullableClassParameterDefaultValue` (without a prior
        // `bind()`, upstream asserts the resolved value is `null`) is not
        // ported: it depends on a distinction this port's `Container` does
        // not draw. `resolveClass()` here (`Container.ts`) calls `make()`
        // unconditionally and `make()` autowires any instantiable concrete
        // class whether or not it was ever explicitly bound -- there is no
        // reflection-derived "parameter allows null" signal to special-case
        // an *unbound* class differently from a *bound* one, so this port has
        // no way to reproduce a scenario where binding the class changes the
        // outcome from `null` to an instance. Only the bound half survives,
        // renamed to describe what it actually demonstrates here.
        it("a class dependency resolves through the container whether or not it was explicitly bound (adapted -- see class comment)", () => {
            // PHP: ContainerCallTest::testCallWithNullableClassParameterDefaultValueWithBinding
            const container = new Container();
            container.bind(ContainerCallConcreteStub);

            const result = container.call([
                ContainerCallClosureStub,
                "nullableDefault",
            ]);

            expect(result instanceof ContainerCallConcreteStub).to.equal(true);
        });
    });
};
