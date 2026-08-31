/**
 * PHP: `Symfony\Component\VarDumper\VarDumper`, cut down to the seam Laravel
 * leans on.
 *
 * Not the dumper: there is no cloner, no caster and no output format here --
 * a value goes to `print` and Studio's console renders it. What is ported is
 * the *indirection*, because that is what makes a dump testable. Upstream's
 * own `testDump` swaps the handler out, asserts on what was dumped and puts
 * the default back; without the seam a dump can only be run for its side
 * effect, and a suite that runs it fills the console with debugging output
 * nobody asked for.
 */
export class VarDumper
{
    /** Where a dumped value goes, when something has been put here. */
    private static handler?: (value: unknown) => void;

    /** Dump a value. */
    public static dump(value: unknown): void
    {
        const handler = VarDumper.handler;

        if (handler === undefined) {
            print(value);

            return;
        }

        handler(value);
    }

    /**
     * Set the handler, and answer the one it replaced.
     *
     * Passing nothing restores the default, exactly as PHP's `null` does.
     */
    public static setHandler(handler?: (value: unknown) => void): ((value: unknown) => void) | undefined
    {
        const previous = VarDumper.handler;

        VarDumper.handler = handler;

        return previous;
    }
}
