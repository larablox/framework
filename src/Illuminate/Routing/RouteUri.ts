import { Str } from "Illuminate/Support/Str";

/**
 * PHP: `Illuminate\Routing\RouteUri`.
 *
 * Pulls the binding fields out of a URI: `{user:slug}` becomes the parameter
 * `user` bound by `slug`, and the URI it leaves behind names the parameter
 * alone. The fields are read by implicit model binding, which waits for
 * `Illuminate\Database`; the parsing is here already so a URI written with
 * them does not silently register a parameter called `user:slug`.
 *
 * PHP scans the whole URI with one regular expression. This walks it a segment
 * at a time -- `where` constraints and matching work per segment here, and a
 * parameter that shares its segment with anything else is refused when the
 * route is compiled.
 */
export class RouteUri {
    /** Create a new route URI instance. */
    public constructor(
        public readonly uri: string,
        public readonly bindingFields: Record<string, string> = {},
    ) {}

    /** Parse the given URI, extracting the binding fields. */
    public static parse(uri: string): RouteUri {
        const bindingFields: Record<string, string> = {};
        const segments = uri.split("/");

        for (let index = 0; index < segments.size(); index++) {
            const [inner] = segments[index].match("^{(.*)}$");

            if (!typeIs(inner, "string") || !Str.contains(inner, ":")) {
                continue;
            }

            const optional = inner.sub(inner.size(), inner.size()) === "?";
            const declaration = optional ? inner.sub(1, inner.size() - 1) : inner;
            const [name, field] = declaration.split(":");

            bindingFields[name] = field;
            segments[index] = `{${name}${optional ? "?" : ""}}`;
        }

        return new RouteUri(segments.join("/"), bindingFields);
    }
}
