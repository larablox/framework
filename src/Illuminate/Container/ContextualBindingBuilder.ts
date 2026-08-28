import { Util } from 'Illuminate/Container/Util';
import type { Abstract, ContextualImplementation } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Repository as ConfigRepository } from 'Illuminate/Contracts/Config/Repository';
import type { ContextualBindingBuilder as ContextualBindingBuilderContract } from 'Illuminate/Contracts/Container/ContextualBindingBuilder';

export class ContextualBindingBuilder implements ContextualBindingBuilderContract {
    /** The abstract target. */
    protected needsAbstract?: Abstract;

    public constructor(
        protected readonly container: Container,
        protected readonly concrete: Abstract | Array<Abstract>,
    ) {}

    /** Define the abstract target that depends on the context. */
    public needs(abstract: Abstract): this {
        this.needsAbstract = abstract;

        return this;
    }

    /** Define the implementation for the contextual binding. */
    public give(implementation: ContextualImplementation): this {
        for (const concrete of Util.arrayWrap(this.concrete)) {
            this.container.addContextualBinding(concrete, this.needsAbstract as Abstract, implementation);
        }

        return this;
    }

    /** Define tagged services to be used as the implementation for the contextual binding. */
    public giveTagged(tag: string): this {
        return this.give((container: Container) => container.tagged(tag).toArray());
    }

    /** Specify the configuration item to bind as a primitive. */
    public giveConfig(key: string, defaultValue?: unknown): this {
        // Typed through the contract rather than an inline object type: an
        // inline `{get: (key) => unknown}` declares a *property* holding a
        // function, and roblox-ts compiles a call on one with a dot, which
        // drops the receiver. The contract declares `get` as a method, so the
        // call compiles to `config:get(...)`.
        return this.give((container: Container) => container.make<ConfigRepository>('config').get(key, defaultValue));
    }
}
