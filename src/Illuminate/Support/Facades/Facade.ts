import { RuntimeException } from "Illuminate/Exception";
import type { Abstract } from "Illuminate/Container/Types";
import type { Application } from "Illuminate/Contracts/Foundation/Application";

/**
 * PHP: `Illuminate\Support\Facades\Facade`.
 *
 * The Mockery helpers (`spy`, `partialMock`, `shouldReceive`, `expects`) and
 * `isFake` are not ported -- there is no mocking library and no test suite.
 * `defaultAliases()` goes with `AliasLoader`: TypeScript has no global
 * namespace to alias a class into, so facades are imported like any other
 * module.
 *
 * Dynamic forwarding replaces `__callStatic`; see `Forwards`.
 */
export abstract class Facade {
    /** The application instance being facaded. */
    protected static app?: Application;

    /** The resolved object instances. */
    protected static resolvedInstance = new Map<Abstract, defined>();

    /** Indicates if the resolved instance should be cached. */
    protected static cached = true;

    /** Run a callback when the facade has been resolved. */
    public static resolved(
        callback: (instance: never, app: Application) => void,
    ): void {
        const accessor = this.getFacadeAccessor();
        const app = Facade.app;

        if (app === undefined) {
            throw new RuntimeException("A facade root has not been set.");
        }

        if (app.resolved(accessor)) {
            callback(this.getFacadeRoot() as never, app);
        }

        app.afterResolving(accessor, (service, application) => {
            callback(service, application as Application);
        });
    }

    /** Hotswap the underlying instance behind the facade. */
    public static swap(instance: defined): void {
        Facade.resolvedInstance.set(this.getFacadeAccessor(), instance);

        if (Facade.app !== undefined) {
            Facade.app.instance(this.getFacadeAccessor(), instance);
        }
    }

    /** Get the root object behind the facade. */
    public static getFacadeRoot(): unknown {
        return this.resolveFacadeInstance(this.getFacadeAccessor());
    }

    /** Get the registered name of the component. */
    protected static getFacadeAccessor(): Abstract {
        throw new RuntimeException(
            "Facade does not implement getFacadeAccessor method.",
        );
    }

    /** Resolve the facade root instance from the container. */
    protected static resolveFacadeInstance(name: Abstract): unknown {
        const resolved = Facade.resolvedInstance.get(name);

        if (resolved !== undefined) {
            return resolved;
        }

        if (Facade.app === undefined) {
            return undefined;
        }

        if (Facade.cached) {
            const instance = Facade.app.make(name) as defined;

            Facade.resolvedInstance.set(name, instance);

            return instance;
        }

        return Facade.app.make(name);
    }

    /** Clear a resolved facade instance. */
    public static clearResolvedInstance(name?: Abstract): void {
        Facade.resolvedInstance.delete(name ?? this.getFacadeAccessor());
    }

    /** Clear all of the resolved instances. */
    public static clearResolvedInstances(): void {
        Facade.resolvedInstance.clear();
    }

    /** Get the application instance behind the facade. */
    public static getFacadeApplication(): Application | undefined {
        return Facade.app;
    }

    /** Set the application instance. */
    public static setFacadeApplication(app?: Application): void {
        Facade.app = app;
    }
}
