/**
 * PHP: `Illuminate\Foundation\Exceptions\ReportableHandler`.
 *
 * `handles()` is not ported. PHP reads the type hint on the callback's first
 * parameter and only offers the exception to a callback that asks for its
 * class; a parameter type does not survive compilation, so every callback is
 * offered every exception and narrows for itself -- which is what PHP does for
 * a callback with no type hint at all.
 *
 * PHP invokes the handler through `__invoke`. There is no `__invoke` here, so
 * the call is spelled out.
 */
export class ReportableHandler {
    /** Indicates if reporting should stop after invoking this handler. */
    protected shouldStop = false;

    /** Create a new reportable handler instance. */
    public constructor(protected readonly callback: (e: unknown) => unknown) {}

    /** Invoke the handler. */
    public invoke(e: unknown): boolean {
        const result = this.callback(e);

        if (result === false) {
            return false;
        }

        return !this.shouldStop;
    }

    /** Indicate that report handling should stop after invoking this callback. */
    public stop(): this {
        this.shouldStop = true;

        return this;
    }
}
