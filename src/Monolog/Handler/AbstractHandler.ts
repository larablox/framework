import { Handler } from "Monolog/Handler/Handler";
import { Level } from "Monolog/Level";
import type { LogRecord } from "Monolog/LogRecord";

/** PHP: `Monolog\Handler\AbstractHandler`. */
export abstract class AbstractHandler extends Handler {
    public constructor(
        protected level: Level = Level.Debug,
        protected bubble = true,
    ) {
        super();
    }

    /** Checks whether the given record will be handled by this handler. */
    public isHandling(record: LogRecord): boolean {
        return record.level >= this.level;
    }

    /** Sets minimum logging level at which this handler will be triggered. */
    public setLevel(level: Level): this {
        this.level = level;

        return this;
    }

    /** Gets minimum logging level at which this handler will be triggered. */
    public getLevel(): Level {
        return this.level;
    }

    /** Sets the bubbling behavior. */
    public setBubble(bubble: boolean): this {
        this.bubble = bubble;

        return this;
    }

    /** Gets the bubbling behavior. */
    public getBubble(): boolean {
        return this.bubble;
    }

    /** Resets the handler's state. */
    public reset(): void {
        //
    }
}
