import { DataStoreRequest } from 'Illuminate/Support/DataStoreRequest';
import { InteractsWithTime } from 'Illuminate/Support/InteractsWithTime';
import { Lock } from 'Illuminate/Cache/Lock';
import type { DataStoreStore } from 'Illuminate/Cache/DataStoreStore';

/** A lock as the store writes it. */
interface LockRecord {
    owner: string;
    expiresAt: number;
}

/**
 * PHP: `Illuminate\Cache\DatabaseLock`.
 *
 * `UpdateAsync` is atomic per key, so acquiring is correct across servers. It
 * is also *slow*: writes to one key are throttled to roughly one every six
 * seconds, so two servers fighting over the same lock will wait on the
 * platform rather than on each other.
 *
 * Locks belong on `MemoryStoreStore`. This one exists because the database
 * store has one in Laravel, and for the rare lock that has to outlive a server.
 */
export class DataStoreLock extends Lock {
    /** Create a new lock instance. */
    public constructor(
        protected readonly store: DataStoreStore,
        name: string,
        seconds: number,
        owner?: string,
    ) {
        super(name, seconds, owner);
    }

    /** The key the lock is written under. */
    protected key(): string {
        return this.store.itemKey(`lock:${this.name}`);
    }

    /** Attempt to acquire the lock. */
    public acquire(): boolean {
        const expiresAt = this.seconds === 0 ? 0 : InteractsWithTime.currentTime() + math.floor(this.seconds);

        // `UpdateAsync` types the transform as returning a `LuaTuple`; only the
        // value is used, and returning nothing leaves a live lock alone.
        const transform = (held?: LockRecord): LockRecord | undefined => {
            const alive =
                held !== undefined && (held.expiresAt === 0 || held.expiresAt > InteractsWithTime.currentTime());

            return alive ? undefined : { owner: this.ownerId, expiresAt };
        };

        const written = DataStoreRequest.run(() => {
            const [value] = this.store.store().UpdateAsync<LockRecord, LockRecord>(this.key(), transform as never);

            return value;
        });

        return written !== undefined;
    }

    /** Release the lock. */
    public release(): boolean {
        if (!this.isOwnedByCurrentProcess()) {
            return false;
        }

        this.forceRelease();

        return true;
    }

    /** Returns the owner value written into the driver for this lock. */
    protected getCurrentOwner(): string | undefined {
        const held = DataStoreRequest.run(() => {
            const [value] = this.store.store().GetAsync<LockRecord>(this.key());

            return value;
        });

        return held?.owner;
    }

    /** Releases this lock in disregard of ownership. */
    public forceRelease(): void {
        DataStoreRequest.run(() => this.store.store().RemoveAsync(this.key()));
    }
}
