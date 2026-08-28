import { Arr } from 'Illuminate/Support/Arr';
import { Collection } from 'Illuminate/Support/Collection';
import { RuntimeException } from 'Illuminate/Exception';
import { Str } from 'Illuminate/Support/Str';
import { Trait } from 'Illuminate/Support/Traits/Trait';
import { Util } from 'Illuminate/Container/Util';
import { data_get } from 'Illuminate/Support/helpers';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { AssertNoExtraMembers, AssertTrue, Constructor } from 'Illuminate/Support/Traits/Trait';
import type { Stringable } from 'Illuminate/Support/Str';

/** PHP: the `stdClass` sentinel `only()` compares against. */
const MISSING = {};

/**
 * The instance type `InteractsWithData()` mixes in.
 *
 * Named rather than inferred so that declaration emit can write it down with
 * its `protected` members intact -- see the note on `ConditionablePublicShape`
 * in `Illuminate/Support/Traits/Conditionable`, which explains the whole
 * pattern, including why the shape is in two halves and which half the
 * compiler can check for you.
 */
export declare class InteractsWithDataPublicShape
{
    /** Type-only: there is no such value in the compiled Luau. */
    protected constructor();

    /** Retrieve all data from the instance. */
    public all(keys?: string | Array<string>): ArrayAccessible;

    /** Determine if the data contains a given key. */
    public exists(key: string | Array<string>): boolean;

    /** Determine if the data contains a given key. */
    public has(key: string | Array<string>): boolean;

    /** Determine if the instance contains any of the given keys. */
    public hasAny(keys: string | Array<string>): boolean;

    /** Apply the callback if the instance contains the given key. */
    public whenHas<TReturn extends defined>(
        key: string,
        callback: (value: unknown) => TReturn | undefined,
        defaultCallback?: () => TReturn | undefined,
    ): this | TReturn;

    /** Determine if the instance contains a non-empty value for the given key. */
    public filled(key: string | Array<string>): boolean;

    /** Determine if the instance contains an empty value for the given key. */
    public isNotFilled(key: string | Array<string>): boolean;

    /**
     * Determine if the instance contains a non-empty value for any of the
     * given keys.
     */
    public anyFilled(keys: string | Array<string>): boolean;

    /**
     * Apply the callback if the instance contains a non-empty value for the
     * given key.
     */
    public whenFilled<TReturn extends defined>(
        key: string,
        callback: (value: unknown) => TReturn | undefined,
        defaultCallback?: () => TReturn | undefined,
    ): this | TReturn;

    /** Determine if the instance is missing a given key. */
    public missing(key: string | Array<string>): boolean;

    /** Apply the callback if the instance is missing the given key. */
    public whenMissing<TReturn extends defined>(
        key: string,
        callback: (value: unknown) => TReturn | undefined,
        defaultCallback?: () => TReturn | undefined,
    ): this | TReturn;

    /** Retrieve data from the instance as a `Stringable` instance. */
    public str(key: string, defaultValue?: unknown): Stringable;

    /** Retrieve data from the instance as a `Stringable` instance. */
    public string(key: string, defaultValue?: unknown): Stringable;

    /** Retrieve data from the instance as a boolean value. */
    public boolean(key?: string, defaultValue?: unknown): boolean;

    /** Retrieve data from the instance as an integer value. */
    public integer(key: string, defaultValue?: number): number;

    /** Retrieve data from the instance as an array. */
    public array(key?: string | Array<string>): ArrayAccessible | Array<defined>;

    /** Retrieve data from the instance as a collection. */
    public collect(key?: string | Array<string>): Collection<defined, defined>;

    /** Retrieve a subset of the data from the instance. */
    public only(keys: string | Array<string>): ArrayAccessible;

    /** Retrieve all data from the instance except for a given subset. */
    public except(keys: string | Array<string>): ArrayAccessible;
}

/** The full shape: {@link InteractsWithDataPublicShape} plus what Laravel hides. */
export declare class InteractsWithDataShape extends InteractsWithDataPublicShape
{
    /** Type-only: there is no such value in the compiled Luau. */
    private constructor();

    /** Retrieve data from the instance. */
    protected data(key?: string, defaultValue?: unknown): unknown;

    /** Determine if the given key is an empty string for "filled". */
    protected isEmptyString(key: string): boolean;
}

/**
 * The trait itself.
 *
 * Split out of `InteractsWithData()` below and left unannotated so that the
 * two checks on the shape have something concrete to look at -- see the note
 * on `conditionable` in `Illuminate/Support/Traits/Conditionable`.
 */
