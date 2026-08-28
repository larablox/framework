import { Arr } from 'Illuminate/Support/Arr';
import { Exception } from 'Illuminate/Exception';
import { HttpException } from 'Illuminate/Http/Exceptions/HttpException';
import { HttpResponseException } from 'Illuminate/Http/Exceptions/HttpResponseException';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { Reflector } from 'Illuminate/Support/Reflector';
import { ReportableHandler } from 'Illuminate/Foundation/Exceptions/ReportableHandler';
import { Response } from 'Illuminate/Http/Response';
import { isResponsable } from 'Illuminate/Contracts/Support/Responsable';
import { tap } from 'Illuminate/Support/Helpers';
import type { AbstractClass } from 'Illuminate/Container/Types';
import type { Repository as ConfigRepository } from 'Illuminate/Contracts/Config/Repository';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { ExceptionHandler } from 'Illuminate/Contracts/Debug/ExceptionHandler';
import type { LogContext, LogLevel } from 'Illuminate/Contracts/Log/Logger';
import type { LogManager } from 'Illuminate/Log/LogManager';
import type { Request } from 'Illuminate/Http/Request';

/** PHP: the closure `renderable()` registers. */
type RenderCallback = (e: unknown, request: Request) => unknown;

/** PHP: the closure `buildContextUsing()` registers. */
type ContextCallback = (e: unknown, context: LogContext) => LogContext;

/** PHP: the closure `respondUsing()` registers. */
type FinalizeCallback = (response: Response, e: unknown, request: Request) => Response;

/**
 * PHP: `Illuminate\Foundation\Exceptions\Handler`.
 *
 * Two things shape the port. The first is that a callback's parameter types are
 * erased, so PHP's trick of picking the callbacks that type-hint the thrown
 * class cannot be repeated: `reportable()`, `renderable()` and the context
 * callbacks are offered every exception and narrow for themselves, and `map()`
 * takes the class it maps from as an argument rather than reading it off the
 * closure.
 *
 * The second is that there is no browser. PHP decides between an HTML page and
 * a JSON body (`shouldReturnJson()`, `prepareResponse()`, `renderHttpException()`
 * and the error views); a remote carries a value, so that fork collapses into
 * the one branch PHP takes for an API request.
 *
 * Also not ported: throttling of reports (`throttle()`, `throttleUsing()`) --
 * it wants `Lottery`, which is not ported; `dontFlash()` (no session);
 * `unauthenticated()` and `convertValidationExceptionToResponse()` (no `Auth`,
 * no `Validation` yet); the `ShouldntReport` marker, which is an interface and
 * so has nothing to check at runtime; and `renderForConsole()`.
 */
export class Handler implements ExceptionHandler {
    /**
     * A list of the exception types that are not reported.
     *
     * PHP calls it `$dontReport` and has a `dontReport()` method beside it; a
     * class table holds one value per key, so the property is renamed -- the
     * same trade `Pipeline::$pipes` makes.
     */
    protected dontReportTypes = new Array<AbstractClass>();

    /** The callbacks that inspect exceptions to determine if they should be reported. */
    protected dontReportCallbacks = new Array<(e: unknown) => boolean>();

    /** The callbacks that should be used during reporting. */
    protected reportCallbacks = new Array<ReportableHandler>();

    /** A map of exceptions with their corresponding custom log levels. */
    protected levels = new Array<[AbstractClass, LogLevel]>();

    /** The callbacks that should be used to build exception context data. */
    protected contextCallbacks = new Array<ContextCallback>();

    /** The exception currently being reported. */
    protected currentlyReporting?: unknown;

    /** The callbacks that should be used during rendering. */
    protected renderCallbacks = new Array<RenderCallback>();

    /** The callback that prepares responses to be returned to the caller. */
    protected finalizeResponseCallback?: FinalizeCallback;

    /** The registered exception mappings. */
    protected exceptionMap = new Array<[AbstractClass, (e: unknown) => unknown]>();

    /**
     * A list of the internal exception types that should not be reported.
     *
     * PHP's list is longer only because it has more to list: the authentication,
     * authorisation, validation and model exceptions are not ported yet.
     */
    protected internalDontReport: Array<AbstractClass> = [HttpException, HttpResponseException];

    /** Indicates that an exception instance should only be reported once. */
    protected withoutDuplicates = false;

