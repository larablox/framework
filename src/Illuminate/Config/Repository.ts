import { Arr } from "Illuminate/Support/Arr";
import { InvalidArgumentException } from "Illuminate/Exception";
import { Util } from "Illuminate/Container/Util";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Repository as ConfigContract } from "Illuminate/Contracts/Config/Repository";

/**
 * PHP: `Illuminate\Config\Repository`.
 *
 * `float()` and `collection()` are not ported: Luau has a single number type,
 * and there is no Collection yet.
 */
export class Repository implements ConfigContract {
    /** Create a new configuration repository. */
    public constructor(protected items: ArrayAccessible = {}) {}

    /** Determine if the given configuration value exists. */
    public has(key: string): boolean {
        return Arr.has(this.items, key);
    }

    /** Get the specified configuration value. */
    public get(key: string, defaultValue?: unknown): unknown {
        return Arr.get(this.items, key, defaultValue);
    }

    /**
     * Get many configuration values.
     *
     * A key may be given alone or paired with the default to fall back to.
     */
    public getMany(keys: Array<string | [string, unknown]>): ArrayAccessible {
        const config: ArrayAccessible = {};

        for (const entry of keys) {
            const [key, defaultValue] = typeIs(entry, "string")
                ? [entry, undefined]
                : entry;

            config[key] = Arr.get(this.items, key, defaultValue);
        }

        return config;
    }

    /** Get the specified string configuration value. */
    public string(key: string, defaultValue?: unknown): string {
        const value = this.get(key, defaultValue);

        if (!typeIs(value, "string")) {
            throw new InvalidArgumentException(
                `Configuration value for key [${key}] must be a string, ${typeOf(value)} given.`,
            );
        }

        return value;
    }

    /** Get the specified integer configuration value. */
    public integer(key: string, defaultValue?: unknown): number {
        const value = this.get(key, defaultValue);

        if (!typeIs(value, "number") || math.floor(value) !== value) {
            throw new InvalidArgumentException(
                `Configuration value for key [${key}] must be an integer, ${typeOf(value)} given.`,
            );
        }

        return value;
    }

    /** Get the specified boolean configuration value. */
    public boolean(key: string, defaultValue?: unknown): boolean {
        const value = this.get(key, defaultValue);

        if (!typeIs(value, "boolean")) {
            throw new InvalidArgumentException(
                `Configuration value for key [${key}] must be a boolean, ${typeOf(value)} given.`,
            );
        }

        return value;
    }

    /** Get the specified array configuration value. */
    public array(key: string, defaultValue?: unknown): Array<defined> {
        const value = this.get(key, defaultValue);

        if (!Util.isArray(value)) {
            throw new InvalidArgumentException(
                `Configuration value for key [${key}] must be an array, ${typeOf(value)} given.`,
            );
        }

        return value as Array<defined>;
    }

    /** Set a given configuration value. */
    public set(key: string, value?: unknown): void {
        Arr.set(this.items, key, value);
    }

    /** Prepend a value onto an array configuration value. */
    public prepend(key: string, value: defined): void {
        const array = (this.get(key, []) ?? []) as Array<defined>;

        array.unshift(value);

        this.set(key, array);
    }

    /** Push a value onto an array configuration value. */
    public push(key: string, value: defined): void {
        const array = (this.get(key, []) ?? []) as Array<defined>;

        array.push(value);

        this.set(key, array);
    }

    /** Get all of the configuration items for the application. */
    public all(): ArrayAccessible {
        return this.items;
    }
}
