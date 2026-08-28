import { InvalidArgumentException } from 'Illuminate/Exception';
import { Str } from 'Illuminate/Support/Str';

/** One segment of a compiled URI: either literal text or a parameter. */
export interface RouteSegment {
    /** The parameter name, or undefined when the segment is literal. */
    readonly name?: string;

    /** The literal text, or undefined when the segment is a parameter. */
    readonly text?: string;

    /** Whether the parameter may be left out. */
    readonly optional: boolean;
}

/**
 * PHP: `Symfony\Component\Routing\CompiledRoute`, as far as this port needs it.
 *
 * Symfony compiles a URI into one big regular expression and matches the whole
 * path against it. There are no regular expressions here -- Luau patterns have
 * no alternation, no groups under a quantifier and no lookaround -- so a URI
 * compiles into a list of segments and matching walks them one at a time.
 *
 * What that costs, and it is worth knowing before writing a route:
 *
 * - **a parameter owns its whole segment.** `posts/{post}` is fine,
 *   `posts/post-{id}` is refused when the route is registered, because the
 *   `where` pattern for `id` would have to be spliced into the middle of a
 *   segment pattern, and a Luau pattern does not compose that way;
 * - **optional parameters have to be last**, which is what Symfony requires
 *   too, and for the same reason: anything after them could not be placed;
 * - **a `where` pattern is matched against a single segment**, unless the
 *   parameter is the last one: then it takes whatever is left of the path --
 *   several segments, or none -- and its pattern judges the lot, the way
 *   Symfony's regular expression does. That is what `where('path', '.*')` and
 *   `Route::fallback()`, which is built out of exactly that, rely on. A
 *   trailing parameter with no pattern still takes one segment: nothing would
 *   be left to refuse the rest with.
 */
export class CompiledRoute {
    /** Create a new compiled route. */
    public constructor(
        public readonly segments: Array<RouteSegment>,
        public readonly parameterNames: Array<string>,
    ) {}

    /** Compile the given URI into the segments matching walks. */
    public static compile(uri: string): CompiledRoute {
        const segments = new Array<RouteSegment>();
        const parameterNames = new Array<string>();
        let seenOptional = false;

        for (const raw of CompiledRoute.split(uri)) {
            const [inner] = raw.match('^{(.*)}$');

            if (!typeIs(inner, 'string')) {
                if (Str.contains(raw, '{')) {
                    throw new InvalidArgumentException(
                        `Route pattern [${uri}] puts a parameter inside the segment [${raw}]; a parameter has to be a whole segment here.`,
                    );
                }

                if (seenOptional) {
                    throw new InvalidArgumentException(
                        `Route pattern [${uri}] has a segment after an optional parameter; optional parameters have to come last.`,
                    );
                }

                segments.push({ text: raw, optional: false });

                continue;
            }

            const optional = inner.sub(inner.size(), inner.size()) === '?';
            const name = optional ? inner.sub(1, inner.size() - 1) : inner;

            if (name === '') {
                throw new InvalidArgumentException(`Route pattern [${uri}] has an unnamed parameter.`);
            }

            if (seenOptional && !optional) {
                throw new InvalidArgumentException(
                    `Route pattern [${uri}] has a required parameter after an optional one; optional parameters have to come last.`,
                );
            }

            seenOptional = seenOptional || optional;

            segments.push({ name: name, optional: optional });
            parameterNames.push(name);
        }

        return new CompiledRoute(segments, parameterNames);
    }

    /**
     * Match a path against the compiled segments.
     *
     * Answers the parameters the path carried, or `undefined` when it does not
     * match at all -- which is the whole of what `UriValidator` asks, and what
     * `RouteParameterBinder` reads the values out of.
     */
    public match(path: string, wheres: Record<string, string> = {}): Map<string, string> | undefined {
        const parts = CompiledRoute.split(path);
        const parameters = new Map<string, string>();
        const overflowing = parts.size() > this.segments.size();

        if (overflowing && !this.trailingParameterSpans(wheres)) {
            return undefined;
        }

        for (let index = 0; index < this.segments.size(); index++) {
            const segment = this.segments[index];
            const last = index === this.segments.size() - 1;
            const pattern = segment.name !== undefined ? wheres[segment.name] : undefined;

            // A trailing parameter with a pattern takes whatever is left of the
            // path -- several parts, or none at all -- and the pattern below
            // judges the lot: `where("id", "%d+")` still refuses `users/1/2`,
            // and `where("path", ".*")` takes `a/b/c`. Without a pattern there
            // would be nothing to refuse the rest with, so the parameter takes
            // one part and the length check above has already turned away
            // anything longer.
            const value = last && pattern !== undefined ? CompiledRoute.rest(parts, index) : parts[index];

            if (segment.name === undefined) {
                if (value !== segment.text) {
                    return undefined;
                }

                continue;
            }

            if (value === undefined) {
                if (!segment.optional) {
                    return undefined;
                }

                continue;
            }

            if (pattern !== undefined) {
                const [matched] = value.match(`^${pattern}$`);

                if (matched === undefined) {
                    return undefined;
                }
            }

            parameters.set(segment.name, value);
        }

        return parameters;
    }

    /**
     * Determine whether the last segment may take more than one part.
     *
     * Only a parameter carrying a `where` pattern may: the pattern is what
     * decides whether the rest of the path belongs to it, exactly as Symfony's
     * regular expression does. Without one, a route matches its own number of
     * segments and no more.
     */
    protected trailingParameterSpans(wheres: Record<string, string>): boolean {
        const last = this.segments[this.segments.size() - 1];

        return last !== undefined && last.name !== undefined && wheres[last.name] !== undefined;
    }

    /** The path from the given part onwards, joined back together. */
    protected static rest(parts: Array<string>, from: number): string {
        const remaining = new Array<string>();

        for (let index = from; index < parts.size(); index++) {
            remaining.push(parts[index]);
        }

        return remaining.join('/');
    }

    /** Split a URI into segments, treating "/" as no segments at all. */
    protected static split(uri: string): Array<string> {
        const segments = new Array<string>();

        for (const segment of uri.split('/')) {
            if (segment !== '') {
                segments.push(segment);
            }
        }

        return segments;
    }
}
