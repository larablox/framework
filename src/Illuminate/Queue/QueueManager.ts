import { InvalidArgumentException } from "Illuminate/Exception";
import { JobExceptionOccurred } from "Illuminate/Queue/Events/JobExceptionOccurred";
import { JobFailed } from "Illuminate/Queue/Events/JobFailed";
import { JobProcessed } from "Illuminate/Queue/Events/JobProcessed";
import { JobProcessing } from "Illuminate/Queue/Events/JobProcessing";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { ConnectorInterface } from "Illuminate/Queue/Connectors/ConnectorInterface";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type {
    Dispatcher,
    Listener,
} from "Illuminate/Contracts/Events/Dispatcher";
import type { Factory } from "Illuminate/Contracts/Queue/Factory";
import type { Job, JobPayload } from "Illuminate/Contracts/Queue/Job";
import type {
    JobTarget,
    Queue as QueueContract,
} from "Illuminate/Contracts/Queue/Queue";
import type { Queue as BaseQueue } from "Illuminate/Queue/Queue";
import type { Repository } from "Illuminate/Contracts/Config/Repository";

/** A connector as registered through `addConnector()`. */
export type ConnectorResolver = () => ConnectorInterface;

/**
 * PHP: `Illuminate\Queue\QueueManager`.
 *
 * PHP forwards anything it does not answer itself to the default connection
 * through `__call`; Luau has no `__call`, so the `Queue` contract is delegated
 * explicitly at the bottom of the class -- the methods a facade call actually
 * lands on.
 *
 * `pause()`, `resume()`, `isPaused()` and `getPausedQueues()` keep their state
 * in the cache, and `route()` in `QueueRoutes`; neither exists yet. The
 * `Monitor` contract is implemented as far as its events exist: `looping()`,
 * `starting()` and `stopping()` arrive with the worker.
 */
export class QueueManager implements Factory {
    /** The array of resolved queue connections. */
    protected connections = new OrderedMap<string, QueueContract>();

    /** The array of resolved queue connectors. */
    protected connectors = new OrderedMap<string, ConnectorResolver>();

    /** Create a new queue manager instance. */
    public constructor(protected app: Application) {}

    /** Register an event listener for the before job event. */
    public before(callback: Listener): void {
        this.events().listen(JobProcessing, callback);
    }

    /** Register an event listener for the after job event. */
    public after(callback: Listener): void {
        this.events().listen(JobProcessed, callback);
    }

    /** Register an event listener for the exception occurred job event. */
    public exceptionOccurred(callback: Listener): void {
        this.events().listen(JobExceptionOccurred, callback);
    }

    /** Register an event listener for the failed job event. */
    public failing(callback: Listener): void {
        this.events().listen(JobFailed, callback);
    }

    /** Determine if the driver is connected. */
    public connected(name?: string): boolean {
        return this.connections.has(
            QueueManager.cacheKey(name ?? this.getDefaultDriver()),
        );
    }

    /** Resolve a queue connection instance. */
    public connection(name?: string): QueueContract {
        const connection = name ?? this.getDefaultDriver();
        const key = QueueManager.cacheKey(connection);

        // If the connection has not been resolved yet we will resolve it now as all
        // of the connections are resolved when they are actually needed so we do
        // not make any unnecessary connection to the various queue end-points.
        let resolved = this.connections.get(key);

        if (resolved === undefined) {
            resolved = this.resolve(connection);

            this.connections.set(key, resolved);

            (resolved as unknown as BaseQueue).setContainer(this.app);
        }

        return resolved;
    }

    /**
     * The key the resolved-connection cache is indexed by.
     *
     * PHP writes `$this->connections[$name]` even when `$name` is null,
     * which PHP turns into the empty-string key. A Luau table cannot be keyed
     * by nil at all, so the coercion is spelled out -- and only for the cache:
     * the name itself stays undefined, which is what makes `getConfig()` fall
     * back to the null driver.
     */
    private static cacheKey(name?: string): string {
        return name ?? "";
    }

