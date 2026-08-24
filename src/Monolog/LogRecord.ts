import { Level } from "Monolog/Level";

/** PHP: `array<mixed>` for context and extra. */
export type RecordBag = Record<string, unknown>;

/**
 * PHP: `Monolog\LogRecord`.
 *
 * `datetime` is a Unix timestamp rather than a `DateTimeImmutable`; there is no
 * date/time object on this platform. `ArrayAccess` is not ported.
 */
export class LogRecord {
    public constructor(
        public readonly datetime: number,
        public readonly channel: string,
        public readonly level: Level,
        public readonly message: string,
        public readonly context: RecordBag = {},
        public extra: RecordBag = {},
        public formatted?: string,
    ) {}

    /** PHP: `LogRecord::with()`. Returns a copy with the given fields replaced. */
    public with(changes: {
        datetime?: number;
        channel?: string;
        level?: Level;
        message?: string;
        context?: RecordBag;
        extra?: RecordBag;
    }): LogRecord {
        return new LogRecord(
            changes.datetime ?? this.datetime,
            changes.channel ?? this.channel,
            changes.level ?? this.level,
            changes.message ?? this.message,
            changes.context ?? this.context,
            changes.extra ?? this.extra,
            this.formatted,
        );
    }

    /** A shallow copy, as PHP's `clone` before handing a record to a handler. */
    public clone(): LogRecord {
        return new LogRecord(
            this.datetime,
            this.channel,
            this.level,
            this.message,
            this.context,
            this.extra,
            this.formatted,
        );
    }
}
