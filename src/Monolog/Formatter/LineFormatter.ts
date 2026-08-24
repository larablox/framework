import { Levels } from "Monolog/Level";
import type { FormatterInterface } from "Monolog/Formatter/FormatterInterface";
import type { LogRecord, RecordBag } from "Monolog/LogRecord";

/**
 * PHP: `Monolog\Formatter\LineFormatter`.
 *
 * The default format drops PHP's trailing newline -- `print` and `warn` add
 * their own. Context and extra are rendered by a small serializer instead of
 * `json_encode`, with keys sorted: a Luau table has no key order to preserve.
 */
export class LineFormatter implements FormatterInterface {
    public static readonly SIMPLE_FORMAT =
        "[%datetime%] %channel%.%level_name%: %message% %context% %extra%";

    public static readonly SIMPLE_DATE = "%Y-%m-%d %H:%M:%S";

    public constructor(
        protected readonly format_ = LineFormatter.SIMPLE_FORMAT,
        protected readonly dateFormat = LineFormatter.SIMPLE_DATE,
        protected readonly ignoreEmptyContextAndExtra = false,
    ) {}

    /** Formats a log record. */
    public format(record: LogRecord): string {
        let output = this.format_;

        const context =
            this.ignoreEmptyContextAndExtra && this.isEmpty(record.context)
                ? ""
                : this.stringify(record.context);
        const extra =
            this.ignoreEmptyContextAndExtra && this.isEmpty(record.extra)
                ? ""
                : this.stringify(record.extra);

        const replacements: Array<[string, string]> = [
            ["%datetime%", os.date(this.dateFormat, record.datetime) as string],
            ["%channel%", record.channel],
            ["%level_name%", Levels.getName(record.level)],
            ["%level%", tostring(record.level)],
            ["%message%", record.message],
            ["%context%", context],
            ["%extra%", extra],
        ];

        for (const [placeholder, value] of replacements) {
            output = output.split(placeholder).join(value);
        }

        return this.trimEnd(output);
    }

    /** Formats a set of log records. */
    public formatBatch(records: Array<LogRecord>): string {
        const lines = new Array<string>();

        for (const record of records) {
            lines.push(this.format(record));
        }

        return lines.join("\n");
    }

    /** Render a value the way `json_encode` would, with sorted keys. */
    public stringify(value: unknown): string {
        if (value === undefined) {
            return "null";
        }

        if (typeIs(value, "string")) {
            return `"${value}"`;
        }

        if (typeIs(value, "number") || typeIs(value, "boolean")) {
            return tostring(value);
        }

        if (!typeIs(value, "table")) {
            return `"${tostring(value)}"`;
        }

        const list = value as Array<unknown>;

        if (list.size() > 0) {
            const items = new Array<string>();

            for (const item of list) {
                items.push(this.stringify(item));
            }

            return `[${items.join(",")}]`;
        }

        const keys = new Array<string>();

        for (const [key] of pairs(value as RecordBag)) {
            keys.push(tostring(key));
        }

        if (keys.isEmpty()) {
            return "[]";
        }

        keys.sort();

        const pieces = new Array<string>();

        for (const key of keys) {
            pieces.push(
                `"${key}":${this.stringify((value as RecordBag)[key])}`,
            );
        }

        return `{${pieces.join(",")}}`;
    }

    /** Determine whether the given bag holds nothing. */
    protected isEmpty(bag: RecordBag): boolean {
        const [key] = next(bag);

        return key === undefined;
    }

    /** Drop the trailing separators left by empty placeholders. */
    protected trimEnd(value: string): string {
        const [trimmed] = value.gsub("%s+$", "");

        return trimmed;
    }
}