    /** Resolve a queue connection. */
    protected resolve(name?: string): QueueContract {
        const config = this.getConfig(name);

        if (config === undefined) {
            throw new InvalidArgumentException(
                `The [${name}] queue connection has not been configured.`,
            );
        }

        const queue = this.getConnector(config.driver as string)
            .connect(config)
            // PHP hands `setConnectionName()` a null name straight through;
            // the empty string is the closest thing a `string` field has.
            .setConnectionName(name ?? "");

        const setConfig = (queue as { setConfig?: unknown }).setConfig;

        if (typeIs(setConfig, "function")) {
            (setConfig as (self: object, config: ArrayAccessible) => void)(
                queue,
                config,
            );
        }

        return queue;
    }

    /** Get the connector for a given driver. */
    protected getConnector(driver: string): ConnectorInterface {
        const resolver = this.connectors.get(driver);

        if (resolver === undefined) {
            throw new InvalidArgumentException(`No connector for [${driver}].`);
        }

        return resolver();
    }

    /** Add a queue connection resolver. */
    public extend(driver: string, resolver: ConnectorResolver): void {
        this.addConnector(driver, resolver);
    }

    /** Add a queue connection resolver. */
    public addConnector(driver: string, resolver: ConnectorResolver): void {
        this.connectors.set(driver, resolver);
    }

    /** Get the queue connection configuration. */
    protected getConfig(name?: string): ArrayAccessible | undefined {
        if (name !== undefined && name !== "null") {
            return this.app
                .make<Repository>("config")
                .get(`queue.connections.${name}`) as
                ArrayAccessible | undefined;
        }

        return { driver: "null" };
    }

    /** Get the name of the default queue connection. */
    public getDefaultDriver(): string | undefined {
        return this.app.make<Repository>("config").get("queue.default") as
            string | undefined;
    }

    /** Set the name of the default queue connection. */
    public setDefaultDriver(name: string): void {
        this.app.make<Repository>("config").set("queue.default", name);
    }

    /** Get the full name for the given connection. */
    public getName(connection?: string): string | undefined {
        return connection ?? this.getDefaultDriver();
    }

    /** Get the application instance used by the manager. */
    public getApplication(): Application {
        return this.app;
    }

    /** Set the application instance used by the manager. */
    public setApplication(app: Application): this {
        this.app = app;

        for (const connection of this.connections.values()) {
            (connection as unknown as BaseQueue).setContainer(app);
        }

        return this;
    }

    /** Get the event dispatcher. */
    protected events(): Dispatcher {
        return this.app.make<Dispatcher>("events");
    }

    // -----------------------------------------------------------------
    // Forwarded to the default connection -- PHP does this in `__call`
    // -----------------------------------------------------------------

    /** Get the size of the queue. */
    public size(queue?: string): number {
        return this.connection().size(queue);
    }

    /** Push a new job onto the queue. */
    public push(job: JobTarget, data: unknown = "", queue?: string): unknown {
        return this.connection().push(job, data, queue);
    }

    /** Push a new job onto a specific queue. */
    public pushOn(queue: string, job: JobTarget, data: unknown = ""): unknown {
        return this.connection().pushOn(queue, job, data);
    }

    /** Push a raw payload onto the queue. */
    public pushRaw(
        payload: JobPayload,
        queue?: string,
        options?: ArrayAccessible,
    ): unknown {
        return this.connection().pushRaw(payload, queue, options);
    }

    /** Push a new job onto the queue after (n) seconds. */
    public later(
        delay: Delay,
        job: JobTarget,
        data: unknown = "",
        queue?: string,
    ): unknown {
        return this.connection().later(delay, job, data, queue);
    }

    /** Push a new job onto a specific queue after (n) seconds. */
    public laterOn(
        queue: string,
        delay: Delay,
        job: JobTarget,
        data: unknown = "",
    ): unknown {
        return this.connection().laterOn(queue, delay, job, data);
    }

    /** Push an array of jobs onto the queue. */
    public bulk(
        jobs: JobTarget | Array<JobTarget>,
        data: unknown = "",
        queue?: string,
    ): void {
        this.connection().bulk(jobs, data, queue);
    }

    /** Pop the next job off of the queue. */
    public pop(queue?: string): Job | undefined {
        return this.connection().pop(queue);
    }
}
