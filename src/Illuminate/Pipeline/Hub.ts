import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { Pipeline } from "Illuminate/Pipeline/Pipeline";
import type { Container } from "Illuminate/Contracts/Container/Container";
import type { Hub as HubContract } from "Illuminate/Contracts/Pipeline/Hub";

/** PHP: the closure a pipeline is registered with. */
export type PipelineBuilder = (
    pipeline: Pipeline,
    passable: unknown,
) => unknown;

/** PHP: `Illuminate\Pipeline\Hub`. */
export class Hub implements HubContract {
    /** The user defined pipelines. */
    protected pipelines = new OrderedMap<string, PipelineBuilder>();

    /** Create a new Hub instance. */
    public constructor(protected container?: Container) {}

    /** Define the default named pipeline. */
    public defaults(callback: PipelineBuilder): void {
        this.pipeline("default", callback);
    }

    /** Define a new named pipeline. */
    public pipeline(name: string, callback: PipelineBuilder): void {
        this.pipelines.set(name, callback);
    }

    /** Send an object through one of the available pipelines. */
    public pipe(object: unknown, pipeline = "default"): unknown {
        const builder = this.pipelines.get(pipeline);

        if (builder === undefined) {
            return undefined;
        }

        return builder(new Pipeline(this.container), object);
    }

    /** Get the container instance used by the hub. */
    public getContainer(): Container | undefined {
        return this.container;
    }

    /** Set the container instance used by the hub. */
    public setContainer(container: Container): this {
        this.container = container;

        return this;
    }
}
