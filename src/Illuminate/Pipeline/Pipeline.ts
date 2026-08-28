import { wrapPipes } from 'Illuminate/Pipeline/Pipes';
import { RuntimeException } from 'Illuminate/Exception';
import { Util } from 'Illuminate/Container/Util';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Passable, Pipe, Pipeline as PipelineContract } from 'Illuminate/Contracts/Pipeline/Pipeline';

/** The rest of the stack, as a pipe receives it. */
export type Next = (passable: Passable) => unknown;

/**
 * PHP: `Illuminate\Pipeline\Pipeline`.
 *
 * PHP has a `$pipes` property beside a `pipes()` method and `$finally` beside
 * `finally()`; a Luau table holds one value per key, so the properties take a
 * leading underscore -- the same convention `_with` uses in the helpers.
 *
 * `withinTransaction()` is not ported -- it wraps the run in a database
 * transaction, and there is no database. `Macroable` needs `__call`.
 */
export class Pipeline implements PipelineContract
{
    /** The object being passed through the pipeline. */
    protected passable: Passable;

    /** The array of class pipes. */
    protected _pipes = new Array<Pipe>();

    /** The method to call on each pipe. */
    protected method = 'handle';

    /** The callback that runs when the pipeline is done, whatever happened. */
    protected _finally?: (passable: Passable) => void;

    /** Create a new class instance. */
    public constructor(protected container?: Container)
    {}

    /** Set the object being sent through the pipeline. */
    public send(passable: Passable): this
    {
        this.passable = passable;

        return this;
    }

    /** Set the array of pipes. */
    public through(pipes: Pipe | Array<Pipe>): this
    {
        this._pipes = this.asList(pipes);

        return this;
    }

    /** Push additional pipes onto the pipeline. */
    public pipe(pipes: Pipe | Array<Pipe>): this
    {
        for (const entry of this.asList(pipes)) {
            this._pipes.push(entry);
        }

        return this;
    }

    /**
     * PHP: `is_array($pipes) ? $pipes : func_get_args()`.
     *
     * Harder here than there: a parameterized pipe is itself a list, so
     * `wrapPipes()` has to tell `[Throttle, "60"]` -- one pipe -- from
     * `[Throttle, Substitute]` -- two.
     */
    protected asList(pipes: Pipe | Array<Pipe>): Array<Pipe>
    {
        return wrapPipes(pipes);
    }

    /** Set the method to call on the pipes. */
    public via(method: string): this
    {
        this.method = method;

        return this;
    }

    /** Run the pipeline with a final destination callback. */
    public then(destination: (passable: Passable) => unknown): unknown
    {
        const pipes = this.pipes();

        let stack: Next = this.prepareDestination(destination);

        for (let index = pipes.size() - 1; index >= 0; index--) {
            stack = this.carry(stack, pipes[index]);
        }

        try {
            return stack(this.passable);
        } finally {
            if (this._finally !== undefined) {
                this._finally(this.passable);
            }
        }
    }

    /** Run the pipeline and return the result. */
    public thenReturn(): unknown
    {
        return this.then((passable) => passable);
    }

    /** Set a callback to run when the pipeline finishes, whatever happened. */
    public finally(callback: (passable: Passable) => void): this
    {
        this._finally = callback;

        return this;
    }

    /** Get the final piece of the pipeline onion. */
    protected prepareDestination(destination: (passable: Passable) => unknown): Next
    {
        return (passable: Passable) => {
            const [ok, result] = pcall(() => destination(passable));

            if (!ok) {
                return this.handleException(passable, result);
            }

            return result;
        };
    }

    /** Wrap one pipe around the rest of the stack. */
    protected carry(stack: Next, pipe: Pipe): Next
    {
        return (passable: Passable) => {
            // `handleCarry` runs inside the protected region, as it does in
            // PHP's try: Routing overrides it with `toResponse()`, and what
            // that throws must reach `handleException`, not the caller.
            const [ok, result] = pcall(() => this.handleCarry(this.callPipe(pipe, passable, stack)));

            if (!ok) {
                return this.handleException(passable, result);
            }

            return result;
        };
    }

    /** Call one pipe, whichever of the three shapes it is. */
    protected callPipe(pipe: Pipe, passable: Passable, stack: Next): unknown
    {
        // If the pipe is a callable, then we will call it directly, but otherwise we
        // will resolve the pipes out of the dependency container and call it with
        // the appropriate method and arguments, returning the results back out.
        if (typeIs(pipe, 'function')) {
            return (pipe as (passable: Passable, next: Next) => unknown)(passable, stack);
        }

        let parameters: Array<unknown> = [
            passable,
            stack,
        ];

        let instance: object;

        if (typeIs(pipe, 'string') || !this.isPipeInstance(pipe)) {
            const [name, extra] = this.parsePipeString(pipe);

            instance = this.getContainer().make(name) as object;

            parameters = [
                passable,
                stack,
                ...extra,
            ];
        } else {
            instance = pipe as object;
        }

        const handler = (instance as Record<string, unknown>)[this.method];

        if (!typeIs(handler, 'function')) {
            throw new RuntimeException(`The pipe [${tostring(pipe)}] has no [${this.method}] method.`);
        }

        return (handler as (self: object, ...args: Array<unknown>) => unknown)(
            instance,
            ...(parameters as Array<never>),
        );
    }

    /**
     * Tell an instance apart from a class waiting to be resolved.
     *
     * PHP asks `is_object($pipe)`; a class is a table here too, so the question
     * is whether it is an instance of one.
     */
    protected isPipeInstance(pipe: Pipe): boolean
    {
        if (!typeIs(pipe, 'table')) {
            return false;
        }

        const metatable = getmetatable(pipe as object) as object | undefined;

        return metatable !== undefined && rawget(metatable, '__index') === metatable;
    }

    /**
     * Parse full pipe string to get name and parameters.
     *
     * A class cannot be spelled `"Class:60,1"` the way PHP spells one, so the
     * same thing is said with a list: the class first, its arguments after.
     */
    protected parsePipeString(pipe: Pipe): [Abstract, Array<string>]
    {
        if (Util.isArray(pipe)) {
            const list = pipe as Array<defined>;
            const parameters = new Array<string>();

            for (let index = 1; index < list.size(); index++) {
                parameters.push(list[index] as string);
            }

            return [
                list[0] as Abstract,
                parameters,
            ];
        }

        if (!typeIs(pipe, 'string')) {
            return [
                pipe as Abstract,
                [],
            ];
        }

        const separator = pipe.find(':')[0];

        if (separator === undefined) {
            return [
                pipe,
                [],
            ];
        }

        return [
            pipe.sub(1, separator - 1),
            pipe.sub(separator + 1).split(','),
        ];
    }

    /** Get the array of configured pipes. */
    protected pipes(): Array<Pipe>
    {
        return this._pipes;
    }

    /** Get the container instance. */
    protected getContainer(): Container
    {
        if (this.container === undefined) {
            throw new RuntimeException('A container instance has not been passed to the Pipeline.');
        }

        return this.container;
    }

    /** Set the container instance. */
    public setContainer(container: Container): this
    {
        this.container = container;

        return this;
    }

    /** Handle the value returned from each pipe before passing it to the next. */
    protected handleCarry(carry: unknown): unknown
    {
        return carry;
    }

    /** Handle the given exception. */
    protected handleException(passable: Passable, e: unknown): unknown
    {
        throw e;
    }
}
