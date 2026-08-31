import type { LogRecord } from '@larablox/monolog/out/Monolog/LogRecord';

/**
 * PHP: `interface Illuminate\Contracts\Log\ContextLogProcessor`.
 *
 * Declared as an abstract class rather than an interface because it is used as
 * a container binding key, and interfaces do not exist at runtime.
 */
export abstract class ContextLogProcessor
{
    /** Add contextual data to the log's "extra" parameter. */
    public abstract process(record: LogRecord): LogRecord;
}