    /**
     * The already reported exception map.
     *
     * PHP uses a `WeakMap` so an entry dies with the exception it keys. The
     * `__mode` metafield is Luau's version of the same thing, and a compiled
     * `Map` is a plain table, so it can carry one.
     */
    protected reportedExceptionMap = setmetatable(new Map<object, boolean>(), {
        __mode: 'k',
    });

    /** Create a new exception handler instance. */
    public constructor(@Inject('app') protected readonly container: Container) {
        this.register();
    }

    /** Register the exception handling callbacks for the application. */
    public register(): void {
        //
    }

    /** Register a reportable callback. */
    public reportable(reportUsing: (e: unknown) => unknown): ReportableHandler {
        return tap(new ReportableHandler(reportUsing), (callback) => {
            this.reportCallbacks.push(callback);
        });
    }

    /** Register a renderable callback. */
    public renderable(renderUsing: RenderCallback): this {
        this.renderCallbacks.push(renderUsing);

        return this;
    }

    /**
     * Register a new exception mapping.
     *
     * PHP allows the mapping to be written as a single closure and reads the
     * class it maps from off the closure's parameter; here it is always both
     * arguments. A class as the second argument is constructed the way PHP
     * constructs it: `new $to('', 0, $exception)`.
     */
    public map(from: AbstractClass, to: AbstractClass | ((e: unknown) => unknown)): this {
        const mapper = typeIs(to, 'function')
            ? (to as (e: unknown) => unknown)
            : (e: unknown) =>
                  new (to as unknown as new (message: string, code: number, previous: unknown) => object)('', 0, e);

        this.exceptionMap.push([from, mapper]);

        return this;
    }

    /** Indicate that the given exception type should not be reported. */
    public dontReport(exceptions: AbstractClass | Array<AbstractClass>): this {
        return this.ignore(exceptions);
    }

    /** Register a callback to determine if an exception should not be reported. */
    public dontReportWhen(dontReportWhen: (e: unknown) => boolean): this {
        this.dontReportCallbacks.push(dontReportWhen);

        return this;
    }

    /** Indicate that the given exception type should not be reported. */
    public ignore(exceptions: AbstractClass | Array<AbstractClass>): this {
        for (const exception of Arr.wrap(exceptions)) {
            if (!this.dontReportTypes.includes(exception)) {
                this.dontReportTypes.push(exception);
            }
        }

        return this;
    }

    /** Remove the given exception class from the list of exceptions that should be ignored. */
    public stopIgnoring(exceptions: AbstractClass | Array<AbstractClass>): this {
        for (const exception of Arr.wrap(exceptions)) {
            this.dontReportTypes = this.without(this.dontReportTypes, exception);
            this.internalDontReport = this.without(this.internalDontReport, exception);
        }

        return this;
    }

    /** Set the log level for the given exception type. */
    public level(exceptionType: AbstractClass, level: LogLevel): this {
        this.levels.push([exceptionType, level]);

        return this;
    }

    /** Do not report duplicate exceptions. */
    public dontReportDuplicates(): this {
        this.withoutDuplicates = true;

        return this;
    }

    // -----------------------------------------------------------------
    // Reporting
    // -----------------------------------------------------------------

    /** Report or log an exception. */
    public report(e: unknown): void {
        const mapped = this.mapException(e);

        if (this.shouldntReport(mapped)) {
            return;
        }

        this.reportThrowable(mapped);
    }

    /** Report the exception through its own reporter, a callback, or the log. */
    protected reportThrowable(e: unknown): void {
        if (typeIs(e, 'table')) {
            this.reportedExceptionMap.set(e as object, true);
        }

        // PHP: `Reflector::isCallable([$e, 'report'])` -- an exception that
        // knows how to report itself. The container makes the call so that the
        // method's own dependencies are resolved.
        if (this.hasMethod(e, 'report') && this.container.call([e as object, 'report']) !== false) {
            return;
        }

        for (const reportCallback of this.reportCallbacks) {
            if (reportCallback.invoke(e) === false) {
                return;
            }
        }

        const logger = this.newLogger();
        const level = this.mapLogLevel(e);
        const originallyReporting = this.currentlyReporting;

        this.currentlyReporting = e;

        try {
            // PHP calls the method named by the level when the logger has one;
            // `LogManager::log()` reaches the same writer with one less branch.
            logger.log(level, this.message(e), this.buildExceptionContext(e));
        } finally {
            this.currentlyReporting = originallyReporting;
        }
    }

