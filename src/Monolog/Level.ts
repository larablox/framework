/**
 * PHP: `Monolog\Level`, a backed enum.
 *
 * TypeScript enums carry no statics and roblox-ts does not merge namespaces, so
 * `Level::fromName()` and friends live on `Levels` beside the enum.
 */
export enum Level {
    Debug = 100,
    Info = 200,
    Notice = 250,
    Warning = 300,
    Error = 400,
    Critical = 500,
    Alert = 550,
    Emergency = 600,
}

const BY_NAME = new Map<string, Level>([
    ["debug", Level.Debug],
    ["info", Level.Info],
    ["notice", Level.Notice],
    ["warning", Level.Warning],
    ["error", Level.Error],
    ["critical", Level.Critical],
    ["alert", Level.Alert],
    ["emergency", Level.Emergency],
]);

const BY_VALUE = new Map<Level, string>([
    [Level.Debug, "DEBUG"],
    [Level.Info, "INFO"],
    [Level.Notice, "NOTICE"],
    [Level.Warning, "WARNING"],
    [Level.Error, "ERROR"],
    [Level.Critical, "CRITICAL"],
    [Level.Alert, "ALERT"],
    [Level.Emergency, "EMERGENCY"],
]);

export class Levels {
    /** PHP: `Level::fromName()`. */
    public static fromName(name: string): Level | undefined {
        return BY_NAME.get(name.lower());
    }

    /** PHP: `Level->getName()`. */
    public static getName(level: Level): string {
        return BY_VALUE.get(level) ?? "DEBUG";
    }

    /** PHP: `Level->toPsrLogLevel()`. */
    public static toPsrLogLevel(level: Level): string {
        return Levels.getName(level).lower();
    }

    /** PHP: `Level->includes()` -- true when the given level is at least this one. */
    public static includes(level: Level, other: Level): boolean {
        return level <= other;
    }

    /** PHP: `Level->isHigherThan()`. */
    public static isHigherThan(level: Level, other: Level): boolean {
        return level > other;
    }
}
