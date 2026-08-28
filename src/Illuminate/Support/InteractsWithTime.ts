/**
 * PHP: `\DateTimeInterface|\DateInterval|int $delay`.
 *
 * Carbon has no counterpart on this platform and neither has `\DateInterval`;
 * a delay is a number of seconds or a `DateTime`.
 */
export type Delay = number | DateTime;

/**
 * PHP: `Illuminate\Support\InteractsWithTime`.
 *
 * A trait in PHP, mixed into the queue classes, the worker and the rate
 * limiters. Luau has no traits and TypeScript no multiple inheritance, so the
 * methods are static and called through the class.
 *
 * `parseDateInterval()` is not ported -- it converts a `\DateInterval` into a
 * Carbon instance, and there is neither. `runTimeForHumans()` formats worker
 * output through `CarbonInterval` and arrives with the worker.
 */
export class InteractsWithTime {
    /** Get the number of seconds until the given DateTime. */
    public static secondsUntil(delay: Delay): number {
        return typeIs(delay, 'number')
            ? math.floor(delay)
            : math.max(0, delay.UnixTimestamp - InteractsWithTime.currentTime());
    }

    /** Get the "available at" UNIX timestamp. */
    public static availableAt(delay: Delay = 0): number {
        return typeIs(delay, 'number') ? InteractsWithTime.currentTime() + math.floor(delay) : delay.UnixTimestamp;
    }

    /** Get the current system time as a UNIX timestamp. */
    public static currentTime(): number {
        return os.time();
    }
}
