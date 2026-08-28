import { Lock } from 'Illuminate/Cache/Lock';
import type { MemoryStoreStore } from 'Illuminate/Cache/MemoryStoreStore';

/**
 * PHP: `Illuminate\Cache\RedisLock`.
 *
 * `acquire()` is atomic across every server: `UpdateAsync` abandons the write
 * when the transform answers nothing, so only the first caller writes an owner.
 *
 * `release()` is not quite: Redis compares the owner and deletes in one Lua
 * script, and MemoryStore has no delete-if. The owner is read and then the key
 * removed, so a lock that expires between those two calls and is taken by
 * someone else could be released by the previous owner. Keep the lock's
 * lifetime comfortably longer than the work it guards, which is the same advice
 * PHP gives.
 */
export class MemoryStoreLock extends Lock {
    /** Create a new lock instance. */
    public constructor(
        protected readonly store: MemoryStoreStore,
        name: string,
        seconds: number,
        owner?: string,
    ) {
        super(name, seconds, owner);
    }

    /** The key the lock is written under. */
    protected key(): string {
        return `${this.store.getPrefix()}lock:${this.name}`;
    }

    /** Attempt to acquire the lock. */
    public acquire(): boolean {
        const written = this.store
            .lockMap()
            .UpdateAsync(
                this.key(),
                (held: unknown) => (held === undefined ? (this.ownerId as never) : undefined),
                this.seconds === 0 ? this.store.maxExpiration() : math.max(1, math.floor(this.seconds)),
            );

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
        const held = this.store.lockMap().GetAsync(this.key());

        return held === undefined ? undefined : tostring(held);
    }

    /** Releases this lock in disregard of ownership. */
    public forceRelease(): void {
        this.store.lockMap().RemoveAsync(this.key());
    }
}
