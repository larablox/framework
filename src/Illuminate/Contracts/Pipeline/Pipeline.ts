import type { Abstract } from 'Illuminate/Container/Types';

/**
 * PHP: one entry of `through()`.
 *
 * A callable that takes the passable and the rest of the stack, an object with
 * the pipe method on it, or a class to resolve from the container. PHP also
 * accepts `"Class:one,two"`; a string binding key keeps that spelling working,
 * and a class carries its parameters as a list instead -- `[Throttle, "60", "1"]`
 * is what `"Throttle:60,1"` says in PHP, where a class is a string to begin
 * with.
 */
export type Pipe = Callback | object | Abstract | PipeWithParameters;

/**
 * A pipe to resolve from the container, plus the arguments it is called with.
 * Its runtime checkers live in `Illuminate/Pipeline/helpers`.
 */
export type PipeWithParameters = [Abstract, ...Array<string>];

/** What a pipe is handed to continue the stack. */
export type Passable = unknown;

/** PHP: `Illuminate\Contracts\Pipeline\Pipeline`. */
export interface Pipeline
{
    /** Set the traveler object being sent on the pipeline. */
    send(passable: Passable): this;

    /** Set the stops of the pipeline. */
    through(...pipes: Array<Pipe | Array<Pipe>>): this;

    /** Set the method to call on the stops. */
    via(method: string): this;

    /** Run the pipeline with a final destination callback. */
    then(destination: (passable: Passable) => unknown): unknown;
}
