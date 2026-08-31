import type { ArrayAccessible } from 'Illuminate/Support/Arr';

export interface Repository
{
    /** Determine if the given configuration value exists. */
    has(key: string): boolean;

    /** Get the specified configuration value. */
    get(key: string, defaultValue?: unknown): unknown;

    /** Get many configuration values. */
    getMany(keys: Array<string | [string, unknown]>): ArrayAccessible;

    /** Set a given configuration value. */
    set(key: string, value?: unknown): void;

    /** Prepend a value onto an array configuration value. */
    prepend(key: string, value: defined): void;

    /** Push a value onto an array configuration value. */
    push(key: string, value: defined): void;

    /** Get all of the configuration items for the application. */
    all(): ArrayAccessible;
}
