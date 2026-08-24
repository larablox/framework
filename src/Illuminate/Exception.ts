/**
 * Stand-ins for the PHP exception classes the framework throws.
 *
 * Luau has no exception hierarchy: `throw` compiles to `error()` and `catch` to
 * a `pcall` handler, so any value may be thrown and a typed `catch (e)` block is
 * expressed as an `instanceof` check on the caught value.
 */
export class Exception {
    public constructor(
        protected readonly message: string = "",
        protected readonly code: number = 0,
        protected readonly previous?: Exception,
    ) {}

    public getMessage(): string {
        return this.message;
    }

    public getCode(): number {
        return this.code;
    }

    public getPrevious(): Exception | undefined {
        return this.previous;
    }

    /**
     * roblox-ts maps a `toString` method onto the `__tostring` metamethod, so
     * an uncaught exception still reports something readable.
     */
    public toString(): string {
        return `${tostring(getmetatable(this))}: ${this.message}`;
    }
}

export class LogicException extends Exception {}

export class InvalidArgumentException extends LogicException {}

export class BadFunctionCallException extends LogicException {}

export class BadMethodCallException extends BadFunctionCallException {}

export class RuntimeException extends Exception {}

export class TypeError extends Exception {}

/** PHP: `Illuminate\Support\ItemNotFoundException`. */
export class ItemNotFoundException extends RuntimeException {}

/** PHP: `Illuminate\Support\MultipleItemsFoundException`. */
export class MultipleItemsFoundException extends RuntimeException {}
