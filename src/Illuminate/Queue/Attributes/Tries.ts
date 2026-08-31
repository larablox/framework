import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class Tries`. */
export interface Tries
{
    readonly tries: number;
}

/** The number of times the job may be attempted. */
export function Tries(tries: number)
{
    return (target: object): void => {
        Attributes.add(target, Tries, { tries });
    };
}
