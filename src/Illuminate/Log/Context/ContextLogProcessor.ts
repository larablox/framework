import { Container } from 'Illuminate/Container/Container';
import { ContextLogProcessor as ContextLogProcessorContract } from 'Illuminate/Contracts/Log/ContextLogProcessor';
import { Repository as ContextRepository } from 'Illuminate/Log/Context/Repository';
import type { LogRecord, RecordBag } from '@larablox/monolog/out/Monolog/LogRecord';

/** PHP: `Illuminate\Log\Context\ContextLogProcessor`. */
export class ContextLogProcessor extends ContextLogProcessorContract
{
    /** Add contextual data to the log's "extra" parameter. */
    public process(record: LogRecord): LogRecord
    {
        const app = Container.getInstance();

        if (!app.bound(ContextRepository)) {
            return record;
        }

        const extra: RecordBag = {};

        for (const [key, value] of pairs(record.extra)) {
            extra[key as string] = value;
        }

        for (const [key, value] of pairs(app.make(ContextRepository).all())) {
            extra[key as string] = value;
        }

        return record.with({ extra });
    }
}