function interactsWithData<TBase extends Constructor>(Base: TBase)
{
    return class extends Base {
        /**
         * Retrieve all data from the instance.
         *
         * PHP: `abstract public function all($keys = null)`. A mixin cannot
         * declare an abstract member, so the stub throws and the class using
         * the trait provides its own.
         */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- abstract in PHP; the consumer implements it.
        public all(keys?: string | Array<string>): ArrayAccessible
        {
            throw new RuntimeException('A class using InteractsWithData must implement all().');
        }

        /**
         * Retrieve data from the instance.
         *
         * PHP: `abstract protected function data($key = null, $default = null)`.
         */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- abstract in PHP; the consumer implements it.
        protected data(key?: string, defaultValue?: unknown): unknown
        {
            throw new RuntimeException('A class using InteractsWithData must implement data().');
        }

        /** Determine if the data contains a given key. */
        public exists(key: string | Array<string>): boolean
        {
            return this.has(key);
        }

        /** Determine if the data contains a given key. */
        public has(key: string | Array<string>): boolean
        {
            const data = this.all();

            for (const value of Util.arrayWrap(key)) {
                if (!Arr.has(data, value)) {
                    return false;
                }
            }

            return true;
        }

        /** Determine if the instance contains any of the given keys. */
        public hasAny(keys: string | Array<string>): boolean
        {
            return Arr.hasAny(this.all(), keys);
        }

        /** Apply the callback if the instance contains the given key. */
        public whenHas<TReturn extends defined>(
            key: string,
            callback: (value: unknown) => TReturn | undefined,
            defaultCallback?: () => TReturn | undefined,
        ): this | TReturn
        {
            if (this.has(key)) {
                const result = callback(data_get(this.all(), key));

                return Util.truthy(result) ? (result as TReturn) : this;
            }

            if (defaultCallback !== undefined) {
                const result = defaultCallback();

                return result === undefined ? this : result;
            }

            return this;
        }

        /** Determine if the instance contains a non-empty value for the given key. */
        public filled(key: string | Array<string>): boolean
        {
            for (const value of Util.arrayWrap(key)) {
                if (this.isEmptyString(value)) {
                    return false;
                }
            }

            return true;
        }

        /** Determine if the instance contains an empty value for the given key. */
        public isNotFilled(key: string | Array<string>): boolean
        {
            for (const value of Util.arrayWrap(key)) {
                if (!this.isEmptyString(value)) {
                    return false;
                }
            }

            return true;
        }

        /**
         * Determine if the instance contains a non-empty value for any of the
         * given keys.
         */
        public anyFilled(keys: string | Array<string>): boolean
        {
            for (const key of Util.arrayWrap(keys)) {
                if (this.filled(key)) {
                    return true;
                }
            }

            return false;
        }

        /**
         * Apply the callback if the instance contains a non-empty value for the
         * given key.
         */
        public whenFilled<TReturn extends defined>(
            key: string,
            callback: (value: unknown) => TReturn | undefined,
            defaultCallback?: () => TReturn | undefined,
        ): this | TReturn
        {
            if (this.filled(key)) {
                const result = callback(data_get(this.all(), key));

                return Util.truthy(result) ? (result as TReturn) : this;
            }

            if (defaultCallback !== undefined) {
                const result = defaultCallback();

                return result === undefined ? this : result;
            }

            return this;
        }

        /** Determine if the instance is missing a given key. */
        public missing(key: string | Array<string>): boolean
        {
            return !this.has(key);
        }

        /** Apply the callback if the instance is missing the given key. */
        public whenMissing<TReturn extends defined>(
            key: string,
            callback: (value: unknown) => TReturn | undefined,
            defaultCallback?: () => TReturn | undefined,
        ): this | TReturn
        {
            if (this.missing(key)) {
                const result = callback(data_get(this.all(), key));

                return Util.truthy(result) ? (result as TReturn) : this;
            }

            if (defaultCallback !== undefined) {
                const result = defaultCallback();

                return result === undefined ? this : result;
            }

            return this;
        }

        /**
         * Determine if the given key is an empty string for "filled".
         *
         * PHP casts the value to a string first; `(string) null` is `''`, while
         * `tostring(nil)` would be `"nil"`, so the undefined case is answered
         * before the cast.
         */
        protected isEmptyString(key: string): boolean
        {
            const value = this.data(key);

            if (typeIs(value, 'boolean') || typeIs(value, 'table')) {
                return false;
            }

            return value === undefined || Str.trim(tostring(value)) === '';
        }

        /** Retrieve data from the instance as a Stringable instance. */
        public str(key: string, defaultValue?: unknown): Stringable
        {
            return this.string(key, defaultValue);
        }

        /** Retrieve data from the instance as a Stringable instance. */
        public string(key: string, defaultValue?: unknown): Stringable
        {
            const value = this.data(key, defaultValue);

            return Str.of(value === undefined ? '' : tostring(value));
        }

        /**
         * Retrieve data as a boolean value.
         *
         * Returns true when the value is "1", "true", "on" or "yes", which is
         * what `filter_var($value, FILTER_VALIDATE_BOOLEAN)` answers.
         */
        public boolean(key?: string, defaultValue: unknown = false): boolean
        {
            const value = this.data(key, defaultValue);

            if (typeIs(value, 'boolean')) {
                return value;
            }

            if (typeIs(value, 'number')) {
                return value === 1;
            }

            if (typeIs(value, 'string')) {
                const normalized = Str.lower(Str.trim(value));

                return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
            }

            return false;
        }

        /**
         * Retrieve data as an integer value.
         *
         * PHP's `(int)` cast truncates towards zero and answers `0` for
         * anything it cannot read as a number.
         */
        public integer(key: string, defaultValue = 0): number
        {
            const value = this.data(key, defaultValue);

            if (typeIs(value, 'boolean')) {
                return value ? 1 : 0;
            }

            const asNumber = typeIs(value, 'number') ? value : typeIs(value, 'string') ? tonumber(value) : undefined;

            // Luau reads `"nan"` and `"inf"` as numeric literals where PHP
            // does not, so both have to fall back to `0` like any other
            // unreadable value -- see `parseFinite()` in `Support/Str.ts`.
            if (asNumber === undefined || asNumber !== asNumber || asNumber === math.huge || asNumber === -math.huge) {
                return 0;
            }

            return asNumber < 0 ? math.ceil(asNumber) : math.floor(asNumber);
        }

        /**
         * Retrieve data from the instance as an array.
         *
         * PHP: `(array) $value`. A Luau table is either a list or a map and
         * never both, so the cast keeps a table as it is and wraps anything
         * else in a one-element list -- which is what PHP does to a scalar.
         */
        public array(key?: string | Array<string>): ArrayAccessible | Array<defined>
        {
            const value = typeIs(key, 'table') ? this.only(key) : this.data(key as string | undefined);

            if (Arr.accessible(value)) {
                return value;
            }

            return value === undefined ? [] : [value as defined];
        }

        /** Retrieve data from the instance as a collection. */
        public collect(key?: string | Array<string>): Collection<defined, defined>
        {
            const value = typeIs(key, 'table') ? this.only(key) : this.data(key as string | undefined);

            if (Arr.accessible(value)) {
                return new Collection(value as Record<string, defined>);
            }

            return new Collection(value === undefined ? new Array<defined>() : [value as defined]);
        }

        /**
         * Get a subset containing the provided keys with values from the
         * instance data.
         */
        public only(keys: string | Array<string>): ArrayAccessible
        {
            const results: ArrayAccessible = {};
            const data = this.all();

            for (const key of Util.arrayWrap(keys)) {
                const value = data_get(data, key, MISSING);

                if (value !== MISSING) {
                    Arr.set(results, key, value);
                }
            }

            return results;
        }

        /** Get all of the data except for a specified array of items. */
        public except(keys: string | Array<string>): ArrayAccessible
        {
            const results = this.all();

            Arr.forget(results, keys);

            return results;
        }
    } satisfies Constructor<InteractsWithDataPublicShape>;
}

