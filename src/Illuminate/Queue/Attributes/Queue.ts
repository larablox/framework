import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class Queue`. */
export interface Queue
{
    readonly queue: string;
}

/** The queue the job is pushed onto. */
export function Queue(queue: string)
{
    return (target: object): void => {
        Attributes.add(target, Queue, { queue });
    };
}
