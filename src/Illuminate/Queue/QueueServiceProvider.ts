import { CallQueuedHandler } from 'Illuminate/Queue/CallQueuedHandler';
import { DeferredConnector } from 'Illuminate/Queue/Connectors/DeferredConnector';
import { Facade } from 'Illuminate/Support/Facades/Facade';
import { JobFailed } from 'Illuminate/Queue/Events/JobFailed';
import { MemoryConnector } from 'Illuminate/Queue/Connectors/MemoryConnector';
import { MemoryStoreConnector } from 'Illuminate/Queue/Connectors/MemoryStoreConnector';
import { NullConnector } from 'Illuminate/Queue/Connectors/NullConnector';
import { DataStoreFailedJobProvider } from 'Illuminate/Queue/Failed/DataStoreFailedJobProvider';
import { NullFailedJobProvider } from 'Illuminate/Queue/Failed/NullFailedJobProvider';
import { QueueManager } from 'Illuminate/Queue/QueueManager';
import { Serializer } from 'Illuminate/Support/Serializer';
import { ServiceProvider } from 'Illuminate/Support/ServiceProvider';
import { SyncConnector } from 'Illuminate/Queue/Connectors/SyncConnector';
import { Worker } from 'Illuminate/Queue/Worker';
import type { Abstract } from 'Illuminate/Container/Types';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Container } from 'Illuminate/Container/Container';
import { DeferrableProvider } from 'Illuminate/Contracts/Support/DeferrableProvider';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { Factory } from 'Illuminate/Contracts/Queue/Factory';
import type { FailedJobProviderInterface } from 'Illuminate/Queue/Failed/FailedJobProviderInterface';
import type { LogManager } from 'Illuminate/Log/LogManager';
import type { Repository as Cache } from 'Illuminate/Contracts/Cache/Repository';
import type { Repository as ConfigRepository } from 'Illuminate/Contracts/Config/Repository';

/**
 * PHP: `Illuminate\Queue\QueueServiceProvider`.
 *
 * `registerListener()` and `registerRoutes()` wait on `queue:listen` and
 * `QueueRoutes`; the serializable-closure hooks have nothing to serialise. PHP
 * picks the connectors by name through a variable method call, which is spelled
 * out here.
 *
 * `queue.failer` is the null provider unless the config asks for `datastore`,
 * which is the one storage here that outlives the server.
 */
@DeferrableProvider()
export class QueueServiceProvider extends ServiceProvider implements DeferrableProvider {
    /** Register the service provider. */
    public register(): void {
        // Every payload names this class, so every server that may read one has
        // to be able to resolve the name -- PHP leaves that to the autoloader.
        Serializer.register(CallQueuedHandler);

        this.registerManager();
        this.registerConnection();
        this.registerWorker();
        this.registerFailedJobServices();
    }

    /** Register the queue manager. */
    protected registerManager(): void {
        const app: Application = this.app;

        this.app.singleton('queue', () => {
            // Once we have an instance of the queue manager, we will register the various
            // resolvers for the queue connectors. These connectors are responsible for
            // creating the classes that accept queue configs and instantiate queues.
            const manager = new QueueManager(app);

            this.registerConnectors(manager);

            return manager;
        });
    }

    /** Register the default queue connection binding. */
    protected registerConnection(): void {
        const app: Application = this.app;

        this.app.singleton('queue.connection', () => app.make<Factory>('queue').connection());
    }

    /** Register the connectors on the queue manager. */
    public registerConnectors(manager: QueueManager): void {
        this.registerNullConnector(manager);
        this.registerSyncConnector(manager);
        this.registerDeferredConnector(manager);
        this.registerMemoryConnector(manager);
        this.registerMemoryStoreConnector(manager);
    }

    /** Register the Null queue connector. */
    protected registerNullConnector(manager: QueueManager): void {
        manager.addConnector('null', () => new NullConnector());
    }

    /** Register the Sync queue connector. */
    protected registerSyncConnector(manager: QueueManager): void {
        manager.addConnector('sync', () => new SyncConnector());
    }

    /** Register the Deferred queue connector. */
    protected registerDeferredConnector(manager: QueueManager): void {
        manager.addConnector('deferred', () => new DeferredConnector());
    }

    /** Register the Memory queue connector. */
    protected registerMemoryConnector(manager: QueueManager): void {
        manager.addConnector('memory', () => new MemoryConnector());
    }

    /** Register the MemoryStore queue connector. */
    protected registerMemoryStoreConnector(manager: QueueManager): void {
        manager.addConnector('memorystore', () => new MemoryStoreConnector());
    }

    /**
     * Register the queue worker.
     *
     * PHP hands the worker an `ExceptionHandler` and a callback that says
     * whether the application is down for maintenance. There is no exceptions
     * component yet, so what would be reported is logged, and there is no
     * maintenance mode at all.
     */
    protected registerWorker(): void {
        const app: Application = this.app;

        this.app.singleton('queue.worker', () => {
            const resetScope = (): void => {
                const log = app.make<LogManager>('log');

                log.flushSharedContext();
                log.withoutContext();

                (app as unknown as Container).forgetScopedInstances();

                Facade.clearResolvedInstances();
            };

            const worker = new Worker(
                app.make<Factory>('queue'),
                app.make<Dispatcher>('events'),
                (e) => app.make<LogManager>('log').error(`Queue worker: ${tostring(e)}`),
                resetScope,
            );

            // `maxExceptions` counts across attempts, so the count has to live
            // somewhere the next attempt can see it.
            if (app.bound('cache.store')) {
                worker.setCache(app.make<Cache>('cache.store'));
            }

            this.listenForFailedJobs();

            return worker;
        });
    }

    /**
     * Write every job that fails for good into the failed job storage.
     *
     * PHP does this in `WorkCommand::listenForEvents()`, because a job only
     * fails where a worker is running. There is no console here, so it happens
     * when the worker is resolved -- which is the same moment, spelled
     * differently.
     */
    protected listenForFailedJobs(): void {
        const app: Application = this.app;

        app.make<Dispatcher>('events').listen(JobFailed, (event: JobFailed) => {
            app.make<FailedJobProviderInterface>('queue.failer').log(
                event.connectionName,
                event.job.getQueue(),
                event.job.getRawBody(),
                event.exception,
            );
        });
    }

    /** Register the failed job services. */
    protected registerFailedJobServices(): void {
        const app: Application = this.app;

        this.app.singleton('queue.failer', () => {
            const config = (app.make<ConfigRepository>('config').get('queue.failed') ?? {}) as ArrayAccessible;

            if (config.driver === 'datastore') {
                return new DataStoreFailedJobProvider(
                    (config.store as string | undefined) ?? 'failed_jobs',
                    (config.prefix as string | undefined) ?? '',
                );
            }

            return new NullFailedJobProvider();
        });
    }

    /** Get the services provided by the provider. */
    public provides(): Array<Abstract> {
        return ['queue', 'queue.connection', 'queue.failer', 'queue.worker'];
    }
}
