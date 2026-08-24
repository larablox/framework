import type { LogRecord, RecordBag } from "Monolog/LogRecord";
import type { ProcessorInterface } from "Monolog/Processor/ProcessorInterface";

/**
 * PHP: `Monolog\Processor\PsrLogMessageProcessor`.
 *
 * Replaces `{placeholder}` in the message with the matching context value.
 */
export class PsrLogMessageProcessor implements ProcessorInterface {
    public constructor(protected readonly removeUsedContextFields = false) {}

    public process(record: LogRecord): LogRecord {
        if (record.message.find("{", 1, true)[0] === undefined) {
            return record;
        }

        let message = record.message;
        const context: RecordBag = {};

        for (const [key, value] of pairs(record.context)) {
            context[key as string] = value;
        }

        for (const [key, value] of pairs(record.context)) {
            const placeholder = `{${key}}`;

            if (message.find(placeholder, 1, true)[0] === undefined) {
                continue;
            }

            message = message.split(placeholder).join(tostring(value));

            if (this.removeUsedContextFields) {
                delete context[key as string];
            }
        }

        return record.with({ message, context });
    }
}
