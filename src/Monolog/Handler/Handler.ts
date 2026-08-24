import type { HandlerInterface } from "Monolog/Handler/HandlerInterface";
import type { LogRecord } from "Monolog/LogRecord";

/**
 * PHP: `Monolog\Handler\Handler`.
 *
 * `__destruct` and `__serialize` are not ported: Luau has neither.
 */
export abstract class Handler implements HandlerInterface {
    public abstract isHandling(record: LogRecord): boolean;

    public abstract handle(record: LogRecord): boolean;

    /** Handles a set of records at once. */
    public handleBatch(records: Array<LogRecord>): void {
        for (const record of records) {
            this.handle(record);
        }
    }

    /** Closes the handler. */
    public close(): void {
        //
    }
}