/**
 * Every public member the trait has that the shape does not list.
 *
 * `satisfies` above covers the other direction; see the note on
 * `ConditionableExtra` in `Illuminate/Support/Traits/Conditionable`.
 */
type InteractsWithDataExtra = Exclude<
    keyof InstanceType<ReturnType<typeof interactsWithData<typeof Trait>>>,
    keyof InteractsWithDataPublicShape
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the assertion is the point: it fails to compile when the trait has a public member the shape does not list.
type InteractsWithDataIsExact = AssertTrue<AssertNoExtraMembers<InteractsWithDataExtra>>;

/**
 * PHP: `trait Illuminate\Support\Traits\InteractsWithData`.
 *
 * The retrieval half of a request: everything `$request->boolean()`,
 * `filled()`, `only()` and friends do. PHP shares it between `Request`,
 * `Fluent`, `ValidatedInput` and `ComponentAttributeBag`; here it will be
 * shared the same way once those classes exist.
 *
 * This is the one place under `Illuminate/Support` that imports `Helpers`, and
 * it is safe as long as it stays the only one: nothing `Helpers` imports uses
 * the trait. When `Fluent` arrives it will use the trait, so its `fluent()`
 * helper belongs beside the class rather than in `Helpers` -- which is where
 * `collect()` already sits, and for the same reason.
 *
 * Not ported, and why:
 *
 * - `float()` -- Luau has one number type, so it is `integer()` without the
 *   truncation; `Arr::float` was dropped for the same reason;
 * - `clamp()` -- waits for `Illuminate\Support\Number`;
 * - `date()` and `interval()` -- wait for a Carbon stand-in;
 * - `enum()`, `enums()`, `isBackedEnum()` -- a TypeScript enum is a plain
 *   table of constants, with no `tryFrom` and nothing to reflect on.
 */
export function InteractsWithData<TBase extends Constructor>(
    Base: TBase = Trait as never,
): TBase & Constructor<InteractsWithDataShape>
{
    return interactsWithData(Base) as never;
}
