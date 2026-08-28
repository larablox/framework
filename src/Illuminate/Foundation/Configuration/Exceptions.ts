import type { AbstractClass } from "Illuminate/Container/Types";
import type { Handler } from "Illuminate/Foundation/Exceptions/Handler";
import type { LogContext, LogLevel } from "Illuminate/Contracts/Log/Logger";
import type { ReportableHandler } from "Illuminate/Foundation/Exceptions/ReportableHandler";
import type { Request } from "Illuminate/Http/Request";
import type { Response } from "Illuminate/Http/Response";

/**
 * PHP: `Illuminate\Foundation\Configuration\Exceptions`.
 *
 * The object `withExceptions()` hands to `bootstrap/app.ts`. Every method
 * forwards to the handler, so what is missing here is missing there:
 * `throttle()` (no `Lottery`), `dontFlash()` (no session),
 * `shouldRenderJsonWhen()` (every response is data already), and the two
 * `RequestException` truncation switches, which trim an HTTP response body
 * before it goes into an exception message.
 *
 * `report()` and `render()` are dropped as well -- PHP keeps them beside
 * `reportable()` and `renderable()` as aliases of each other.
 */
export class Exceptions {
    /** Create a new exception handling configuration instance. */
    public constructor(public readonly handler: Handler) {}

    /** Register a reportable callback. */
    public reportable(reportUsing: (e: unknown) => unknown): ReportableHandler {
        return this.handler.reportable(reportUsing);
    }

    /** Register a renderable callback. */
    public renderable(renderUsing: (e: unknown, request: Request) => unknown): this {
        this.handler.renderable(renderUsing);

        return this;
    }

    /** Register a callback to prepare the final, rendered exception response. */
    public respond(using: (response: Response, e: unknown, request: Request) => Response): this {
        this.handler.respondUsing(using);

        return this;
    }

    /** Register a new exception mapping. */
    public map(from: AbstractClass, to: AbstractClass | ((e: unknown) => unknown)): this {
        this.handler.map(from, to);

        return this;
    }

    /** Set the log level for the given exception type. */
    public level(exceptionType: AbstractClass, level: LogLevel): this {
        this.handler.level(exceptionType, level);

        return this;
    }

    /** Register a closure that should be used to build exception context data. */
    public context(contextCallback: (e: unknown, context: LogContext) => LogContext): this {
        this.handler.buildContextUsing(contextCallback);

        return this;
    }

    /** Indicate that the given exception type should not be reported. */
    public dontReport(exceptions: AbstractClass | Array<AbstractClass>): this {
        this.handler.dontReport(exceptions);

        return this;
    }

    /** Register a callback to determine if an exception should not be reported. */
    public dontReportWhen(dontReportWhen: (e: unknown) => boolean): this {
        this.handler.dontReportWhen(dontReportWhen);

        return this;
    }

    /** Do not report duplicate exceptions. */
    public dontReportDuplicates(): this {
        this.handler.dontReportDuplicates();

        return this;
    }

    /** Indicate that the given exception class should not be ignored. */
    public stopIgnoring(exceptions: AbstractClass | Array<AbstractClass>): this {
        this.handler.stopIgnoring(exceptions);

        return this;
    }
}
