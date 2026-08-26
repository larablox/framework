import { CallableDispatcher } from "Illuminate/Routing/CallableDispatcher";
import { CompiledRoute } from "Illuminate/Routing/CompiledRoute";
import { Container } from "Illuminate/Container/Container";
import { ControllerDispatcher } from "Illuminate/Routing/ControllerDispatcher";
import { HttpResponseException } from "Illuminate/Http/Exceptions/HttpResponseException";
import { LogicException } from "Illuminate/Exception";
import { MethodValidator } from "Illuminate/Routing/Matching/MethodValidator";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { RouteAction } from "Illuminate/Routing/RouteAction";
import { RouteParameterBinder } from "Illuminate/Routing/RouteParameterBinder";
import { RouteUri } from "Illuminate/Routing/RouteUri";
import { Str } from "Illuminate/Support/Str";
import { TransportValidator } from "Illuminate/Routing/Matching/TransportValidator";
import { UriValidator } from "Illuminate/Routing/Matching/UriValidator";
import { Util } from "Illuminate/Container/Util";
import type {
    ActionAttributes,
    ControllerAction,
} from "Illuminate/Routing/RouteAction";
import type { Container as ContainerContract } from "Illuminate/Contracts/Container/Container";
import type { CallableDispatcher as CallableDispatcherContract } from "Illuminate/Routing/Contracts/CallableDispatcher";
import type { ControllerDispatcher as ControllerDispatcherContract } from "Illuminate/Routing/Contracts/ControllerDispatcher";
import type { Pipe } from "Illuminate/Contracts/Pipeline/Pipeline";
import type { Request } from "Illuminate/Http/Request";
import type { Router } from "Illuminate/Routing/Router";
import type { Transport } from "Illuminate/Http/Remote";
import type { ValidatorInterface } from "Illuminate/Routing/Matching/ValidatorInterface";

/** The transports an ordinary route answers on. */
const DEFAULT_TRANSPORTS: Array<Transport> = ["call", "send"];

/**
 * PHP: `Illuminate\Routing\Route`.
 *
 * Several PHP properties share their name with a method (`$uri` and `uri()`,
 * `$methods` and `methods()`, `$parameters` and `parameters()`). Both live in
 * the class table once compiled and would collide, so the fields are the ones
 * renamed -- the public API keeps PHP's names, as it does in `Container`.
 *
 * Not ported: domains and schemes (`domain()`, `secure()`, `httpOnly()`),
 * `can()` (waits for authorization), `missing()` and the scoped-binding
 * switches (they steer implicit model binding, which waits for the database),
 * `block()`/`withoutBlocking()`/`locksFor()` (session locks), the Symfony
 * conversions and `prepareForSerialization()` (route caching needs a console).
 */
export class Route {
    /** PHP: `$uri`. */
    protected uriPattern = "";

    /** PHP: `$methods`. */
    protected httpMethods: Array<string>;

    /** Which remotes the route answers on; PHP's nearest thing is the scheme. */
    protected transportList: Array<Transport> = DEFAULT_TRANSPORTS;

    /** The route action array. */
    public action: ActionAttributes;

    /** Indicates whether the route is a fallback route. */
    public isFallback = false;

    /** The controller instance. */
    protected controller?: object;

    /** The default values for the route. */
    public defaultValues: Record<string, unknown> = {};

    /** The regular expression requirements. */
    public wheres: Record<string, string> = {};

    /** The array of matched parameters. */
    protected parameterValues?: OrderedMap<string, defined>;

    /** The array of matched parameters' original values. */
    protected originalParameterValues?: OrderedMap<string, defined>;

    /** The parameter names for the route. */
    protected compiledParameterNames?: Array<string>;

    /** The fields that should be used when resolving bindings. */
    protected bindingFieldMap: Record<string, string> = {};

    /** The compiled version of the route. */
    protected compiled?: CompiledRoute;

    /** The computed gathered middleware. */
    protected computedMiddleware?: Array<Pipe>;

    /** The router instance used by the route. */
    protected router?: Router;

    /** The container instance used by the route. */
    protected container?: ContainerContract;

    /** The validators used by the routes. */
    protected static validators?: Array<ValidatorInterface>;

