import { call } from 'Illuminate/Pipeline/helpers';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Util } from 'Illuminate/Container/Util';
import { OrderedMap } from 'Illuminate/Support/OrderedMap';
import { Pipeline } from 'Illuminate/Pipeline/Pipeline';
import { ContainerContract } from 'Illuminate/Contracts/Container/Container';
import type { Container } from 'Illuminate/Contracts/Container/Container';
import type { Hub as HubContract } from 'Illuminate/Contracts/Pipeline/Hub';

/** PHP: the closure a pipeline is registered with. */
export type PipelineBuilder = (pipeline: Pipeline, passable: unknown) => unknown;

/** PHP: `Illuminate\Pipeline\Hub`. */
export class Hub implements HubContract
{
    /** The user defined pipelines. */
    protected pipelines = new OrderedMap<string, PipelineBuilder>();

    /** Create a new Hub instance. */
    public constructor(@Inject(ContainerContract) protected container?: Container)
    {}

    /** Define the default named pipeline. */
    public defaults(callback: PipelineBuilder): void
    {
        this.pipeline('default', callback);
    }

    /** Define a new named pipeline. */
    public pipeline(name: string, callback: PipelineBuilder): void
    {
        this.pipelines.set(name, callback);
    }

    /** Send an object through one of the available pipelines. */
    public pipe(object: unknown, pipeline?: string): unknown
    {
        pipeline = Util.elvis(pipeline, 'default');

        if (!this.pipelines.has(pipeline)) {
            throw new InvalidArgumentException(`Pipeline [${pipeline}] is not defined.`);
        }

        return call(
            this.pipelines.get(pipeline),
            new Pipeline(this.container),
            object,
        );
    }

    /** Get the container instance used by the hub. */
    public getContainer(): Container | undefined
    {
        return this.container;
    }

    /** Set the container instance used by the hub. */
    public setContainer(container: Container): this
    {
        this.container = container;

        return this;
    }
}
