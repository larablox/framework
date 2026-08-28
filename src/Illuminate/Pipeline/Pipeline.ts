import { Arr } from 'Illuminate/Support/Arr';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { isPipeArray, splitPipe } from 'Illuminate/Pipeline/helpers';
import { RuntimeException } from 'Illuminate/Exception';
import { Str } from 'Illuminate/Support/Str';
import { ContainerContract } from 'Illuminate/Contracts/Container/Container';
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
    public constructor(@Inject(ContainerContract) protected container?: Container)
    {}

    /** Set the object being sent through the pipeline. */
    public send(passable: Passable): this
    {
        this.passable = passable;

        return this;
    }

    /** Set the array of pipes. */
    public through(...pipes: Array<Pipe | Array<Pipe>>): this
    {
        this._pipes = isPipeArray(pipes[0]) ? pipes[0] : (pipes as Array<Pipe>);

        return this;
    }

    /** Push additional pipes onto the pipeline. */
    public pipe(...pipes: Array<Pipe | Array<Pipe>>): this
    {
        for (const pipe of isPipeArray(pipes[0]) ? pipes[0] : (pipes as Array<Pipe>)) {
            this._pipes.push(pipe);
        }

        return this;
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
        const pipeline = Arr.reverse(this.pipes()).reduce(this.carry(), this.prepareDestination(destination));

        try {
            /**
             * @deferred `withinTransaction`: upstream runs the pipeline inside
             * a 'db' connection transaction here when `withinTransaction()`
             * was called; there is no database component yet. Tracked in
             * scripts/parity/exclusions.json under the same kind.
             *
             * @example Once 'db' is bindable, this branch replaces the plain
             * return -- the `_withinTransaction` property takes the underscore
             * convention, colliding with its method the way `_pipes` does:
             * ```ts
             * return this._withinTransaction !== false
             *     ? this.getContainer().make('db').connection(this._withinTransaction).transaction(() => pipeline(this.passable))
             *     : pipeline(this.passable);
             * ```
             */
            return pipeline(this.passable);
        } finally {
            if (this._finally !== undefined) {
                this._finally(this.passable);
            }
        }
    }

    /** Run the pipeline and return the result. */
    public thenReturn(): unknown
    {
        return this.then(function(passable) {
            return passable;
        });
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
            try {
                return destination(passable);
            } catch (e) {
                return this.handleException(passable, e);
            }
        };
    }

    /** Get a Closure that represents a slice of the application onion. */
    protected carry(): (stack: Next, pipe: Pipe) => Next
    {
        return (stack: Next, pipe: Pipe) => {
            return (passable: Passable) => {
                try {
                    if (typeIs(pipe, 'function')) {
                        // If the pipe is a callable, then we will call it directly, but otherwise we
                        // will resolve the pipes out of the dependency container and call it with
                        // the appropriate method and arguments, returning the results back out.
                        return (pipe as (passable: Passable, next: Next) => unknown)(passable, stack);
                    }

                    let instance: object;

                    let parameters: Array<unknown>;

                    if (typeIs(pipe, 'string') || !this.isPipeInstance(pipe)) {
                        const [name, extra] = typeIs(pipe, 'string') ? this.parsePipeString(pipe) : splitPipe(pipe);

                        // If the pipe is a string we will parse the string and resolve the class out
                        // of the dependency injection container. We can then build a callable and
                        // execute the pipe function giving in the parameters that are required.
                        instance = this.getContainer().make(name) as object;

                        parameters = [
                            passable,
                            stack,
                            ...extra,
                        ];
                    } else {
                        // If the pipe is already an object we'll just make a callable and pass it to
                        // the pipe as-is. There is no need to do any extra parsing and formatting
                        // since the object we're given was already a fully instantiated object.
                        instance = pipe as object;

                        parameters = [
                            passable,
                            stack,
                        ];
                    }

                    const handler = (instance as Record<string, unknown>)[this.method];

                    if (!typeIs(handler, 'function')) {
                        throw new RuntimeException(`The pipe [${tostring(pipe)}] has no [${this.method}] method.`);
                    }

                    const carry = (handler as (self: object, ...args: Array<unknown>) => unknown)(
                        instance,
                        ...(parameters as Array<never>),
                    );

                    return this.handleCarry(carry);
                } catch (e) {
                    return this.handleException(passable, e);
                }
            };
        };
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

    /** Parse full pipe string to get name and parameters. */
    protected parsePipeString(pipe: string): [string, Array<string>]
    {
        const [name, parameters] = Arr.pad(Str.explode(':', pipe, 2), 2, undefined);

        return [
            name,
            parameters !== undefined ? Str.explode(',', parameters) : [],
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
