import { Arr } from 'Illuminate/Support/Arr';
import { SubstituteBindings } from 'Illuminate/Routing/Middleware/SubstituteBindings';
import { ThrottleRequests } from 'Illuminate/Routing/Middleware/ThrottleRequests';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Foundation\Configuration\Middleware`.
 *
 * The object `withMiddleware()` hands to `bootstrap/app.ts`: it collects what
 * the application wants changed and the builder plays the result onto the
 * kernel.
 *
 * Two of PHP's three default stacks have nothing to fill them with. The global
 * stack is empty because every entry on PHP's list belongs to a web server --
 * `TrustProxies`, `HandleCors`, `ValidatePostSize`, `TrimStrings` and the rest
 * of them read headers and form input that no remote carries; the gateway
 * enforces what is left (a well-formed envelope of bounded size) before the
 * kernel is reached at all. The `web` group is cookies, sessions, CSRF and
 * error views, none of which are ported. What survives is the `api` group,
 * which is what every request over a remote is.
 *
 * Not ported with the groups: `web()`, `pages()`, the redirect helpers,
 * `encryptCookies()`, `preventRequestForgery()`, `validateCsrfTokens()`,
 * `validateSignatures()`, `trustHosts()`, `trustProxies()`,
 * `preventRequestsDuringMaintenance()`, `statefulApi()`, `throttleWithRedis()`
 * and `authenticateSessions()`.
 */
export class Middleware
{
    /** The user defined global middleware stack. */
    protected global?: Array<Pipe>;

    /** The middleware that should be prepended to the global middleware stack. */
    protected prepends = new Array<Pipe>();

    /** The middleware that should be appended to the global middleware stack. */
    protected appends = new Array<Pipe>();

    /** The middleware that should be removed from the global middleware stack. */
    protected removals = new Array<Pipe>();

    /** The middleware that should be replaced in the global middleware stack. */
    protected replacements = new Array<[Pipe, Pipe]>();

    /** The user defined middleware groups. */
    protected groups: Record<string, Array<Pipe>> = {};

    /** The middleware that should be prepended to the specified groups. */
    protected groupPrepends: Record<string, Array<Pipe>> = {};

    /** The middleware that should be appended to the specified groups. */
    protected groupAppends: Record<string, Array<Pipe>> = {};

    /** The middleware that should be removed from the specified groups. */
    protected groupRemovals: Record<string, Array<Pipe>> = {};

    /** The middleware that should be replaced in the specified groups. */
    protected groupReplacements: Record<string, Array<[Pipe, Pipe]>> = {};

    /** Indicates the API middleware group's rate limiter. */
    protected apiLimiter?: string;

    /** The custom middleware aliases. */
    protected customAliases: Record<string, Pipe> = {};

    /** The custom middleware priority definition. */
    protected priorityList = new Array<Pipe>();

    /** The middleware to prepend to the middleware priority definition. */
    protected prependPriority = new Array<[Pipe, Pipe | Array<Pipe>]>();

    /** The middleware to append to the middleware priority definition. */
    protected appendPriority = new Array<[Pipe, Pipe | Array<Pipe>]>();

    /** Prepend middleware to the application's global middleware stack. */
    public prepend(middleware: Pipe | Array<Pipe>): this
    {
        this.prepends = [
            ...Arr.wrap(middleware),
            ...this.prepends,
        ];

        return this;
    }

    /** Append middleware to the application's global middleware stack. */
    public append(middleware: Pipe | Array<Pipe>): this
    {
        this.appends = [
            ...this.appends,
            ...Arr.wrap(middleware),
        ];

        return this;
    }

    /** Remove middleware from the application's global middleware stack. */
    public remove(middleware: Pipe | Array<Pipe>): this
    {
        this.removals = [
            ...this.removals,
            ...Arr.wrap(middleware),
        ];

        return this;
    }

    /** Specify a middleware that should be replaced with another middleware. */
    public replace(search: Pipe, replace: Pipe): this
    {
        this.replacements.push([
            search,
            replace,
        ]);

        return this;
    }

    /**
     * Define the global middleware for the application.
     *
     * PHP calls this `use()`, which is a reserved word here.
     */
    public useMiddleware(middleware: Array<Pipe>): this
    {
        this.global = middleware;

        return this;
    }

    /** Define a middleware group. */
    public group(group: string, middleware: Array<Pipe>): this
    {
        this.groups[group] = middleware;

        return this;
    }

    /** Prepend the given middleware to the specified group. */
    public prependToGroup(group: string, middleware: Pipe | Array<Pipe>): this
    {
        this.groupPrepends[group] = [
            ...Arr.wrap(middleware),
            ...(this.groupPrepends[group] ?? new Array<Pipe>()),
        ];

        return this;
    }

    /** Append the given middleware to the specified group. */
    public appendToGroup(group: string, middleware: Pipe | Array<Pipe>): this
    {
        this.groupAppends[group] = [
            ...(this.groupAppends[group] ?? new Array<Pipe>()),
            ...Arr.wrap(middleware),
        ];

        return this;
    }

    /** Remove the given middleware from the specified group. */
    public removeFromGroup(group: string, middleware: Pipe | Array<Pipe>): this
    {
        this.groupRemovals[group] = [
            ...Arr.wrap(middleware),
            ...(this.groupRemovals[group] ?? new Array<Pipe>()),
        ];

        return this;
    }

    /** Replace the given middleware in the specified group with another middleware. */
    public replaceInGroup(group: string, search: Pipe, replace: Pipe): this
    {
        const replacements = this.groupReplacements[group] ?? new Array<[Pipe, Pipe]>();

        replacements.push([
            search,
            replace,
        ]);

        this.groupReplacements[group] = replacements;

        return this;
    }

    /** Modify the middleware in the "api" group. */
    public api(
        append: Pipe | Array<Pipe> = [],
        prepend: Pipe | Array<Pipe> = [],
        remove: Pipe | Array<Pipe> = [],
        replace: Array<[Pipe, Pipe]> = [],
    ): this
    {
        return this.modifyGroup('api', append, prepend, remove, replace);
    }

    /** Modify the middleware in the given group. */
    protected modifyGroup(
        group: string,
        append: Pipe | Array<Pipe>,
        prepend: Pipe | Array<Pipe>,
        remove: Pipe | Array<Pipe>,
        replace: Array<[Pipe, Pipe]>,
    ): this
    {
        if (!this.empty(append)) {
            this.appendToGroup(group, append);
        }

        if (!this.empty(prepend)) {
            this.prependToGroup(group, prepend);
        }

        if (!this.empty(remove)) {
            this.removeFromGroup(group, remove);
        }

        for (const [search, replacement] of replace) {
            this.replaceInGroup(group, search, replacement);
        }

        return this;
    }

    /** Register additional middleware aliases. */
    public alias(aliases: Record<string, Pipe>): this
    {
        this.customAliases = aliases;

        return this;
    }

    /** Define the middleware priority for the application. */
    public priority(priority: Array<Pipe>): this
    {
        this.priorityList = priority;

        return this;
    }

    /** Prepend middleware to the priority middleware. */
    public prependToPriorityList(before: Pipe | Array<Pipe>, prepend: Pipe): this
    {
        this.prependPriority.push([
            prepend,
            before,
        ]);

        return this;
    }

    /** Append middleware to the priority middleware. */
    public appendToPriorityList(after: Pipe | Array<Pipe>, append: Pipe): this
    {
        this.appendPriority.push([
            append,
            after,
        ]);

        return this;
    }

    /** Indicate that the API middleware group should throttle requests. */
    public throttleApi(limiter = 'api'): this
    {
        this.apiLimiter = limiter;

        return this;
    }

    /** Get the global middleware. */
    public getGlobalMiddleware(): Array<Pipe>
    {
        const middleware = this.global ?? new Array<Pipe>();
        const replaced = new Array<Pipe>();

        for (const entry of middleware) {
            replaced.push(this.replacementFor(this.replacements, entry));
        }

        const merged = [
            ...this.prepends,
            ...replaced,
            ...this.appends,
        ];
        const resolved = new Array<Pipe>();

        for (const entry of merged) {
            if (!resolved.includes(entry) && !this.removals.includes(entry)) {
                resolved.push(entry);
            }
        }

        return resolved;
    }

    /** Get the middleware groups. */
    public getMiddlewareGroups(): Record<string, Array<Pipe>>
    {
        const middleware: Record<string, Array<Pipe>> = {
            api: this.apiLimiter !== undefined
                ? [
                    `throttle:${this.apiLimiter}`,
                    SubstituteBindings,
                ]
                : [SubstituteBindings],
        };

        for (const [group, groupMiddleware] of pairs(this.groups)) {
            middleware[group as string] = groupMiddleware as Array<Pipe>;
        }

        for (const [group, replacements] of pairs(this.groupReplacements)) {
            const replaced = new Array<Pipe>();

            for (const entry of middleware[group as string] ?? new Array<Pipe>()) {
                replaced.push(this.replacementFor(replacements as Array<[Pipe, Pipe]>, entry));
            }

            middleware[group as string] = replaced;
        }

        for (const [group, removals] of pairs(this.groupRemovals)) {
            middleware[group as string] = this.unique(
                middleware[group as string] ?? new Array<Pipe>(),
                removals as Array<Pipe>,
            );
        }

        for (const [group, prepends] of pairs(this.groupPrepends)) {
            middleware[group as string] = this.unique([
                ...(prepends as Array<Pipe>),
                ...(middleware[group as string] ?? new Array<Pipe>()),
            ]);
        }

        for (const [group, appends] of pairs(this.groupAppends)) {
            middleware[group as string] = this.unique([
                ...(middleware[group as string] ?? new Array<Pipe>()),
                ...(appends as Array<Pipe>),
            ]);
        }

        return middleware;
    }

    /** Get the middleware aliases. */
    public getMiddlewareAliases(): Record<string, Pipe>
    {
        const aliases = this.defaultAliases();

        for (const [alias, middleware] of pairs(this.customAliases)) {
            aliases[alias as string] = middleware as Pipe;
        }

        return aliases;
    }

    /**
     * Get the default middleware aliases.
     *
     * One of PHP's eleven survives: the rest name authentication,
     * authorisation, sessions, signed URLs and precognition.
     */
    protected defaultAliases(): Record<string, Pipe>
    {
        return {
            throttle: ThrottleRequests,
        };
    }

    /** Get the middleware priority for the application. */
    public getMiddlewarePriority(): Array<Pipe>
    {
        return this.priorityList;
    }

    /** Get the middleware to prepend to the middleware priority definition. */
    public getMiddlewarePriorityPrepends(): Array<[Pipe, Pipe | Array<Pipe>]>
    {
        return this.prependPriority;
    }

    /** Get the middleware to append to the middleware priority definition. */
    public getMiddlewarePriorityAppends(): Array<[Pipe, Pipe | Array<Pipe>]>
    {
        return this.appendPriority;
    }

    // -----------------------------------------------------------------
    // Platform helpers
    // -----------------------------------------------------------------

    /**
     * The replacement registered for the given middleware, or the middleware.
     *
     * PHP keys the replacements by the middleware they replace; a class is not
     * a string here, so the pair is a list and the look-up is a walk.
     */
    protected replacementFor(replacements: Array<[Pipe, Pipe]>, middleware: Pipe): Pipe
    {
        for (const [search, replacement] of replacements) {
            if (search === middleware) {
                return replacement;
            }
        }

        return middleware;
    }

    /** The list with duplicates -- and anything removed -- taken out. */
    protected unique(middleware: Array<Pipe>, removals: Array<Pipe> = []): Array<Pipe>
    {
        const resolved = new Array<Pipe>();

        for (const entry of middleware) {
            if (!resolved.includes(entry) && !removals.includes(entry)) {
                resolved.push(entry);
            }
        }

        return resolved;
    }

    /**
     * PHP: `empty($middleware)`.
     *
     * A class is a table with nothing in its array part, so asking for the size
     * alone would call every class empty. A compiled class carries a metatable
     * and a plain list does not, which is the test `Pipeline::asList()` makes.
     */
    protected empty(middleware: Pipe | Array<Pipe>): boolean
    {
        return (
            typeIs(middleware, 'table')
            && getmetatable(middleware as object) === undefined
            && (middleware as Array<Pipe>).isEmpty()
        );
    }
}
