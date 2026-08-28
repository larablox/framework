import { BindingResolutionException } from 'Illuminate/Contracts/Container/BindingResolutionException';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Reflector } from 'Illuminate/Support/Reflector';
import { Util } from 'Illuminate/Container/Util';
import { getInjectedDependencies } from 'Illuminate/Container/Attributes/Inject';
import type { ParameterDependency } from 'Illuminate/Container/Attributes/Inject';
import type { Abstract, CallableTarget, ParameterOverrides } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Container/Container';

export class BoundMethod
{
    /** Call the given Closure / class@method and inject its dependencies. */
    public static call(
        container: Container,
        callback: CallableTarget,
        parameters: ParameterOverrides = new Map(),
        defaultMethod?: string,
    ): unknown
    {
        if (typeIs(callback, 'string') && (BoundMethod.isCallableWithAtSign(callback) || defaultMethod !== undefined)) {
            return BoundMethod.callClass(container, callback, parameters, defaultMethod);
        }

        return BoundMethod.callBoundMethod(
            container,
            callback,
            () => BoundMethod.invoke(callback, BoundMethod.getMethodDependencies(container, callback, parameters)),
        );
    }

    /** Call a string reference to a class using Class@method syntax. */
    private static callClass(
        container: Container,
        target: string,
        parameters: ParameterOverrides,
        defaultMethod?: string,
    ): unknown
    {
        const segments = target.split('@');

        // We will assume an @ sign is used to delimit the class name from the method
        // name. We will split on this @ sign and then build a callable array that
        // we can pass right back into the "call" method for dependency binding.
        const method = segments.size() === 2 ? segments[1] : defaultMethod;

        if (method === undefined) {
            throw new InvalidArgumentException('Method not provided.');
        }

        return BoundMethod.call(container, [container.make(segments[0]) as object, method], parameters);
    }

    /** Call a method that has been bound to the container. */
    private static callBoundMethod(container: Container, callback: CallableTarget, fallback: () => unknown): unknown
    {
        if (!Util.isArray(callback)) {
            return fallback();
        }

        // Here we need to turn the array callable into a Class@method string we can use to
        // examine the container and see if there are any method bindings for this given
        // method. If there are, we can call this method binding callback immediately.
        const method = BoundMethod.normalizeMethod(callback as [object | Abstract, string]);

        if (container.hasMethodBinding(method)) {
            return container.callMethodBinding(method, (callback as [object, string])[0]);
        }

        return fallback();
    }

    /**
     * Normalize the given callback into the pair a method binding is keyed by.
     *
     * PHP flattens this into a `Class@method` string; the target is kept as
     * itself here so two same-named classes cannot share a key.
     */
    private static normalizeMethod(callback: [object | Abstract, string]): [Abstract, string]
    {
        const [target, method] = callback;

        return [(BoundMethod.classOfTarget(target) ?? target) as Abstract, method];
    }

    /** The class a callable's first element refers to, if it can be determined. */
    private static classOfTarget(target: object | Abstract): object | undefined
    {
        if (typeIs(target, 'string')) {
            return undefined;
        }

        return Reflector.isInstance(target) ? Reflector.classOf(target as object) : (target as object);
    }

    /**
     * Get all dependencies for a given method.
     *
     * PHP reads them off the method's `ReflectionParameter`s and appends any
     * leftover parameters; here the declared dependencies come from `Inject`,
     * and only the index-keyed leftovers can be appended in a defined order.
     */
    private static getMethodDependencies(
        container: Container,
        callback: CallableTarget,
        parameters: ParameterOverrides,
    ): Array<defined>
    {
        const dependencies = new Array<defined>();
        const consumed = new Set<Abstract | number>();
        const declared = BoundMethod.getCallDependencies(callback);

        for (let index = 0; index < declared.size(); index++) {
            const dependency = declared[index];
            const abstract = dependency.abstract;

            if (abstract !== undefined && parameters.has(abstract)) {
                dependencies.push(parameters.get(abstract) as defined);
                consumed.add(abstract);

                continue;
            }

            if (parameters.has(index + 1)) {
                dependencies.push(parameters.get(index + 1) as defined);
                consumed.add(index + 1);

                continue;
            }

            const attribute = Util.getContextualAttributeFromDependency(dependency);

            const resolved = attribute !== undefined
                ? container.resolveFromAttribute(attribute)
                : abstract !== undefined
                ? container.make(abstract)
                : undefined;

            if (resolved === undefined && abstract === undefined) {
                throw new BindingResolutionException(
                    `Unresolvable dependency: parameter #${index + 1} declares no binding.`,
                );
            }

            container.fireAfterResolvingAttributeCallbacks(dependency.attributes, resolved);

            // A variadic parameter contributes its elements, not the list --
            // PHP: `array_merge($dependencies, is_array($v) ? $v : [$v])`,
            // the same rule `Container.resolveDependencies()` follows.
            if (dependency.variadic === true) {
                for (const value of Util.arrayWrap(resolved as defined | Array<defined> | undefined)) {
                    dependencies.push(value);
                }

                continue;
            }

            dependencies.push(resolved as defined);
        }

        const leftovers = new Array<[number, defined]>();

        for (const [key, value] of parameters) {
            if (!consumed.has(key) && typeIs(key, 'number')) {
                leftovers.push([key, value as defined]);
            }
        }

        leftovers.sort((first, second) => first[0] < second[0]);

        for (const [, value] of leftovers) {
            dependencies.push(value as defined);
        }

        return dependencies;
    }

    /** What the callable's parameters were annotated with. */
    private static getCallDependencies(callback: CallableTarget): Array<ParameterDependency>
    {
        if (!Util.isArray(callback)) {
            return [];
        }

        const [target, method] = callback as [object | Abstract, string];
        const klass = BoundMethod.classOfTarget(target);

        return klass !== undefined ? getInjectedDependencies(klass, method) : [];
    }

    /**
     * Invoke the callable with the resolved dependencies.
     *
     * roblox-ts compiles every method -- static ones included -- as
     * `function Class:method()`, so the receiver is always passed first, whether
     * it is an instance or the class itself.
     */
    private static invoke(callback: CallableTarget, args: Array<defined>): unknown
    {
        if (!Util.isArray(callback)) {
            return (callback as Callback)(...args);
        }

        const [target, method] = callback as [object, string];
        const fn = (target as unknown as Record<string, unknown>)[method];

        if (!typeIs(fn, 'function')) {
            throw new BindingResolutionException(
                `Method [${method}] does not exist on [${
                    Reflector.className(
                        Reflector.isInstance(target) ? Reflector.classOf(target) : target,
                    )
                }].`,
            );
        }

        return (fn as Callback)(target, ...args);
    }

    /** Determine if the given string is in Class@method syntax. */
    private static isCallableWithAtSign(callback: string): boolean
    {
        const [position] = callback.find('@', 1, true);

        return position !== undefined;
    }
}
