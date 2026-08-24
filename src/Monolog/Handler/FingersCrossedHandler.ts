import { Handler } from "Monolog/Handler/Handler";
import { Level } from "Monolog/Level";
import type { HandlerInterface } from "Monolog/Handler/HandlerInterface";
import type { LogRecord } from "Monolog/LogRecord";

/**
 * PHP: `Monolog\Handler\FingersCrossedHandler`.
 *
 * Buffers everything until a record reaches the action level, then flushes the
 * buffer to the wrapped handler and passes everything through from then on.
 * `LogManager` wraps a channel in this when `action_level` is configured.
 */
export class FingersCrossedHandler extends Handler {
    protected buffer = new Array<LogRecord>();

    protected buffering = true;

    public constructor(
        protected readonly handler: HandlerInterface,
        protected readonly actionLevel: Level = Level.Warning,
        protected readonly bufferSize = 0,
        protected readonly bubble = true,
        protected readonly stopBuffering = true,
    ) {
        super();
    }

    public isHandling(): boolean {
        return true;
    }

    public handle(record: LogRecord): boolean {
        if (this.buffering) {
            this.buffer.push(record);

            if (this.bufferSize > 0 && this.buffer.size() > this.bufferSize) {
                this.buffer.shift();
            }

            if (record.level >= this.actionLevel) {
                this.activate();
            }
        } else {
            this.handler.handle(record);
        }

        return this.bubble === false;
    }

    /** Flush the buffer into the wrapped handler. */
    public activate(): void {
        if (this.stopBuffering) {
            this.buffering = false;
        }

        this.handler.handleBatch(this.buffer);
        this.buffer.clear();
    }

    /** Clears the buffer without flushing it. */
    public clear(): void {
        this.buffer.clear();
        this.buffering = true;
    }

    public close(): void {
        this.handler.close();
    }
}
