import { MessageLogged } from "Illuminate/Log/Events/MessageLogged";
import { RuntimeException } from "Illuminate/Exception";
import { Util } from "Illuminate/Container/Util";
import type {
    LogContext,
    LogLevel,
    Logger as LoggerContract,
} from "Illuminate/Contracts/Log/Logger";
import type { Dispatcher } from "Illuminate/Contracts/Events/Dispatcher";

/**
 * PHP: `Illuminate\Log\Logger`.
 *
 * Wraps the channel's underlying logger, merges the channel context into every
 * record and fires `MessageLogged` so listeners can aggregate.
 *
 * `__call` forwarding to the underlying logger is not ported -- Luau has no
 * `__call` on objects.
 */
export class Logger implements LoggerContract {
    /** Any context to be added to logs. */
    protected context: LogContext = {};

    /** Create a new log writer instance. */
    public constructor(
        protected readonly logger: LoggerContract,
        protected dispatcher?: Dispatcher,
    ) {}

    /** Log an emergency message to the logs. */
    public emergency(message: unknown, context?: LogContext): void {
        this.writeLog("emergency", message, context);
    }

    /** Log an alert message to the logs. */
    public alert(message: unknown, context?: LogContext): void {
        this.writeLog("alert", message, context);
    }

    /** Log a critical message to the logs. */
    public critical(message: unknown, context?: LogContext): void {
        this.writeLog("critical", message, context);
    }

    /** Log an error message to the logs. */
    public error(message: unknown, context?: LogContext): void {
        this.writeLog("error", message, context);
    }

    /** Log a warning message to the logs. */
    public warning(message: unknown, context?: LogContext): void {
        this.writeLog("warning", message, context);
    }

    /** Log a notice to the logs. */
    public notice(message: unknown, context?: LogContext): void {
        this.writeLog("notice", message, context);
    }

    /** Log an informational message to the logs. */
    public info(message: unknown, context?: LogContext): void {
        this.writeLog("info", message, context);
    }

    /** Log a debug message to the logs. */
    public debug(message: unknown, context?: LogContext): void {
        this.writeLog("debug", message, context);
    }

    /** Log a message to the logs. */
    public log(level: LogLevel, message: unknown, context?: LogContext): void {
        this.writeLog(level, message, context);
    }

    /** Dynamically pass log calls into the writer. */
    public write(
        level: LogLevel,
        message: unknown,
        context?: LogContext,
    ): void {
        this.writeLog(level, message, context);
    }

    /** Write a message to the log. */
    protected writeLog(
        level: LogLevel,
        message: unknown,
        context?: LogContext,
    ): void {
        const handler = this.logger as unknown as {
            isHandling?: (self: unknown, level: LogLevel) => boolean;
        };

        if (
            typeIs(handler.isHandling, "function") &&
            !handler.isHandling(this.logger, level)
        ) {
            return;
        }

        const formatted = this.formatMessage(message);
        const merged = this.mergeContext(context);

        this.logger.log(level, formatted, merged);

        this.fireLogEvent(level, formatted, merged);
    }

    /** Add context to all future logs. */
    public withContext(context: LogContext = {}): this {
        for (const [key, value] of pairs(context)) {
            this.context[key as string] = value;
        }

        return this;
    }

    /** Flush the existing context array. */
    public withoutContext(keys?: Array<string>): this {
        if (keys === undefined) {
            this.context = {};

            return this;
        }

        for (const key of keys) {
            delete this.context[key];
        }

        return this;
    }

    /** Register a new callback handler for when a log event is triggered. */
    public listen(callback: Callback): void {
        if (this.dispatcher === undefined) {
            throw new RuntimeException("Events dispatcher has not been set.");
        }

        this.dispatcher.listen(MessageLogged, callback);
    }

    /** Fires a log event. */
    protected fireLogEvent(
        level: LogLevel,
        message: string,
        context: LogContext,
    ): void {
        this.dispatcher?.dispatch(new MessageLogged(level, message, context));
    }

    /** Format the parameters for the logger. */
    protected formatMessage(message: unknown): string {
        if (typeIs(message, "string")) {
            return message;
        }

        if (Util.isArray(message)) {
            const parts = new Array<string>();

            for (const value of message as Array<defined>) {
                parts.push(tostring(value));
            }

            return `[${parts.join(", ")}]`;
        }

        return tostring(message);
    }

    /** Merge the channel context into the record's own. */
    protected mergeContext(context?: LogContext): LogContext {
        const merged: LogContext = {};

        for (const [key, value] of pairs(this.context)) {
            merged[key as string] = value;
        }

        if (context !== undefined) {
            for (const [key, value] of pairs(context)) {
                merged[key as string] = value;
            }
        }

        return merged;
    }

    /** Get the underlying logger implementation. */
    public getLogger(): LoggerContract {
        return this.logger;
    }

    /** Get the event dispatcher instance. */
    public getEventDispatcher(): Dispatcher | undefined {
        return this.dispatcher;
    }

    /** Set the event dispatcher instance. */
    public setEventDispatcher(dispatcher: Dispatcher): void {
        this.dispatcher = dispatcher;
    }
}
