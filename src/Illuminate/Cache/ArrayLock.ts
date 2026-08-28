import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { Lock } from "Illuminate/Cache/Lock";
import type { ArrayStore } from "Illuminate/Cache/ArrayStore";

/** PHP: `Illuminate\Cache\ArrayLock`. */
export class ArrayLock extends Lock {
    /** Create a new lock instance. */
    public constructor(
        protected readonly store: ArrayStore,
        name: string,
        seconds: number,
        owner?: string,
    ) {
        super(name, seconds, owner);
    }

    /** Attempt to acquire the lock. */
    public acquire(): boolean {
        const held = this.store.locks.get(this.name);

        if (held !== undefined && (held.expiresAt === undefined || held.expiresAt > InteractsWithTime.currentTime())) {
            return false;
        }

        this.store.locks.set(this.name, {
            owner: this.ownerId,
            expiresAt: this.seconds === 0 ? undefined : InteractsWithTime.currentTime() + this.seconds,
        });

        return true;
    }

    /** Release the lock. */
    public release(): boolean {
        if (this.store.locks.get(this.name) === undefined) {
            return false;
        }

        if (!this.isOwnedByCurrentProcess()) {
            return false;
        }

        this.forceRelease();

        return true;
    }

    /** Returns the owner value written into the driver for this lock. */
    protected getCurrentOwner(): string | undefined {
        return this.store.locks.get(this.name)?.owner;
    }

    /** Releases this lock in disregard of ownership. */
    public forceRelease(): void {
        this.store.locks.delete(this.name);
    }
}