    /** Create a new Route instance. */
    public constructor(
        methods: string | Array<string>,
        uri: string,
        action?: ActionAttributes,
    ) {
        this.httpMethods = Util.arrayWrap(methods);
        this.action = action ?? {};

        // PHP: a route that answers GET answers HEAD too, whether or not the
        // caller listed it -- `Router::get()` passes both, but
        // `Router::match(['GET'], ...)` passes only GET.
        if (
            this.httpMethods.includes("GET") &&
            !this.httpMethods.includes("HEAD")
        ) {
            this.httpMethods.push("HEAD");
        }

        // PHP drops the prefix off the action here and applies it through
        // `prefix()` below, so that the URI and the action agree.
        const prefix = this.action.prefix;

        this.action.prefix = undefined;

        // The URI is stored raw and parsed by the `prefix()` call below, which
        // is the only place PHP parses it too. Running `setUri()` here as well
        // would parse `foo/{bar:slug}` into `foo/{bar}` first, and `prefix()`
        // would then re-parse that -- losing every binding field.
        this.uriPattern = uri;
        this.prefix(prefix ?? "");
    }

    // -----------------------------------------------------------------
    // Running
    // -----------------------------------------------------------------

    /** Run the route action and return the response. */
    public run(): unknown {
        this.container = this.container ?? new Container();

        try {
            if (this.isControllerAction()) {
                return this.runController();
            }

            return this.runCallable();
        } catch (exception) {
            if (exception instanceof HttpResponseException) {
                return exception.getResponse();
            }

            throw exception;
        }
    }

    /** Checks whether the route's action is a controller. */
    public isControllerAction(): boolean {
        return this.action.controller !== undefined;
    }

    /** Run the route action and return the response. */
    protected runCallable(): unknown {
        return this.callableDispatcher().dispatch(
            this,
            this.action.uses as Callback,
        );
    }

    /**
     * Get the dispatcher for the route's callable.
     *
     * Same shape as `controllerDispatcher()` below, and for the same reason:
     * `run()` falls back to a bare `Container` when the route was never given
     * one, and a bare container has no `RoutingServiceProvider` bindings. PHP
     * still resolves `CallableDispatcher` there because it autowires the
     * constructor's `Container` type hint; nothing reads type hints here (see
     * `agent_docs/roblox-ts-constraints.md`), so the dispatcher has to be
     * constructed by hand when it is not bound.
     */
    public callableDispatcher(): CallableDispatcherContract {
        if (
            this.container !== undefined &&
            this.container.bound(CallableDispatcher)
        ) {
            return this.container.make<CallableDispatcher>(CallableDispatcher);
        }

        return new CallableDispatcher(this.container ?? new Container());
    }

    /** Run the route action and return the response. */
    protected runController(): unknown {
        return this.controllerDispatcher().dispatch(
            this,
            this.getController() as object,
            this.getControllerMethod(),
        );
    }

    /** Get the controller instance for the route. */
    public getController(): object | undefined {
        if (!this.isControllerAction()) {
            return undefined;
        }

        if (this.controller === undefined) {
            this.controller = this.container!.make(
                this.getControllerClass(),
            ) as object;
        }

        return this.controller;
    }

    /** Get the controller class used for the route. */
    public getControllerClass(): ControllerAction[0] {
        return (this.action.controller as ControllerAction)[0];
    }

    /** Get the controller method used for the route. */
    public getControllerMethod(): string {
        return (this.action.controller as ControllerAction)[1];
    }

    /** Flush the cached container instance on the route. */
    public flushController(): void {
        this.controller = undefined;
    }

    /** Get the dispatcher for the route's controller. */
    public controllerDispatcher(): ControllerDispatcherContract {
        if (
            this.container !== undefined &&
            this.container.bound(ControllerDispatcher)
        ) {
            return this.container.make<ControllerDispatcher>(
                ControllerDispatcher,
            );
        }

        return new ControllerDispatcher(this.container ?? new Container());
    }

    // -----------------------------------------------------------------
    // Matching
    // -----------------------------------------------------------------

    /** Determine if the route matches a given request. */
    public matches(request: Request, includingMethod = true): boolean {
        this.compileRoute();

        for (const validator of Route.getValidators()) {
            if (!includingMethod && validator instanceof MethodValidator) {
                continue;
            }

            if (!validator.matches(this, request)) {
                return false;
            }
        }

        return true;
    }

    /** Compile the route into a matchable form. */
    protected compileRoute(): CompiledRoute {
        if (this.compiled === undefined) {
            this.compiled = CompiledRoute.compile(this.uriPattern);
        }

        return this.compiled;
    }

    /** Get the compiled version of the route. */
    public getCompiled(): CompiledRoute {
        return this.compileRoute();
    }

