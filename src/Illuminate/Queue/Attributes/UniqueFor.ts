import { Attributes } from "Illuminate/Container/Attributes/Attributes";

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class UniqueFor`. */
export interface UniqueFor {
    readonly uniqueFor: number;
}

/** How long the job stays unique, in seconds. */
export function UniqueFor(uniqueFor: number) {
    return (target: object): void => {
        Attributes.add(target, UniqueFor, { uniqueFor });
    };
}
