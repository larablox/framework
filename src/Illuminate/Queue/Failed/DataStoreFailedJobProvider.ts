import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { InvalidArgumentException } from "Illuminate/Exception";
import { Serializer } from "Illuminate/Support/Serializer";
import { Str } from "Illuminate/Support/Str";
import type {
    JobPayload,
    JobPayloadData,
} from "Illuminate/Contracts/Queue/Job";
import type {
    FailedJobProviderInterface,
    FailedJobRecord,
} from "Illuminate/Queue/Failed/FailedJobProviderInterface";

const DataStoreService = game.GetService("DataStoreService");

/** The longest key DataStore accepts, and the length of an id. */
const MAX_KEY_LENGTH = 50;
const ID_LENGTH = 36;

/** A failed job as the provider writes it. */
interface StoredFailure {
    id: string;
    connection: string;
    queue: string;
    payload: string;
    exception: string;
    failed_at: number;
}

/**
 * PHP: `Illuminate\Queue\Failed\DatabaseFailedJobProvider`, over
 * `DataStoreService`.
 *
 * Where a job goes when it has run out of attempts. This is the one part of the
 * queue that has to outlive the server -- a failure nobody can read afterwards
 * is a failure nobody will fix -- which is why it is worth the DataStore budget
 * even though the queue itself is not.
 *
 * PHP orders by `id` descending; ids here are only ordered within one server,
 * so `all()` sorts by `failed_at` instead. `all()` and everything built on it
 * page through `ListKeysAsync`, which gets `5 + players * 2` calls a minute:
 * this is for an admin screen, not for a hot path. The exception is stored as
 * text, because nothing serialises a Luau error.
 *
 * PHP also implements `CountableFailedJobProvider` and
 * `PrunableFailedJobProvider`; `count()` and `prune()` are kept with it, the
 * way `NullFailedJobProvider` keeps `count()`.
 */
export class DataStoreFailedJobProvider implements FailedJobProviderInterface {
    /** Create a new DataStore failed job provider. */
    public constructor(
        protected readonly storeName = "failed_jobs",
        protected readonly prefix = "",
    ) {
        if (prefix.size() + ID_LENGTH > MAX_KEY_LENGTH) {
            throw new InvalidArgumentException(
                `The failed job prefix [${prefix}] leaves no room for an id; DataStore accepts at most ${MAX_KEY_LENGTH} characters and an id is ${ID_LENGTH}.`,
            );
        }
    }

    /** The data store holding the failures. */
    protected store(): DataStore {
        return DataStoreService.GetDataStore(this.storeName);
    }

    /** Log a failed job into storage. */
    public log(
        connection: string,
        queue: string,
        payload: JobPayload,
        exception: unknown,
    ): string {
        const id = Str.orderedUuid();

        const record: StoredFailure = {
            id,
            connection,
            queue,
            payload: this.serializePayload(payload),
            exception: tostring(exception),
            failed_at: InteractsWithTime.currentTime(),
        };

        this.store().SetAsync(this.prefix + id, record);

        return id;
    }

    /**
     * Get the IDs of all of the failed jobs.
     *
     * PHP does not order this query at all, so the rows come back in
     * insertion order -- unlike `all()`, which is explicitly newest-first.
     * `all()` is the only listing here, so it is walked backwards.
     */
    public ids(queue?: string): Array<string | number> {
        const listed = this.all().filter(
            (record) => queue === undefined || record.queue === queue,
        );
        const ids = new Array<string | number>();

        for (let index = listed.size() - 1; index >= 0; index--) {
            ids.push(listed[index].id);
        }

        return ids;
    }

    /** Get a list of all of the failed jobs, newest first. */
    public all(): Array<FailedJobRecord> {
        const store = this.store();

        const found = new Array<FailedJobRecord>();

        // A forgotten job stays in the listing unless it is excluded, and
        // reading a tombstone costs as much as reading a failure.
        const pages = store.ListKeysAsync(
            this.prefix,
            undefined,
            undefined,
            true,
        );

        while (true) {
            for (const entry of pages.GetCurrentPage() as Array<DataStoreKey>) {
                const [held] = store.GetAsync<StoredFailure>(entry.KeyName);

                const record = this.toRecord(held);

                if (record !== undefined) {
                    found.push(record);
                }
            }

            if (pages.IsFinished) {
                break;
            }

            pages.AdvanceToNextPageAsync();
        }

        // `failed_at` has a one-second resolution, so two failures logged in
        // the same second would otherwise come back in whatever order
        // `table.sort` happened to leave them. The id breaks the tie: it is an
        // ordered UUID, which is the order they were logged in.
        found.sort((first, second) =>
            first.failed_at === second.failed_at
                ? tostring(first.id) > tostring(second.id)
                : first.failed_at > second.failed_at,
        );

        return found;
    }

    /** Get a single failed job. */
    public find(id: string | number): FailedJobRecord | undefined {
        const [held] = this.store().GetAsync<StoredFailure>(
            this.prefix + tostring(id),
        );

        return this.toRecord(held);
    }

    /** Delete a single failed job from storage. */
    public forget(id: string | number): boolean {
        const [held] = this.store().RemoveAsync<StoredFailure>(
            this.prefix + tostring(id),
        );

        return held !== undefined;
    }

    /** Flush all of the failed jobs from storage. */
    public flush(hours?: number): void {
        const store = this.store();

        const cutoff =
            hours === undefined
                ? undefined
                : InteractsWithTime.currentTime() - hours * 3600;

        for (const record of this.all()) {
            if (cutoff === undefined || record.failed_at <= cutoff) {
                store.RemoveAsync(this.prefix + tostring(record.id));
            }
        }
    }

    /** Prune all of the entries older than the given time. */
    public prune(before: number): number {
        const store = this.store();

        let pruned = 0;

        for (const record of this.all()) {
            if (record.failed_at < before) {
                store.RemoveAsync(this.prefix + tostring(record.id));

                pruned += 1;
            }
        }

        return pruned;
    }

    /** Count the failed jobs. */
    public count(connection?: string, queue?: string): number {
        return this.all()
            .filter(
                (record) =>
                    (connection === undefined ||
                        record.connection === connection) &&
                    (queue === undefined || record.queue === queue),
            )
            .size();
    }

    /**
     * Turn a payload into the string storage holds.
     *
     * PHP is handed a JSON string by `getRawBody()` and writes it as it is.
     * Here a raw body is a table, and a driver that keeps its jobs in this
     * server -- `memory`, `sync` -- hands over the live command: by the time it
     * fails, the command points back at the job, the queue and the container,
     * none of which can be written anywhere. The failure is worth keeping
     * regardless, so the envelope is stored without the command. What failed,
     * when, and why is readable; retrying it from storage is not.
     */
    protected serializePayload(payload: JobPayload): string {
        const [ok, serialized] = pcall(() => Serializer.serialize(payload));

        if (ok) {
            return serialized as string;
        }

        const data = payload.data as JobPayloadData;

        return Serializer.serialize({
            ...payload,
            data: {
                commandName: data.commandName,
                batchId: data.batchId,
            },
        });
    }

    /** Turn a stored row back into a record. */
    protected toRecord(held?: StoredFailure): FailedJobRecord | undefined {
        if (held === undefined) {
            return undefined;
        }

        const [ok, payload] = pcall(() => Serializer.unserialize(held.payload));

        return {
            id: held.id,
            connection: held.connection,
            queue: held.queue,
            payload: (ok ? payload : undefined) as JobPayload,
            exception: held.exception,
            failed_at: held.failed_at,
        };
    }
}
