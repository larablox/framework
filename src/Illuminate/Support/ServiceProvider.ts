import { Attributes } from 'Illuminate/Container/Attributes/Attributes';
import { DeferrableProvider } from 'Illuminate/Contracts/Support/DeferrableProvider';
import { Reflector } from 'Illuminate/Support/Reflector';
import type { Abstract, Concrete, ResolvingCallback } from 'Illuminate/Container/Types';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';

/**
 * PHP: `Illuminate\Support\ServiceProvider`.
 *
 * Asset publishing, Artisan command registration, migration/view/translation
 * loading and the `optimize` hooks are not ported: they address a filesystem and
 * a console that do not exist here.
 */
export abstract class ServiceProvider {
    /** All of the container bindings that should be registered. */
    public bindings?: Array<[Abstract, Concrete]>;

    /** All of the singletons that should be registered. */
    public singletons?: Array<[Abstract, Concrete] | Abstract>;

    /** All of the registered booting callbacks. */
    protected bootingCallbacks = new Array<Callback>();

    /** All of the registered booted callbacks. */
    protected bootedCallbacks = new Array<Callback>();

    /** Create a new service provider instance. */
    public constructor(protected readonly app: Application) {}

    /** Register any application services. */
    public register(): void {
        //
    }

    /** Register a booting callback to be run before the "boot" method is called. */
    public booting(callback: Callback): void {
        this.bootingCallbacks.push(callback);
    }

    /** Register a booted callback to be run after the "boot" method is called. */
    public booted(callback: Callback): void {
        this.bootedCallbacks.push(callback);
    }

    /** Call the registered booting callbacks. */
    public callBootingCallbacks(): void {
        let index = 0;

        while (index < this.bootingCallbacks.size()) {
            this.app.call(this.bootingCallbacks[index]);

            index += 1;
        }
    }

    /** Call the registered booted callbacks. */
    public callBootedCallbacks(): void {
        let index = 0;

        while (index < this.bootedCallbacks.size()) {
            this.app.call(this.bootedCallbacks[index]);

            index += 1;
        }
    }

    /** Setup an after resolving listener, or fire immediately if already resolved. */
    protected callAfterResolving(name: Abstract, callback: ResolvingCallback): void {
        this.app.afterResolving(name, callback);

        if (this.app.resolved(name)) {
            callback(this.app.make(name) as never, this.app);
        }
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return [];
    }

    /** Get the events that trigger this service provider to register. */
    public when(): Array<string> {
        return [];
    }

    /**
     * Determine if the provider is deferred.
     *
     * PHP: `$this instanceof DeferrableProvider`. The interface is erased, so
     * the mark is the `DeferrableProvider` class decorator, found up the class
     * chain the way `instanceof` honours inheritance.
     */
    public isDeferred(): boolean {
        let current = Reflector.classOf(this);

        while (current !== undefined) {
            if (Attributes.has(current, DeferrableProvider)) {
                return true;
            }

            current = Reflector.parentClass(current);
        }

        return false;
    }
}
