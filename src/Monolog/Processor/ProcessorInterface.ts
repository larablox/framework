import type { LogRecord } from "Monolog/LogRecord";

/**
 * PHP: `Monolog\Processor\ProcessorInterface`, whose instances are invoked
 * through `__invoke`. Luau has no callable objects, so a processor is either a
 * plain function or an object with a `process` method.
 */
export interface ProcessorInterface {
    process(record: LogRecord): LogRecord;
}

/** What `pushProcessor()` accepts. */
export type Processor = ProcessorInterface | ((record: LogRecord) => LogRecord);

/** Run a processor whichever shape it has. */
export function runProcessor(
    processor: Processor,
    record: LogRecord,
): LogRecord {
    if (typeIs(processor, "function")) {
        return (processor as (record: LogRecord) => LogRecord)(record);
    }

    return (processor as ProcessorInterface).process(record);
}
