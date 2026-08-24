import type { LogRecord } from "Monolog/LogRecord";

/** PHP: `Monolog\Formatter\FormatterInterface`. */
export interface FormatterInterface {
    /** Formats a log record. */
    format(record: LogRecord): string;

    /** Formats a set of log records. */
    formatBatch(records: Array<LogRecord>): string;
}
