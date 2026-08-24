import { Attributes } from "Illuminate/Container/Attributes/Attributes";
import type { Delay as DelayValue } from "Illuminate/Support/InteractsWithTime";

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class Delay`. */
export interface Delay {
    readonly delay: DelayValue;
}

/**
 * How long to hold the job before it becomes available.
 *
 * The property `Queueable` sets from `delay()` is `delaySeconds`, because a
 * Luau table cannot carry a `delay` value beside a `delay()` method.
 */
export function Delay(delay: DelayValue) {
    return (target: object): void => {
        Attributes.add(target, Delay, { delay });
    };
}
