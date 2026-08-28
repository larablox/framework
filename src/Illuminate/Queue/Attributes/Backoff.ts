import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class Backoff`. */
export interface Backoff {
    readonly backoff: number | Array<number>;
}

/** The seconds to wait before retrying the job, or a schedule of them. */
export function Backoff(backoff: number | Array<number>) {
    return (target: object): void => {
        Attributes.add(target, Backoff, { backoff });
    };
}
