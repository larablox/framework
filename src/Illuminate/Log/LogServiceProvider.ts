import { LogManager } from "Illuminate/Log/LogManager";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Application } from "Illuminate/Contracts/Foundation/Application";

export class LogServiceProvider extends ServiceProvider {
    /**
     * Register the service provider.
     *
     * PHP takes the application from the closure argument; a container closure
     * is typed against the Container contract here, and the provider already
     * holds the same instance.
     */
    public register(): void {
        const app: Application = this.app;

        this.app.singleton("log", () => new LogManager(app));
    }
}
