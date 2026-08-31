import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class FailOnTimeout`. */
export interface FailOnTimeout
{
    readonly failOnTimeout: boolean;
}

/** Fail the job outright when it times out, rather than retrying it. */
export function FailOnTimeout(failOnTimeout = true)
{
    return (target: object): void => {
        Attributes.add(target, FailOnTimeout, { failOnTimeout });
    };
}
