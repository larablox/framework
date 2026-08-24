import { Handler } from "Monolog/Handler/Handler";
import { Level } from "Monolog/Level";
import type { LogRecord } from "Monolog/LogRecord";

/** PHP: `Monolog\Handler\NullHandler`. Swallows everything at or above the level. */
export class NullHandler extends Handler {
    public constructor(protected readonly level: Level = Level.Debug) {
        super();
    }

    public isHandling(record: LogRecord): boolean {
        return record.level >= this.level;
    }

    public handle(record: LogRecord): boolean {
        return record.level >= this.level;
    }
}