    /** Determine if a given exception is being reported. */
    public isReporting(e: unknown): boolean {
        return this.currentlyReporting === e;
    }

    /** Determine if the exception should be reported. */
    public shouldReport(e: unknown): boolean {
        return !this.shouldntReport(e);
    }

    /** Determine if the exception is in the "do not report" list. */
    protected shouldntReport(e: unknown): boolean {
        if (this.withoutDuplicates && typeIs(e, 'table') && this.reportedExceptionMap.get(e as object) === true) {
            return true;
        }

        for (const exceptionType of this.dontReportTypes) {
            if (Reflector.isInstanceOf(e, exceptionType)) {
                return true;
            }
        }

        for (const exceptionType of this.internalDontReport) {
            if (Reflector.isInstanceOf(e, exceptionType)) {
                return true;
            }
        }

        for (const dontReportCallback of this.dontReportCallbacks) {
            if (dontReportCallback(e) === true) {
                return true;
            }
        }

        return false;
    }

    /** Create the context for logging the given exception. */
    protected buildExceptionContext(e: unknown): LogContext {
        const context: LogContext = {};

        for (const [key, value] of pairs(this.buildContextForException(e))) {
            context[key as string] = value;
        }

        for (const [key, value] of pairs(this.context())) {
            context[key as string] = value;
        }

        context.exception = e;

        return context;
    }

    /** Creates the context for an exception. */
    public buildContextForException(e: unknown): LogContext {
        return this.exceptionContext(e);
    }

    /** Get the default exception context variables for logging. */
    protected exceptionContext(e: unknown): LogContext {
        let context: LogContext = {};

        if (this.hasMethod(e, 'context')) {
            context = (this.callMethod(e, 'context') ?? {}) as LogContext;
        }

        for (const callback of this.contextCallbacks) {
            for (const [key, value] of pairs(callback(e, context))) {
                context[key as string] = value;
            }
        }

        return context;
    }

    /**
     * Get the default context variables for logging.
     *
     * PHP puts `Auth::id()` here. There is no `Auth` yet, and the request names
     * the caller the engine reported, which is what `Auth::id()` will read once
     * there is one.
     */
    protected context(): LogContext {
        if (!this.container.bound('request')) {
            return {};
        }

        const [ok, player] = pcall(() => this.container.make<Request>('request').player().UserId);

        return ok ? { userId: player } : {};
    }

    /** Register a closure that should be used to build exception context data. */
    public buildContextUsing(contextCallback: ContextCallback): this {
        this.contextCallbacks.push(contextCallback);

        return this;
    }

    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------

    /**
     * Render an exception into a response.
     *
     * PHP passes what an exception's own `render()` returns through
     * `Router::toResponse()`; importing the router here would close the cycle
     * `Router -> Routing\Pipeline -> Handler -> Router`, so `render()` -- like
     * the `renderable()` callbacks, which PHP does not convert either -- has to
     * hand back a `Response` itself.
     */
    public render(request: Request, e: unknown): Response {
        let exception = this.mapException(e);

        if (this.hasMethod(exception, 'render')) {
            // PHP calls this one straight, handing it the request -- only
            // `report()` goes through the container.
            const response = this.callMethod(exception, 'render', request);

            if (response !== undefined) {
                return this.finalizeRenderedResponse(request, response as Response, exception);
            }
        }

        if (isResponsable(exception)) {
            return this.finalizeRenderedResponse(request, exception.toResponse(request) as Response, exception);
        }

        exception = this.prepareException(exception);

        const rendered = this.renderViaCallbacks(request, exception);

        if (rendered !== undefined) {
            return this.finalizeRenderedResponse(request, rendered as Response, exception);
        }

        if (exception instanceof HttpResponseException) {
            return this.finalizeRenderedResponse(request, exception.getResponse(), exception);
        }

        return this.finalizeRenderedResponse(request, this.renderExceptionResponse(request, exception), exception);
    }

    /** Prepare the final, rendered response to be returned to the caller. */
    protected finalizeRenderedResponse(request: Request, response: Response, e: unknown): Response {
        return this.finalizeResponseCallback !== undefined
            ? this.finalizeResponseCallback(response, e, request)
            : response;
    }

    /** Prepare the final, rendered response for an exception using the given callback. */
    public respondUsing(callback: FinalizeCallback): this {
        this.finalizeResponseCallback = callback;

        return this;
    }

