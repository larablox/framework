import { Hub } from "Illuminate/Pipeline/Hub";
import { Pipeline } from "Illuminate/Pipeline/Pipeline";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract } from "Illuminate/Container/Types";
import type { Application } from "Illuminate/Contracts/Foundation/Application";

/**
 * PHP: `Illuminate\Pipeline\PipelineServiceProvider`.
 *
 * PHP binds the hub against its contract; an interface is no binding key here,
 * so the class is the key.
 */
export class PipelineServiceProvider extends ServiceProvider {
    /** Register the service provider. */
    public register(): void {
        const app: Application = this.app;

        this.app.singleton(Hub, () => new Hub(app));

        this.app.bind("pipeline", () => new Pipeline(app));
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return [Hub, "pipeline"];
    }
}
