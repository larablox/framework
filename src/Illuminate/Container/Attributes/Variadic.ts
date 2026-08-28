import { addVariadicDependency } from 'Illuminate/Container/Attributes/Inject';
import type { Abstract } from 'Illuminate/Container/Types';

/**
 * Declare a rest parameter and the abstract its elements come from.
 *
 * PHP reads variadic-ness off `ReflectionParameter::isVariadic()`; a compiled
 * signature says nothing, so the annotation carries it. Only the last parameter
 * can be variadic, and its values are spread into the argument list.
 *
 * With a contextual binding that gives a list, each entry is resolved:
 *
 * ```ts
 * app.when(Pipeline).needs(Filter).give([TrimFilter, ProfanityFilter]);
 *
 * class Pipeline {
 *     constructor(@Variadic(Filter) ...filters: Array<Filter>) {}
 * }
 * ```
 */
export function Variadic(abstract: Abstract) {
    return (target: object, propertyKey: unknown, parameterIndex: number): void => {
        addVariadicDependency(target, propertyKey, parameterIndex, abstract);
    };
}
