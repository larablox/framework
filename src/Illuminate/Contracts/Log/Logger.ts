/** PHP: the levels `Psr\Log\LogLevel` defines, in ascending severity. */
export type LogLevel =
    | "debug"
    | "info"
    | "notice"
    | "warning"
    | "error"
    | "critical"
    | "alert"
    | "emergency";

/** PHP: `array $context`. */
export type LogContext = Record<string, unknown>;

/**
 * PHP: `Psr\Log\LoggerInterface`.
 *
 * There is no PSR here, so the interface lives with the rest of the contracts.
 */
export interface Logger {
    /** System is unusable. */
    emergency(message: unknown, context?: LogContext): void;

    /** Action must be taken immediately. */
    alert(message: unknown, context?: LogContext): void;

    /** Critical conditions. */
    critical(message: unknown, context?: LogContext): void;

    /** Runtime errors that do not require immediate action. */
    error(message: unknown, context?: LogContext): void;

    /** Exceptional occurrences that are not errors. */
    warning(message: unknown, context?: LogContext): void;

    /** Normal but significant events. */
    notice(message: unknown, context?: LogContext): void;

    /** Interesting events. */
    info(message: unknown, context?: LogContext): void;

    /** Detailed debug information. */
    debug(message: unknown, context?: LogContext): void;

    /** Logs with an arbitrary level. */
    log(level: LogLevel, message: unknown, context?: LogContext): void;
}

/** The severity order the level filters compare against. */
export const LOG_LEVELS: Array<LogLevel> = [
    "debug",
    "info",
    "notice",
    "warning",
    "error",
    "critical",
    "alert",
    "emergency",
];

/** The numeric severity of a level, for `isHandling` comparisons. */
export function levelSeverity(level: LogLevel): number {
    return LOG_LEVELS.indexOf(level);
}
