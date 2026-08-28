import { BindingResolutionException } from 'Illuminate/Contracts/Container/BindingResolutionException';
import { Reflector } from 'Illuminate/Support/Reflector';
import { Trait } from 'Illuminate/Support/Traits/Trait';
import { Util } from 'Illuminate/Container/Util';
import { getInjectedDependencies } from 'Illuminate/Container/Attributes/Inject';
import type { AssertNoExtraMembers, AssertTrue, Constructor } from 'Illuminate/Support/Traits/Trait';
import type { Container } from 'Illuminate/Container/Container';
import type { Container as ContainerContract } from 'Illuminate/Contracts/Container/Container';
import type { OrderedMap } from 'Illuminate/Support/OrderedMap';

/**
 * The instance type `ResolvesRouteDependencies()` mixes in.
 *
 * Named rather than inferred so that declaration emit can write it down with
 * its `protected` and `private` members intact -- see the note on
 * `ConditionablePublicShape` in `Illuminate/Support/Traits/Conditionable`,
 * which explains the whole pattern, including why the shape is in two halves
 * and which half the compiler can check for you.
 */
export declare class ResolvesRouteDependenciesPublicShape {
    /** Type-only: there is no such value in the compiled Luau. */
    protected constructor();

    /** Resolve the object method's dependencies. */
    public resolveClassMethodDependencies(
        parameters: OrderedMap<string, defined>,
        instance: object,
        method: string,
    ): Array<defined>;

    /** Resolve the given method's dependencies. */
    public resolveMethodDependencies(
        parameters: OrderedMap<string, defined>,
        target: object | undefined,
        method: string,
    ): Array<defined>;
}

/**
 * The full shape: {@link ResolvesRouteDependenciesPublicShape} plus what
 * Laravel hides.
 */
export declare class ResolvesRouteDependenciesShape extends ResolvesRouteDependenciesPublicShape {
    /** Type-only: there is no such value in the compiled Luau. */
    private constructor();

    /** The container instance, set by the class using the trait. */
    protected container: ContainerContract;

    /**
     * The container as its concrete class.
     *
     * `resolveFromAttribute()` and the attribute callbacks live on the class
     * rather than on the contract -- in PHP too, where the container the
     * router hands around is always the real one.
     */
    private concreteContainer(): Container;
}

/**
 * The trait itself.
 *
 * Split out of `ResolvesRouteDependencies()` below and left unannotated so
 * that the two checks on the shape have something concrete to look at -- see
 * the note on `conditionable` in `Illuminate/Support/Traits/Conditionable`.
 */
function resolvesRouteDependencies<TBase extends Constructor>(Base: TBase) {
    return class extends Base {
        /** The container instance, set by the class using the trait. */
        protected container!: ContainerContract;

        /**
         * The container as its concrete class.
         *
         * `resolveFromAttribute()` and the attribute callbacks live on the
         * class rather than on the contract -- in PHP too, where the container
         * the router hands around is always the real one.
         */
        private concreteContainer(): Container {
            return this.container as unknown as Container;
        }

        /** Resolve the object method's dependencies. */
        public resolveClassMethodDependencies(
            parameters: OrderedMap<string, defined>,
            instance: object,
            method: string,
        ): Array<defined> {
            return this.resolveMethodDependencies(parameters, Reflector.classOf(instance), method);
        }

        /** Resolve the given method's dependencies. */
        public resolveMethodDependencies(
            parameters: OrderedMap<string, defined>,
            target: object | undefined,
            method: string,
        ): Array<defined> {
            const declared = target !== undefined ? getInjectedDependencies(target, method) : [];

            const values = new Array<defined>();

            for (let index = 0; index < declared.size(); index++) {
                const dependency = declared[index];

                const attribute = Util.getContextualAttributeFromDependency(dependency);

                let resolved: unknown;

                if (attribute !== undefined) {
                    resolved = this.concreteContainer().resolveFromAttribute(attribute);
                } else if (dependency.abstract !== undefined) {
                    resolved = this.container.make(dependency.abstract);
                } else {
                    throw new BindingResolutionException(
                        `Unresolvable dependency: parameter #${index + 1} of [${method}] declares no binding.`,
                    );
                }

                this.concreteContainer().fireAfterResolvingAttributeCallbacks(dependency.attributes, resolved);

                values.push(resolved as defined);
            }

            for (const value of parameters.values()) {
                values.push(value as defined);
            }

            return values;
        }
    } satisfies Constructor<ResolvesRouteDependenciesPublicShape>;
}

/**
 * Every public member the trait has that the shape does not list.
 *
 * `satisfies` above covers the other direction; see the note on
 * `ConditionableExtra` in `Illuminate/Support/Traits/Conditionable`.
 */
type ResolvesRouteDependenciesExtra = Exclude<
    keyof InstanceType<ReturnType<typeof resolvesRouteDependencies<typeof Trait>>>,
    keyof ResolvesRouteDependenciesPublicShape
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the assertion is the point: it fails to compile when the trait has a public member the shape does not list.
type ResolvesRouteDependenciesIsExact = AssertTrue<AssertNoExtraMembers<ResolvesRouteDependenciesExtra>>;

/**
 * PHP: `trait Illuminate\Routing\ResolvesRouteDependencies`.
 *
 * PHP walks the action's `ReflectionParameter`s: a parameter with a class type
 * hint or a contextual attribute is resolved from the container and spliced
 * into the argument list, and the route parameters fill whatever positions are
 * left, in order.
 *
 * Signatures are erased here, so the same walk reads what the parameters were
 * *annotated* with -- `Inject` and the contextual attributes, the same list the
 * container itself builds an argument list from. That fixes the convention:
 *
 * > **annotated parameters first, route parameters after them, in the order
 * > the URI names them.**
 *
 * The container refuses an annotated parameter that follows an unannotated one
 * anyway (there is no way to leave a hole in a Luau argument list), so this is
 * the only order that could have worked. A route parameter can still be asked
 * for by name out of order -- annotate it with `RouteParameter`.
 */
export function ResolvesRouteDependencies<TBase extends Constructor>(
    Base: TBase = Trait as never,
): TBase & Constructor<ResolvesRouteDependenciesShape> {
    return resolvesRouteDependencies(Base) as never;
}
