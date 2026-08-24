import type { LogRecord } from "Monolog/LogRecord";

/** PHP: `Monolog\Handler\HandlerInterface`. */
export interface HandlerInterface {
    /** Checks whether the given record will be handled by this handler. */
    isHandling(record: LogRecord): boolean;

    /** Handles a record. Returning true stops the bubbling chain. */
    handle(record: LogRecord): boolean;

    /** Handles a set of records at once. */
    handleBatch(records: Array<LogRecord>): void;

    /** Closes the handler. */
    close(): void;
}
