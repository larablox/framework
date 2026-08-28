import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import { ServiceProvider } from 'Illuminate/Support/ServiceProvider';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Factory } from 'Illuminate/Contracts/Queue/Factory';

/**
 * PHP: `Illuminate\Events\EventServiceProvider`.
 *
 * The database-transaction resolver the PHP provider also wires up has nothing
 * to resolve here.
 */
export class EventServiceProvider extends ServiceProvider {
    /** Register the service provider. */
    public register(): void {
        const app: Application = this.app;

        this.app.singleton('events', (container: Container) =>
            new Dispatcher(container).setQueueResolver(() => app.make<Factory>('queue')),
        );
    }
}
