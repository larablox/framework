import { Hub } from "Illuminate/Pipeline/Hub";
import { Pipeline } from "Illuminate/Pipeline/Pipeline";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract } from "Illuminate/Container/Types";

/**
 * PHP: `Illuminate\Pipeline\PipelineServiceProvider`.
 *
 * PHP binds the hub against its contract; an interface is no binding key here,
 * so the class is the key.
 */
export class PipelineServiceProvider extends ServiceProvider {
    /** Register the service provider. */
    public register(): void {
        this.app.singleton(Hub, (app) => new Hub(app));

        this.app.bind("pipeline", (app) => new Pipeline(app));
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return [Hub, "pipeline"];
    }
}
