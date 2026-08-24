import { Level, Levels } from "Monolog/Level";
import { LogRecord } from "Monolog/LogRecord";
import { runProcessor } from "Monolog/Processor/ProcessorInterface";
import type { HandlerInterface } from "Monolog/Handler/HandlerInterface";
import type {
    LogContext,
    LogLevel,
    Logger as LoggerContract,
} from "Illuminate/Contracts/Log/Logger";
import type { Processor } from "Monolog/Processor/ProcessorInterface";
import type { RecordBag } from "Monolog/LogRecord";

/**
 * PHP: `Monolog\Logger`.
 *
 * Holds the handler stack and the processor stack, builds a `LogRecord` and
 * walks the handlers until one stops the bubbling chain.
 *
 * Not ported: timezones and microsecond timestamps (`os.time` is what a place
 * has), fibers and the logging-loop detection built on them, and the
 * serialization hooks.
 */
export class Logger implements LoggerContract {
    /** The handler stack. */
    protected handlers = new Array<HandlerInterface>();

    /** The processor stack. */
    protected processors = new Array<Processor>();

    public constructor(
        protected name: string,
        handlers: Array<HandlerInterface> = [],
        processors: Array<Processor> = [],
    ) {
        this.setHandlers(handlers);

        for (const processor of processors) {
            this.processors.push(processor);
        }
    }

    /** Get the logging channel name. */
    public getName(): string {
        return this.name;
    }

    /** Return a new cloned instance with the name changed. */
    public withName(name: string): Logger {
        return new Logger(name, this.handlers, this.processors);
    }

    /** Pushes a handler on to the stack. */
    public pushHandler(handler: HandlerInterface): this {
        this.handlers.unshift(handler);

        return this;
    }

    /** Pops a handler from the stack. */
    public popHandler(): HandlerInterface | undefined {
        return this.handlers.shift();
    }

    /** Set handlers, replacing all existing ones. */
    public setHandlers(handlers: Array<HandlerInterface>): this {
        this.handlers.clear();

        for (let index = handlers.size() - 1; index >= 0; index--) {
            this.pushHandler(handlers[index]);
        }

        return this;
    }

    /** Get the handler stack. */
    public getHandlers(): Array<HandlerInterface> {
        return this.handlers;
    }

    /** Adds a processor on to the stack. */
    public pushProcessor(processor: Processor): this {
        this.processors.unshift(processor);

        return this;
    }

    /** Removes the processor on top of the stack and returns it. */
    public popProcessor(): Processor | undefined {
        return this.processors.shift();
    }

    /** Get the processor stack. */
    public getProcessors(): Array<Processor> {
        return this.processors;
    }

    /** Adds a log record. */
    public addRecord(
        level: Level,
        message: string,
        context: RecordBag = {},
    ): boolean {
        let record = new LogRecord(
            os.time(),
            this.name,
            level,
            message,
            context,
            {},
        );
        let recordInitialized = this.processors.isEmpty();
        let handled = false;

        for (const handler of this.handlers) {
            if (!recordInitialized) {
                // Skip initializing the record as long as no handler will take it.
                if (!handler.isHandling(record)) {
                    continue;
                }

                for (const processor of this.processors) {
                    record = runProcessor(processor, record);
                }

                recordInitialized = true;
            }

            handled = true;

            if (handler.handle(record.clone()) === true) {
                break;
            }
        }

        return handled;
    }

    /** PHP: `Logger::toMonologLevel()`. Accepts a Level or a PSR level name. */
    public static toMonologLevel(level: Level | LogLevel): Level {
        return typeIs(level, "string")
            ? (Levels.fromName(level) ?? Level.Debug)
            : level;
    }

    /** Checks whether the Logger has a handler that listens on the given level. */
    public isHandling(level: Level | LogLevel): boolean {
        const record = new LogRecord(
            os.time(),
            this.name,
            Logger.toMonologLevel(level),
            "",
        );

        for (const handler of this.handlers) {
            if (handler.isHandling(record)) {
                return true;
            }
        }

        return false;
    }

    /** Ends a log cycle and frees all resources used by handlers. */
    public close(): void {
        for (const handler of this.handlers) {
            handler.close();
        }
    }

    public emergency(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Emergency, tostring(message), context ?? {});
    }

    public alert(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Alert, tostring(message), context ?? {});
    }

    public critical(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Critical, tostring(message), context ?? {});
    }

    public error(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Error, tostring(message), context ?? {});
    }

    public warning(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Warning, tostring(message), context ?? {});
    }

    public notice(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Notice, tostring(message), context ?? {});
    }

    public info(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Info, tostring(message), context ?? {});
    }

    public debug(message: unknown, context?: LogContext): void {
        this.addRecord(Level.Debug, tostring(message), context ?? {});
    }

    /** Logs with an arbitrary level, named as PSR does. */
    public log(level: LogLevel, message: unknown, context?: LogContext): void {
        this.addRecord(
            Logger.toMonologLevel(level),
            tostring(message),
            context ?? {},
        );
    }
}
