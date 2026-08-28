import { Attributes } from 'Illuminate/Container/Attributes/Attributes';

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class Connection`. */
export interface Connection
{
    readonly connection: string;
}

/** The queue connection the job is pushed onto. */
export function Connection(connection: string)
{
    return (target: object): void => {
        Attributes.add(target, Connection, { connection });
    };
}
