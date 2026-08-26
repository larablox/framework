import { wrapPipes } from "Illuminate/Pipeline/Pipes";
import type { Pipe } from "Illuminate/Contracts/Pipeline/Pipeline";

/**
 * PHP: `Illuminate\Routing\Controller`.
 *
 * `__call` for missing methods is not ported -- there is no `__call`, and a
 * missing method is a Luau error that says as much.
 */
export abstract class Controller {
    /** The middleware registered on the controller. */
    protected middlewareList = new Array<Pipe>();

    /** Register middleware on the controller. */
    public middleware(middleware: Pipe | Array<Pipe>): this {
        for (const entry of wrapPipes(middleware)) {
            this.middlewareList.push(entry);
        }

        return this;
    }

    /**
     * Get the middleware assigned to the controller.
     *
     * PHP hands back entries of the shape `['middleware' => ..., 'options' =>
     * [...]]`, where the options limit the middleware to some of the
     * controller's methods (`only`, `except`). `ControllerMiddlewareOptions`
     * is not ported, so the list is the middleware itself.
     */
    public getMiddleware(): Array<Pipe> {
        return this.middlewareList;
    }

    /** Execute an action on the controller. */
    public callAction(method: string, parameters: Array<defined>): unknown {
        const action = (this as unknown as Record<string, Callback>)[method];

        return action(this, ...parameters);
    }
}
