import { Attributes } from "Illuminate/Container/Attributes/Attributes";

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class Timeout`. */
export interface Timeout {
    readonly timeout: number;
}

/** The number of seconds the job may run for. */
export function Timeout(timeout: number) {
    return (target: object): void => {
        Attributes.add(target, Timeout, { timeout });
    };
}
