import { BindingResolutionException } from "Illuminate/Contracts/Container/BindingResolutionException";
import { Reflector } from "Illuminate/Support/Reflector";
import type { Abstract } from "Illuminate/Container/Types";
import type { ContextualAttribute } from "Illuminate/Contracts/Container/ContextualAttribute";

/** The method key used for constructor parameters. */
export const CONSTRUCTOR = "constructor";

/**
 * One attribute applied to a parameter: the decorator factory, which stands in
 * for PHP's attribute class, and the instance it produced.
 */
export type ParameterAttribute = [Callback, ContextualAttribute];

/**
 * Everything declared on a single parameter.
 *
 * PHP reads this off a `ReflectionParameter`: the type hint plus whatever
 * attributes were written in front of it.
 */
export interface ParameterDependency {
    /** The abstract named by `Inject`, standing in for the type hint. */
    abstract?: Abstract;

    /** PHP: `ReflectionParameter::isVariadic()`, which a signature cannot say here. */
    variadic?: boolean;

    /** Every attribute applied to the parameter, in declaration order. */
    attributes: Array<ParameterAttribute>;
}

/** class -> method -> parameter index -> declaration. */
const injected = new Map<object, Map<string, Map<number, ParameterDependency>>>();

/** Get, creating on the way, the record for one parameter. */
function declarationFor(target: object, propertyKey: unknown, parameterIndex: number): ParameterDependency {
    const method = typeIs(propertyKey, "string") ? propertyKey : CONSTRUCTOR;

    let methods = injected.get(target);

    if (methods === undefined) {
        methods = new Map<string, Map<number, ParameterDependency>>();
        injected.set(target, methods);
    }

    let parameters = methods.get(method);

    if (parameters === undefined) {
        parameters = new Map<number, ParameterDependency>();
        methods.set(method, parameters);
    }

    let declaration = parameters.get(parameterIndex);

    if (declaration === undefined) {
        declaration = { attributes: new Array<ParameterAttribute>() };
        parameters.set(parameterIndex, declaration);
    }

    return declaration;
}

/**
 * Declare which binding a constructor or method parameter should be resolved
 * from.
 *
 * This attribute has no counterpart in Laravel: PHP reads the parameter's type
 * hint off a `ReflectionParameter`, and Luau erases signatures entirely. It is
 * the type hint, spelled out.
 *
 * ```ts
 * constructor(@Inject("app") app: Application, @Inject(Dispatcher) events: Dispatcher) {}
 * ```
 */
export function Inject(abstract: Abstract) {
    return (target: object, propertyKey: unknown, parameterIndex: number): void => {
        declarationFor(target, propertyKey, parameterIndex).abstract = abstract;
    };
}

/**
 * Record a parameter as variadic, along with the abstract its elements name.
 *
 * The building block `Variadic` is written on top of; PHP gets the same
 * information from `ReflectionParameter::isVariadic()`.
 */
export function addVariadicDependency(
    target: object,
    propertyKey: unknown,
    parameterIndex: number,
    abstract: Abstract,
): void {
    const declaration = declarationFor(target, propertyKey, parameterIndex);

    declaration.abstract = abstract;
    declaration.variadic = true;
}

/**
 * Record a contextual attribute against a parameter.
 *
 * The building block every attribute in this directory is written on top of;
 * PHP gets the same information from `ReflectionParameter::getAttributes()`.
 */
export function addParameterAttribute(
    target: object,
    propertyKey: unknown,
    parameterIndex: number,
    attribute: Callback,
    instance: ContextualAttribute,
): void {
    declarationFor(target, propertyKey, parameterIndex).attributes.push([attribute, instance]);
}

/**
 * What a class' constructor or method parameters declare, in argument order.
 *
 * PHP: `(new ReflectionClass($class))->getConstructor()->getParameters()`.
 *
 * The lookup walks up the class hierarchy so an inherited member keeps its
 * declared dependencies. For a method it stops at the first class that declares
 * the member itself, since an override without annotations takes no arguments,
 * exactly as its own signature says.
 *
 * A constructor gets no such check: roblox-ts emits a `constructor` on every
 * class, forwarding to `super` when the source declares none, so an owned
 * constructor is indistinguishable from an inherited one. A subclass that
 * declares its own constructor and annotates nothing therefore inherits the
 * parent's dependencies -- annotate it to override them.
 */
export function getInjectedDependencies(target: unknown, method: string = CONSTRUCTOR): Array<ParameterDependency> {
    if (!typeIs(target, "table")) {
        return [];
    }

    let current: object | undefined = target;

    while (current !== undefined) {
        const parameters = injected.get(current)?.get(method);

        if (parameters !== undefined) {
            return collect(parameters, current, method);
        }

        if (method !== CONSTRUCTOR && rawget(current, method) !== undefined) {
            return [];
        }

        current = Reflector.parentClass(current);
    }

    return [];
}

/**
 * Flatten the parameter map into an argument list.
 *
 * An unannotated parameter contributes nothing, which is what lets a trailing
 * parameter fall back to its TypeScript default -- the compiled constructor
 * fills it in when the argument is missing. A *gap* cannot work the same way:
 * a Luau array holds no `nil`, so the argument list would silently shorten.
 * That is reported instead.
 */
function collect(
    parameters: Map<number, ParameterDependency>,
    target: object,
    method: string,
): Array<ParameterDependency> {
    let highest = -1;

    for (const [index] of parameters) {
        if (index > highest) {
            highest = index;
        }
    }

    const dependencies = new Array<ParameterDependency>();

    for (let index = 0; index <= highest; index++) {
        const declaration = parameters.get(index);

        if (declaration === undefined) {
            throw new BindingResolutionException(
                `Parameter #${index} of [${Reflector.className(target)}::${method}] is not annotated while a later one is. ` +
                    `Annotated parameters have to come first; annotate it, or move it after the annotated ones so its default applies.`,
            );
        }

        dependencies.push(declaration);
    }

    return dependencies;
}
