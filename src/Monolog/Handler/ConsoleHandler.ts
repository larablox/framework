import { AbstractProcessingHandler } from "Monolog/Handler/AbstractProcessingHandler";
import { Level } from "Monolog/Level";
import type { LogRecord } from "Monolog/LogRecord";

/**
 * Writes records to the Roblox output.
 *
 * The stand-in for `StreamHandler` and `ErrorLogHandler`: a place has no
 * filesystem and no syslog, and the output window is the only sink the platform
 * offers. `Warning` and above go through `warn`, so they are highlighted and
 * carry a traceback; the rest go through `print`.
 */
export class ConsoleHandler extends AbstractProcessingHandler {
    public constructor(level: Level = Level.Debug, bubble = true) {
        super(level, bubble);
    }

    /** Writes the record down to the Roblox output. */
    protected write(record: LogRecord): void {
        const line = record.formatted ?? record.message;

        if (record.level >= Level.Warning) {
            warn(line);
        } else {
            print(line);
        }
    }
}