    /** Get the route validators for the instance. */
    public static getValidators(): Array<ValidatorInterface> {
        if (Route.validators === undefined) {
            Route.validators = [
                new UriValidator(),
                new MethodValidator(),
                new TransportValidator(),
            ];
        }

        return Route.validators;
    }

    // -----------------------------------------------------------------
    // Parameters
    // -----------------------------------------------------------------

    /** Bind the route to a given request for execution. */
    public bind(request: Request): this {
        this.compileRoute();

        this.parameterValues = new RouteParameterBinder(this).parameters(
            request,
        );

        this.originalParameterValues = this.parameterValues;

        return this;
    }

    /** Determine if the route has parameters. */
    public hasParameters(): boolean {
        return this.parameterValues !== undefined;
    }

    /** Determine a given parameter exists from the route. */
    public hasParameter(name: string): boolean {
        return this.hasParameters() && this.parameters().has(name);
    }

    /** Get a given parameter from the route. */
    public parameter(name: string, defaultValue?: unknown): unknown {
        return this.parameters().get(name) ?? defaultValue;
    }

    /** Get original value of a given parameter from the route. */
    public originalParameter(name: string, defaultValue?: unknown): unknown {
        return this.originalParameters().get(name) ?? defaultValue;
    }

    /** Set a parameter to the given value. */
    public setParameter(name: string, value: defined): void {
        this.parameters().set(name, value);
    }

    /** Unset a parameter on the route if it is set. */
    public forgetParameter(name: string): void {
        this.parameters().delete(name);
    }

    /** Get the key / value list of parameters for the route. */
    public parameters(): OrderedMap<string, defined> {
        if (this.parameterValues === undefined) {
            throw new LogicException("Route is not bound.");
        }

        return this.parameterValues;
    }

    /** Get the key / value list of original parameters for the route. */
    public originalParameters(): OrderedMap<string, defined> {
        if (this.originalParameterValues === undefined) {
            throw new LogicException("Route is not bound.");
        }

        return this.originalParameterValues;
    }

    /**
     * Get the key / value list of parameters without null values.
     *
     * A Luau table holds no nulls to filter, so this is `parameters()` -- kept
     * because the dispatchers are written in terms of it in PHP.
     */
    public parametersWithoutNulls(): OrderedMap<string, defined> {
        return this.parameters();
    }

    /** Get all of the parameter names for the route. */
    public parameterNames(): Array<string> {
        if (this.compiledParameterNames === undefined) {
            this.compiledParameterNames = this.getCompiled().parameterNames;
        }

        return this.compiledParameterNames;
    }

    /** Get the parameters that are listed in the route / controller signature. */
    public getOptionalParameterNames(): Array<string> {
        const optional = new Array<string>();

        for (const segment of this.getCompiled().segments) {
            if (segment.optional && segment.name !== undefined) {
                optional.push(segment.name);
            }
        }

        return optional;
    }

    /** Get the binding field for the given parameter. */
    public bindingFieldFor(parameter: string): string | undefined {
        return this.bindingFieldMap[parameter];
    }

    /** Get the binding fields for the route. */
    public bindingFields(): Record<string, string> {
        return this.bindingFieldMap;
    }

    /** Set the binding fields for the route. */
    public setBindingFields(bindingFields: Record<string, string>): this {
        this.bindingFieldMap = bindingFields;

        return this;
    }

    /** Get the default value given to a parameter. */
    public defaults(key: string, value: unknown): this {
        this.defaultValues[key] = value;

        return this;
    }

    /** Set the default values for the route. */
    public setDefaults(defaults: Record<string, unknown>): this {
        this.defaultValues = defaults;

        return this;
    }

    // -----------------------------------------------------------------
    // Constraints
    // -----------------------------------------------------------------

    /**
     * Set a regular expression requirement on the route.
     *
     * The pattern is a Luau pattern, matched against one whole segment. PCRE
     * spellings that happen to be valid Luau -- `[0-9]+`, `%a+` -- work as
     * they are; alternation and lookaround have no equivalent.
     */
    public where(
        name: string | Record<string, string>,
        expression?: string,
    ): this {
        for (const [key, pattern] of pairs(this.parseWhere(name, expression))) {
            this.wheres[key as string] = pattern as string;
        }

        return this;
    }

    /** Parse arguments to the where method into an array. */
    protected parseWhere(
        name: string | Record<string, string>,
        expression?: string,
    ): Record<string, string> {
        if (typeIs(name, "table")) {
            return name;
        }

        return { [name]: expression as string };
    }

