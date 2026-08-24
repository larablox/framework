import { AbstractHandler } from "Monolog/Handler/AbstractHandler";
import { LineFormatter } from "Monolog/Formatter/LineFormatter";
import { runProcessor } from "Monolog/Processor/ProcessorInterface";
import type { FormatterInterface } from "Monolog/Formatter/FormatterInterface";
import type { LogRecord } from "Monolog/LogRecord";
import type { Processor } from "Monolog/Processor/ProcessorInterface";

/**
 * PHP: `Monolog\Handler\AbstractProcessingHandler`, which folds in
 * `ProcessableHandlerTrait` and `FormattableHandlerTrait`.
 */
export abstract class AbstractProcessingHandler extends AbstractHandler {
    protected processors = new Array<Processor>();

    protected formatter?: FormatterInterface;

    /** Handles a record. */
    public handle(record: LogRecord): boolean {
        if (!this.isHandling(record)) {
            return false;
        }

        let processed = record;

        if (!this.processors.isEmpty()) {
            processed = this.processRecord(processed);
        }

        processed.formatted = this.getFormatter().format(processed);

        this.write(processed);

        return this.bubble === false;
    }

    /** Writes the record down to the log of the implementing handler. */
    protected abstract write(record: LogRecord): void;

    /** Adds a processor in the stack. */
    public pushProcessor(processor: Processor): this {
        this.processors.unshift(processor);

        return this;
    }

    /** Removes the processor on top of the stack and returns it. */
    public popProcessor(): Processor | undefined {
        return this.processors.shift();
    }

    /** Processes a record. */
    protected processRecord(record: LogRecord): LogRecord {
        let processed = record;

        for (const processor of this.processors) {
            processed = runProcessor(processor, processed);
        }

        return processed;
    }

    /** Sets the formatter. */
    public setFormatter(formatter: FormatterInterface): this {
        this.formatter = formatter;

        return this;
    }

    /** Gets the formatter, building the default one on first use. */
    public getFormatter(): FormatterInterface {
        if (this.formatter === undefined) {
            this.formatter = this.getDefaultFormatter();
        }

        return this.formatter;
    }

    /** Gets the default formatter. */
    protected getDefaultFormatter(): FormatterInterface {
        return new LineFormatter();
    }
}
