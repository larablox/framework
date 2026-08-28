import { ContextLogProcessor } from 'Illuminate/Log/Context/ContextLogProcessor';
import { ContextLogProcessor as ContextLogProcessorContract } from 'Illuminate/Contracts/Log/ContextLogProcessor';
import { Repository } from 'Illuminate/Log/Context/Repository';
import { ServiceProvider } from 'Illuminate/Support/ServiceProvider';

/**
 * PHP: `Illuminate\Log\Context\ContextServiceProvider`.
 *
 * The queue hooks it installs in `boot()` -- dehydrating the context into a job
 * payload and hydrating it in the worker -- go with the queue.
 */
export class ContextServiceProvider extends ServiceProvider {
    /** Register the service provider. */
    public register(): void {
        this.app.scoped(Repository);

        this.app.bind(ContextLogProcessorContract, () => new ContextLogProcessor());
    }
}
