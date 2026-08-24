import { Attributes } from "Illuminate/Container/Attributes/Attributes";

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class MaxExceptions`. */
export interface MaxExceptions {
    readonly maxExceptions: number;
}

/** The number of unhandled exceptions to allow before failing the job. */
export function MaxExceptions(maxExceptions: number) {
    return (target: object): void => {
        Attributes.add(target, MaxExceptions, { maxExceptions });
    };
}
