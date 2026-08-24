import { Handler } from "Monolog/Handler/Handler";
import { runProcessor } from "Monolog/Processor/ProcessorInterface";
import type { HandlerInterface } from "Monolog/Handler/HandlerInterface";
import type { LogRecord } from "Monolog/LogRecord";
import type { Processor } from "Monolog/Processor/ProcessorInterface";

/** PHP: `Monolog\Handler\GroupHandler`. Forwards records to every handler. */
export class GroupHandler extends Handler {
    protected processors = new Array<Processor>();

    public constructor(
        protected readonly handlers: Array<HandlerInterface>,
        protected readonly bubble = true,
    ) {
        super();
    }

    public isHandling(record: LogRecord): boolean {
        for (const handler of this.handlers) {
            if (handler.isHandling(record)) {
                return true;
            }
        }

        return false;
    }

    public handle(record: LogRecord): boolean {
        let processed = record;

        if (!this.processors.isEmpty()) {
            processed = this.processRecord(processed);
        }

        for (const handler of this.handlers) {
            handler.handle(processed.clone());
        }

        return this.bubble === false;
    }

    /** Adds a processor in the stack. */
    public pushProcessor(processor: Processor): this {
        this.processors.unshift(processor);

        return this;
    }

    /** Processes a record. */
    protected processRecord(record: LogRecord): LogRecord {
        let processed = record;

        for (const processor of this.processors) {
            processed = runProcessor(processor, processed);
        }

        return processed;
    }

    /** Closes every handler in the group. */
    public close(): void {
        for (const handler of this.handlers) {
            handler.close();
        }
    }
}
