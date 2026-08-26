import type { LogLevel } from "@larablox/monolog/out/Monolog/LoggerInterface";

/**
 * PHP: `Psr\Log\LoggerInterface`.
 *
 * There is no PSR here, and Monolog (which upstream implements this from the
 * separate `psr/log` package) is where the implementing class actually lives
 * in this port -- so the shape is defined there (`Monolog/LoggerInterface`)
 * and re-exported under the name Laravel's own contracts use.
 */
export type {
    LogContext,
    LogLevel,
    LoggerInterface as Logger,
} from "@larablox/monolog/out/Monolog/LoggerInterface";

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
