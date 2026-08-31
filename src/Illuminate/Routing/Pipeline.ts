import { Handler } from 'Illuminate/Foundation/Exceptions/Handler';
import { Pipeline as BasePipeline } from 'Illuminate/Pipeline/Pipeline';
import { Request } from 'Illuminate/Http/Request';
import { isResponsable } from 'Illuminate/Contracts/Support/Responsable';
import type { Passable } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Routing\Pipeline`.
 *
 * The pipeline the request travels through, which differs from the base one in
 * catching what a pipe throws and asking the exception handler to turn it into
 * a response -- so a middleware standing outside the one that threw still gets
 * a response back from `next()` rather than an exception through it.
 *
 * PHP keys the handler by the `ExceptionHandler` contract; an interface is a
 * type here, so the concrete handler is the key, as it is everywhere else in
 * this port.
 */
export class Pipeline extends BasePipeline
{
    /** Handle the value returned from each pipe before passing it to the next. */
    protected handleCarry(carry: unknown): unknown
    {
        return isResponsable(carry) ? carry.toResponse(this.getContainer().make<Request>('request')) : carry;
    }

    /** Handle the given exception. */
    protected handleException(passable: Passable, e: unknown): unknown
    {
        // The container is asked for directly rather than through
        // `getContainer()`: that one throws when there is none, and an
        // exception raised while handling an exception buries the first.
        if (this.container === undefined || !this.container.bound(Handler) || !(passable instanceof Request)) {
            throw e;
        }

        const handler = this.container.make<Handler>(Handler);

        handler.report(e);

        const response = handler.render(passable, e);

        response.withException(e);

        return this.handleCarry(response);
    }
}
