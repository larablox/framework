import type { Abstract, ContextualImplementation } from "Illuminate/Container/Types";

export interface ContextualBindingBuilder {
    /** Define the abstract target that depends on the context. */
    needs(abstract: Abstract): this;

    /** Define the implementation for the contextual binding. */
    give(implementation: ContextualImplementation): this;

    /** Define tagged services to be used as the implementation. */
    giveTagged(tag: string): this;

    /** Specify the configuration item to bind as a primitive. */
    giveConfig(key: string, defaultValue?: unknown): this;
}
