import { ArrayStore } from "Illuminate/Cache/ArrayStore";
import { DataStoreStore } from "Illuminate/Cache/DataStoreStore";
import { InvalidArgumentException } from "Illuminate/Exception";
import { MemoryStoreStore } from "Illuminate/Cache/MemoryStoreStore";
import { NullStore } from "Illuminate/Cache/NullStore";
import { OrderedMap } from "Illuminate/Support/OrderedMap";
import { Repository } from "Illuminate/Cache/Repository";
import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
import type { Dispatcher } from "Illuminate/Contracts/Events/Dispatcher";
import type { Factory } from "Illuminate/Contracts/Cache/Factory";
import type { Repository as RepositoryContract } from "Illuminate/Contracts/Cache/Repository";
import type { Repository as ConfigRepository } from "Illuminate/Contracts/Config/Repository";
import type { Store } from "Illuminate/Contracts/Cache/Store";

/** A store factory registered through `extend()`. */
export type CacheDriverCreator = (app: Application, config: ArrayAccessible) => RepositoryContract;

/**
 * PHP: `Illuminate\Cache\CacheManager`.
 *
 * PHP picks the driver method by name (`create{Driver}Driver`); the methods are
 * spelled out here, as they are in the queue manager.
 *
 * `array`, `null`, `memorystore` and `datastore` are the drivers that exist.
 * `file`, `redis`, `memcached`, `dynamodb` and `apc` have no backend;
 * `memo()`, which wraps a store in `MemoizedStore`, and the Mockery helpers are
 * not ported either.
 */
export class CacheManager implements Factory {
    /** The array of resolved cache stores. */
    protected stores = new OrderedMap<string, RepositoryContract>();

    /** The registered custom driver creators. */
    protected customCreators = new OrderedMap<string, CacheDriverCreator>();

    /** Create a new Cache manager instance. */
    public constructor(protected readonly app: Application) {}

    /** Get a cache store instance by name, wrapped in a repository. */
    public store(name?: string): RepositoryContract {
        const store = name ?? this.getDefaultDriver();

        let resolved = this.stores.get(store);

        if (resolved === undefined) {
            resolved = this.resolve(store);

            this.stores.set(store, resolved);
        }

        return resolved;
    }

    /** Get a cache driver instance. */
    public driver(driver?: string): RepositoryContract {
        return this.store(driver);
    }

    /** Resolve the given store. */
    public resolve(name: string): RepositoryContract {
        const config = this.getConfig(name);

        if (config === undefined) {
            throw new InvalidArgumentException(`Cache store [${name}] is not defined.`);
        }

        config.store = name;

        return this.build(config);
    }

    /** Build a cache repository from the given configuration. */
    public build(config: ArrayAccessible): RepositoryContract {
        const driver = config.driver as string;

        const custom = this.customCreators.get(driver);

        if (custom !== undefined) {
            return custom(this.app, config);
        }

        if (driver === "array") {
            return this.createArrayDriver(config);
        }

        if (driver === "memorystore") {
            return this.createMemorystoreDriver(config);
        }

        if (driver === "datastore") {
            return this.createDatastoreDriver(config);
        }

        if (driver === "null") {
            return this.createNullDriver(config);
        }

        throw new InvalidArgumentException(`Driver [${driver}] is not supported.`);
    }

    /** Create an instance of the array cache driver. */
    protected createArrayDriver(config: ArrayAccessible): RepositoryContract {
        return this.repository(new ArrayStore(), config);
    }

    /** Create an instance of the MemoryStore cache driver. */
    protected createMemorystoreDriver(config: ArrayAccessible): RepositoryContract {
        return this.repository(
            new MemoryStoreStore(
                (config.map as string | undefined) ?? "cache",
                (config.prefix as string | undefined) ?? "",
            ),
            config,
        );
    }

    /** Create an instance of the DataStore cache driver. */
    protected createDatastoreDriver(config: ArrayAccessible): RepositoryContract {
        return this.repository(
            new DataStoreStore(
                (config.store_name as string | undefined) ?? "cache",
                (config.prefix as string | undefined) ?? "",
                config.scope as string | undefined,
            ),
            config,
        );
    }

    /** Create an instance of the null cache driver. */
    protected createNullDriver(config: ArrayAccessible): RepositoryContract {
        return this.repository(new NullStore(), config);
    }

    /** Create a new cache repository with the given implementation. */
    public repository(store: Store, config: ArrayAccessible = {}): RepositoryContract {
        const repository = new Repository(store, config);

        if (this.app.bound("events") && config.events !== false) {
            repository.setEventDispatcher(this.app.make<Dispatcher>("events"));
        }

        return repository;
    }

    /** Get the cache connection configuration. */
    protected getConfig(name: string): ArrayAccessible | undefined {
        return this.app.make<ConfigRepository>("config").get(`cache.stores.${name}`) as ArrayAccessible | undefined;
    }

    /** Get the default cache driver name. */
    public getDefaultDriver(): string {
        return this.app.make<ConfigRepository>("config").get("cache.default") as string;
    }

    /** Set the default cache driver name. */
    public setDefaultDriver(name: string): void {
        this.app.make<ConfigRepository>("config").set("cache.default", name);
    }

    /** Unset the given driver instances. */
    public forgetDriver(name?: string): this {
        this.stores.delete(name ?? this.getDefaultDriver());

        return this;
    }

    /** Disconnect the given driver and remove from local cache. */
    public purge(name?: string): void {
        this.stores.delete(name ?? this.getDefaultDriver());
    }

    /** Register a custom driver creator Closure. */
    public extend(driver: string, creator: CacheDriverCreator): this {
        this.customCreators.set(driver, creator);

        return this;
    }
}
