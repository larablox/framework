import type { Request } from 'Illuminate/Http/Request';
import type { Response } from 'Illuminate/Http/Response';

/**
 * PHP: `Illuminate\Contracts\Debug\ExceptionHandler`.
 *
 * `renderForConsole()` is not here: there is no console to render to.
 *
 * PHP types every argument `Throwable`. Luau's `error()` takes any value, so a
 * caught value is `unknown` until something narrows it -- which is exactly what
 * the handler spends its time doing.
 */
export interface ExceptionHandler
{
    /** Report or log an exception. */
    report(e: unknown): void;

    /** Determine if the exception should be reported. */
    shouldReport(e: unknown): boolean;

    /** Render an exception into a response. */
    render(request: Request, e: unknown): Response;
}