    /** Set a list of regular expression requirements on the route. */
    public setWheres(wheres: Record<string, string>): this {
        return this.where(wheres);
    }

    /** Specify that the given route parameters must be numeric. */
    public whereNumber(parameters: string | Array<string>): this {
        return this.assignExpressionToParameters(parameters, "%d+");
    }

    /** Specify that the given route parameters must be alphabetic. */
    public whereAlpha(parameters: string | Array<string>): this {
        return this.assignExpressionToParameters(parameters, "%a+");
    }

    /** Specify that the given route parameters must be alphanumeric. */
    public whereAlphaNumeric(parameters: string | Array<string>): this {
        return this.assignExpressionToParameters(parameters, "%w+");
    }

    /** Specify that the given route parameters must be UUIDs. */
    public whereUuid(parameters: string | Array<string>): this {
        return this.assignExpressionToParameters(
            parameters,
            "%x%x%x%x%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x",
        );
    }

    /**
     * Specify that the given route parameters must be ULIDs.
     *
     * PHP: `[0-7][0-9a-hjkmnp-tv-zA-HJKMNP-TV-Z]{25}` -- the first character
     * is the top of the timestamp and cannot go past 7, and the remaining 25
     * are Crockford base32 in either case.
     */
    public whereUlid(parameters: string | Array<string>): this {
        return this.assignExpressionToParameters(
            parameters,
            `[0-7]${"[0-9a-hjkmnp-tv-zA-HJKMNP-TV-Z]".rep(25)}`,
        );
    }

    /** Apply the given expression to the given parameters. */
    protected assignExpressionToParameters(
        parameters: string | Array<string>,
        expression: string,
    ): this {
        for (const parameter of Util.arrayWrap(parameters)) {
            this.where(parameter, expression);
        }

        return this;
    }

    // -----------------------------------------------------------------
    // Definition
    // -----------------------------------------------------------------

    /** Mark this route as a fallback route. */
    public fallback(): this {
        this.isFallback = true;

        return this;
    }

    /** Set the fallback value. */
    public setFallback(isFallback: boolean): this {
        this.isFallback = isFallback;

        return this;
    }

    /** Get the HTTP verbs the route responds to. */
    public methods(): Array<string> {
        return this.httpMethods;
    }

    /** Get the remotes the route answers on. */
    public transports(): Array<Transport> {
        return this.transportList;
    }

    /** Set the remotes the route answers on. */
    public setTransports(transports: Array<Transport>): this {
        this.transportList = transports;

        return this;
    }

    /**
     * Restrict the route to the remote that carries a response.
     *
     * PHP: `httpsOnly()`.
     */
    public reliable(): this {
        return this.setTransports(["call"]);
    }

    /** Get the URI associated with the route. */
    public uri(): string {
        return this.uriPattern;
    }

    /** Set the URI that the route responds to. */
    public setUri(uri: string): this {
        const parsed = RouteUri.parse(uri);

        this.bindingFieldMap = parsed.bindingFields;
        this.uriPattern = parsed.uri;
        this.compiled = undefined;
        this.compiledParameterNames = undefined;

        return this;
    }

    /** Add a prefix to the route URI. */
    public prefix(prefix: string): this {
        this.updatePrefixOnAction(prefix);

        const uri = `${Str.rtrim(prefix, "/")}/${Str.ltrim(this.uriPattern, "/")}`;

        return this.setUri(uri !== "/" ? Str.trim(uri, "/") : uri);
    }

    /** Update the "prefix" attribute on the action array. */
    protected updatePrefixOnAction(prefix: string): void {
        const merged = Str.trim(
            `${Str.rtrim(prefix, "/")}/${Str.ltrim(this.action.prefix ?? "", "/")}`,
            "/",
        );

        if (merged !== "") {
            this.action.prefix = merged;
        }
    }

    /** Get the prefix of the route instance. */
    public getPrefix(): string | undefined {
        return this.action.prefix;
    }

    /** Get the name of the route instance. */
    public getName(): string | undefined {
        return this.action.as;
    }

    /** Add or change the route name. */
    public name(name: string): this {
        this.action.as =
            this.action.as !== undefined ? `${this.action.as}${name}` : name;

        return this;
    }

    /** Determine whether the route's name matches the given patterns. */
    public named(...patterns: Array<string>): boolean {
        const name = this.getName();

        if (name === undefined) {
            return false;
        }

        for (const pattern of patterns) {
            if (Str.is(pattern, name)) {
                return true;
            }
        }

        return false;
    }

