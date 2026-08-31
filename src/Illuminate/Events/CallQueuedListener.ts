import { Container } from 'Illuminate/Container/Container';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { InteractsWithQueue } from 'Illuminate/Queue/InteractsWithQueue';
import { Queueable } from 'Illuminate/Bus/Queueable';
import { Reflector } from 'Illuminate/Support/Reflector';
import { ShouldQueue } from 'Illuminate/Contracts/Queue/ShouldQueue';
import type { Abstract } from 'Illuminate/Container/Types';
import type { Container as ContainerContract } from 'Illuminate/Contracts/Container/Container';
import type { EventPayload } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Job } from 'Illuminate/Contracts/Queue/Job';

/**
 * PHP: `Illuminate\Events\CallQueuedListener`.
 *
 * The job a queued listener travels as: it carries the listener's class, the
 * method to call and the event arguments, and calls them once a worker picks it
 * up.
 *
 * `prepareData()` unserialises the arguments in PHP, because they were
 * serialised into the payload separately; here the storage driver serialises
 * the payload whole, so there is nothing to prepare.
 *
 * The uniqueness fields (`shouldBeUnique`, `uniqueId`, `uniqueFor`,
 * `uniqueVia`) are not ported. The lock they need exists -- `Bus\UniqueLock`
 * over the cache, which is what `ShouldBeUnique` jobs use -- so this is work
 * left undone, not a wall.
 */
@ShouldQueue()
export class CallQueuedListener extends Queueable
{
    /** The number of times the job may be attempted. */
    public tries?: number;

    /** The number of times the job may be attempted after an exception. */
    public maxExceptions?: number;

    /** The number of seconds to wait before retrying the job. */
    public backoff?: number | Array<number>;

    /** The timestamp indicating when the job should timeout. */
    public retryUntil?: number;

    /** The number of seconds the job may run. */
    public timeout?: number;

    /** Indicates if the job should be failed if it times out. */
    public failOnTimeout = false;

    /** Indicates if the job should be deleted when what it points at is gone. */
    public deleteWhenMissingModels = false;

    /** Create a new job instance. */
    public constructor(
        public readonly listenerClass: Abstract,
        public readonly method: string,
        public readonly data: EventPayload,
    )
    {
        super();
    }

    /** Handle the queued job. */
    public handle(@Inject('app') container: ContainerContract): void
    {
        const handler = this.setJobInstanceIfNecessary(this.job, container.make(this.listenerClass) as object);

        const callable = (handler as Record<string, unknown>)[this.method];

        (callable as (self: object, ...args: Array<never>) => void)(handler, ...(this.data as Array<never>));
    }

    /** Set the job instance of the given class if necessary. */
    protected setJobInstanceIfNecessary(job: Job | undefined, instance: object): object
    {
        if (job !== undefined && Reflector.isInstanceOf(instance, InteractsWithQueue)) {
            (instance as InteractsWithQueue).setJob(job);
        }

        return instance;
    }

    /** Call the failed method on the job instance. */
    public failed(e: unknown): void
    {
        const handler = Container.getInstance().make(this.listenerClass) as Record<string, unknown>;

        const callable = handler.failed;

        if (typeIs(callable, 'function')) {
            (callable as (self: object, ...args: Array<never>) => void)(
                handler as unknown as object,
                ...([
                    ...this.data,
                    e,
                ] as Array<never>),
            );
        }
    }
}
