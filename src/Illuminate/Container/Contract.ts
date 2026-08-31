/**
 * A runtime stand-in for an interface used as a container key.
 *
 * PHP binds against `SomeContract::class` -- at run time just a string.
 * Interfaces here are erased by compilation, so a contract that must key a
 * binding is declared next to its interface as a token carrying the name,
 * with the interface as a phantom type parameter so `make()` comes back
 * typed:
 *
 * ```ts
 * export interface Hub { ... }
 * export const HubContract = new Contract<Hub>("Illuminate\\Contracts\\Pipeline\\Hub");
 * ```
 */
export class Contract<T = unknown>
{
    /** Anchors `T` so distinct contracts stay distinct types. */
    declare protected readonly phantom?: T;

    public constructor(public readonly name: string)
    {}

    /**
     * roblox-ts maps a `toString` method onto the `__tostring` metamethod, so
     * an unbound contract fails with its name, not a table address.
     */
    public toString(): string
    {
        return this.name;
    }
}