    /**
     * Prepare exception for rendering.
     *
     * Nothing maps yet: PHP turns the model, authorisation, token and record
     * exceptions into HTTP ones, and none of those components are ported. The
     * hook stays because that is where they will land.
     */
    protected prepareException(e: unknown): unknown {
        return e;
    }

    /** Map the exception using a registered mapper if possible. */
    protected mapException(e: unknown): unknown {
        for (const [from, mapper] of this.exceptionMap) {
            if (Reflector.isInstanceOf(e, from)) {
                return mapper(e);
            }
        }

        return e;
    }

    /** Try to render a response from request and exception via render callbacks. */
    protected renderViaCallbacks(request: Request, e: unknown): unknown {
        for (const renderCallback of this.renderCallbacks) {
            const response = renderCallback(e, request);

            if (response !== undefined) {
                return response;
            }
        }

        return undefined;
    }

    /**
     * Render a default exception response.
     *
     * PHP asks `shouldReturnJson()` and renders an HTML page when the answer is
     * no. Every response here is a value on a remote, so the answer is always
     * yes and the other branch has nothing to render with.
     */
    protected renderExceptionResponse(request: Request, e: unknown): Response {
        return this.prepareJsonResponse(request, e);
    }

    /** Prepare a response of exception data for the given exception. */
    protected prepareJsonResponse(request: Request, e: unknown): Response {
        return new Response(
            this.convertExceptionToArray(e),
            this.isHttpException(e) ? (e as HttpException).getStatusCode() : Response.HTTP_INTERNAL_SERVER_ERROR,
            this.isHttpException(e) ? (e as HttpException).getHeaders() : undefined,
        );
    }

    /**
     * Convert the given exception to a table.
     *
     * PHP adds the file, the line and the trace in debug mode. A caught value
     * carries none of those -- `error()` throws a value, not a stack -- so what
     * is left is the message and the class.
     */
    protected convertExceptionToArray(e: unknown): Record<string, unknown> {
        if (!this.debug()) {
            return {
                message: this.isHttpException(e) ? this.message(e) : 'Server Error',
            };
        }

        return {
            message: this.message(e),
            exception: typeIs(e, 'table') ? Reflector.className(Reflector.classOf(e as object)) : typeOf(e),
        };
    }

    /** Determine if the given exception is an HTTP exception. */
    protected isHttpException(e: unknown): boolean {
        return e instanceof HttpException;
    }

    /** Map the exception to a log level. */
    protected mapLogLevel(e: unknown): LogLevel {
        for (const [exceptionType, level] of this.levels) {
            if (Reflector.isInstanceOf(e, exceptionType)) {
                return level;
            }
        }

        return 'error';
    }

    /** Create a new logger instance. */
    protected newLogger(): LogManager {
        return this.container.make<LogManager>('log');
    }

    // -----------------------------------------------------------------
    // Platform helpers
    // -----------------------------------------------------------------

    /**
     * The message the exception carries.
     *
     * PHP is handed a `Throwable` and asks for `getMessage()`. Luau's `error()`
     * takes any value at all, so a bare string is as likely as an exception.
     */
    protected message(e: unknown): string {
        return e instanceof Exception ? e.getMessage() : tostring(e);
    }

    /** PHP: `method_exists($e, $method)`. */
    protected hasMethod(e: unknown, method: string): boolean {
        return typeIs(e, 'table') && typeIs((e as Record<string, unknown>)[method], 'function');
    }

    /** PHP: `$e->{$method}(...$arguments)`, on a value with no type to call it through. */
    protected callMethod(e: unknown, method: string, ...args: Array<unknown>): unknown {
        const callback = (e as Record<string, unknown>)[method] as (self: object, ...rest: Array<unknown>) => unknown;

        return callback(e as object, ...args);
    }

    /** PHP: `config('app.debug')`, which has no helper here. */
    protected debug(): boolean {
        return this.container.make<ConfigRepository>('config').get('app.debug', false) === true;
    }

    /** The list without the given entry. */
    protected without(list: Array<AbstractClass>, entry: AbstractClass): Array<AbstractClass> {
        const kept = new Array<AbstractClass>();

        for (const candidate of list) {
            if (candidate !== entry) {
                kept.push(candidate);
            }
        }

        return kept;
    }
}