    /** Set the handler for the route. */
    public uses(action: ActionAttributes["uses"]): this {
        return this.setAction({
            ...this.action,
            ...RouteAction.parse(this.uriPattern, action),
        });
    }

    /** Get the action name for the route. */
    public getActionName(): string {
        const controller = this.action.controller;

        if (controller === undefined) {
            return "Closure";
        }

        return `${tostring(controller[0])}@${controller[1]}`;
    }

    /** Get the method name of the route action. */
    public getActionMethod(): string {
        return this.isControllerAction()
            ? this.getControllerMethod()
            : "Closure";
    }

    /** Get the action array or one of its properties for the route. */
    public getAction(): ActionAttributes {
        return this.action;
    }

    /**
     * Set the action array for the route.
     *
     * The prefix is deliberately *not* re-applied: by the time a group merges
     * its attributes in, the router has already prefixed the URI, and the
     * `prefix` key is only what `getPrefix()` reports. PHP re-applies the
     * domain here, which has no counterpart.
     */
    public setAction(action: ActionAttributes): this {
        this.action = action;

        return this;
    }

    // -----------------------------------------------------------------
    // Middleware
    // -----------------------------------------------------------------

    /** Get all middleware, including the ones from the controller. */
    public gatherMiddleware(): Array<Pipe> {
        if (this.computedMiddleware !== undefined) {
            return this.computedMiddleware;
        }

        const gathered = new Array<Pipe>();

        for (const entry of this.middleware()) {
            gathered.push(entry);
        }

        for (const entry of this.controllerMiddleware()) {
            gathered.push(entry);
        }

        this.computedMiddleware = Route.uniqueMiddleware(gathered);

        return this.computedMiddleware;
    }

    /** Get or set the middlewares attached to the route. */
    public middleware(): Array<Pipe>;
    public middleware(middleware: Pipe | Array<Pipe>): this;
    public middleware(middleware?: Pipe | Array<Pipe>): this | Array<Pipe> {
        if (middleware === undefined) {
            return this.action.middleware ?? [];
        }

        const merged = table.clone(this.action.middleware ?? new Array<Pipe>());

        for (const entry of Util.arrayWrap(middleware) as Array<Pipe>) {
            merged.push(entry);
        }

        this.action.middleware = merged;

        return this;
    }

    /**
     * Get the middleware for the route's controller.
     *
     * PHP also reads a static `middleware()` off controllers implementing
     * `HasMiddleware`; that form needs the `Middleware` value object and is not
     * ported. The instance form, registered in the controller's constructor,
     * is.
     */
    public controllerMiddleware(): Array<Pipe> {
        if (!this.isControllerAction()) {
            return [];
        }

        const controller = this.getController() as
            { getMiddleware?: (receiver: object) => Array<Pipe> } | undefined;

        if (controller?.getMiddleware === undefined) {
            return [];
        }

        return controller.getMiddleware(controller);
    }

    /** Specify middleware that should be removed from the given route. */
    public withoutMiddleware(middleware: Pipe | Array<Pipe>): this {
        const merged = table.clone(
            this.action.excluded_middleware ?? new Array<Pipe>(),
        );

        for (const entry of Util.arrayWrap(middleware) as Array<Pipe>) {
            merged.push(entry);
        }

        this.action.excluded_middleware = merged;

        return this;
    }

    /** Get the middleware should be removed from the route. */
    public excludedMiddleware(): Array<Pipe> {
        return this.action.excluded_middleware ?? [];
    }

    /**
     * Take only the first occurrence of each middleware.
     *
     * PHP hangs this off `Router`; importing the router here would close a
     * cycle of value imports and take both modules down, so the router calls
     * this instead.
     */
    public static uniqueMiddleware(middleware: Array<Pipe>): Array<Pipe> {
        const seen = new Set<Pipe>();
        const unique = new Array<Pipe>();

        for (const entry of middleware) {
            if (seen.has(entry)) {
                continue;
            }

            seen.add(entry);
            unique.push(entry);
        }

        return unique;
    }

    // -----------------------------------------------------------------
    // Wiring
    // -----------------------------------------------------------------

    /** Set the router instance on the route. */
    public setRouter(router: Router): this {
        this.router = router;

        return this;
    }

    /** Set the container instance on the route. */
    public setContainer(container: ContainerContract): this {
        this.container = container;

        return this;
    }
}
