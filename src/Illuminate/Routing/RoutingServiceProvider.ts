import { CallableDispatcher } from 'Illuminate/Routing/CallableDispatcher';
import { ControllerDispatcher } from 'Illuminate/Routing/ControllerDispatcher';
import { Router } from 'Illuminate/Routing/Router';
import { ServiceProvider } from 'Illuminate/Support/ServiceProvider';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';

/**
 * PHP: `Illuminate\Routing\RoutingServiceProvider`.
 *
 * `registerUrlGenerator()`, `registerRedirector()` and the PSR request and
 * response bindings have nothing to bind: there are no URLs to generate, no
 * redirects to make and no PSR bridge. `registerResponseFactory()` waits for
 * `ResponseFactory` and the `response()` helper.
 */
export class RoutingServiceProvider extends ServiceProvider {
    /** Register the service provider. */
    public register(): void {
        this.registerRouter();
        this.registerCallableDispatcher();
        this.registerControllerDispatcher();
    }

    /** Register the router instance. */
    protected registerRouter(): void {
        this.app.singleton(
            'router',
            (container: Container) => new Router(container.make<Dispatcher>('events'), container),
        );
    }

    /** Register the callable dispatcher. */
    protected registerCallableDispatcher(): void {
        this.app.singleton(CallableDispatcher, (container: Container) => new CallableDispatcher(container));
    }

    /** Register the controller dispatcher. */
    protected registerControllerDispatcher(): void {
        this.app.singleton(ControllerDispatcher, (container: Container) => new ControllerDispatcher(container));
    }
}
