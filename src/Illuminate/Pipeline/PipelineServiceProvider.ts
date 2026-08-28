import { Hub } from "Illuminate/Pipeline/Hub";
import { HubContract } from "Illuminate/Contracts/Pipeline/Hub";
import { Pipeline } from "Illuminate/Pipeline/Pipeline";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract } from "Illuminate/Container/Types";

/** PHP: `Illuminate\Pipeline\PipelineServiceProvider`. */
export class PipelineServiceProvider extends ServiceProvider {
    /** Register the service provider. */
    public register(): void {
        this.app.singleton(HubContract, (app) => new Hub(app));

        this.app.bind("pipeline", (app) => new Pipeline(app));
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return [HubContract, "pipeline"];
    }
}
