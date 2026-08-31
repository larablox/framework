import { Util } from 'Illuminate/Container/Util';
import type { Abstract, ContextualImplementation } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Repository as ConfigRepository } from 'Illuminate/Contracts/Config/Repository';
import type { ContextualBindingBuilder as ContextualBindingBuilderContract } from 'Illuminate/Contracts/Container/ContextualBindingBuilder';

export class ContextualBindingBuilder implements ContextualBindingBuilderContract
{
    /** The abstract target. */
    protected _needs?: Abstract;

    /** Create a new contextual binding builder. */
    public constructor(
        protected container: Container,
        protected concrete: Abstract | Array<Abstract>,
    )
    {}

    /** Define the abstract target that depends on the context. */
    public needs(abstract: Abstract): this
    {
        this._needs = abstract;

        return this;
    }

    /** Define the implementation for the contextual binding. */
    public give(implementation: ContextualImplementation): this
    {
        for (const concrete of Util.arrayWrap(this.concrete)) {
            this.container.addContextualBinding(concrete, this._needs as Abstract, implementation);
        }

        return this;
    }

    /** Define tagged services to be used as the implementation for the contextual binding. */
    public giveTagged(tag: string): this
    {
        return this.give((container: Container) => container.tagged(tag).toArray());
    }

    /** Specify the configuration item to bind as a primitive. */
    public giveConfig(key: string, _default?: unknown): this
    {
        return this.give((container: Container) => container.get<ConfigRepository>('config').get(key, _default));
    }
}
