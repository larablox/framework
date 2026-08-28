import { ArrayBatchRepository } from "Illuminate/Bus/ArrayBatchRepository";
import { Dispatcher } from "Illuminate/Bus/Dispatcher";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract } from "Illuminate/Container/Types";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import { DeferrableProvider } from "Illuminate/Contracts/Support/DeferrableProvider";
import type { Factory } from "Illuminate/Contracts/Queue/Factory";

/**
 * PHP: `Illuminate\Bus\BusServiceProvider`.
 *
 * PHP picks the batch repository by config between a database and DynamoDB;
 * here there is one, held in memory. The contract aliases PHP adds are gone
 * with the interfaces: `Dispatcher` is the key, and it is a class.
 */
@DeferrableProvider()
export class BusServiceProvider
    extends ServiceProvider
    implements DeferrableProvider
{
    /** Register the service provider. */
    public register(): void {
        const app: Application = this.app;

        this.app.singleton(
            Dispatcher,
            () =>
                new Dispatcher(app, (connection?: string) =>
                    app.make<Factory>("queue").connection(connection),
                ),
        );

        this.registerBatchServices();
    }

    /** Register the batch services. */
    protected registerBatchServices(): void {
        const app: Application = this.app;

        this.app.singleton(
            "bus.batches",
            () => new ArrayBatchRepository(app.make<Factory>("queue")),
        );
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return [Dispatcher, "bus.batches"];
    }
}
