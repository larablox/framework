import type { Abstract } from "Illuminate/Container/Types";

/** PHP: `Illuminate\Contracts\Bus\Dispatcher`. */
export interface Dispatcher {
    /** Dispatch a command to its appropriate handler. */
    dispatch(command: object): unknown;

    /** Dispatch a command to its appropriate handler in the current process. */
    dispatchSync(command: object, handler?: object): unknown;

    /** Dispatch a command to its appropriate handler in the current process. */
    dispatchNow(command: object, handler?: object): unknown;

    /** Determine if the given command has a handler. */
    hasCommandHandler(command: object): boolean;

    /** Retrieve the handler for a command. */
    getCommandHandler(command: object): object | undefined;

    /** Set the pipes commands should be piped through before dispatching. */
    pipeThrough(pipes: Array<unknown>): this;

    /** Map a command to a handler. */
    map(map: Array<[object, Abstract]>): this;
}

/**
 * PHP: `Illuminate\Contracts\Bus\QueueingDispatcher`.
 *
 * `batch()` and `findBatch()` wait on the batch repository, which wants a
 * database or a cache.
 */
export interface QueueingDispatcher extends Dispatcher {
    /** Dispatch a command to its appropriate handler behind a queue. */
    dispatchToQueue(command: object): unknown;
}
