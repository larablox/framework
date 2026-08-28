import { LockTimeoutException } from "Illuminate/Contracts/Cache/LockTimeoutException";
import { Str } from "Illuminate/Support/Str";
import type { Lock as LockContract } from "Illuminate/Contracts/Cache/Lock";

/**
 * PHP: `Illuminate\Cache\Lock`.
 *
 * `block()` waits with `task.wait` rather than `usleep`, which means it yields
 * -- the caller has to be somewhere that may yield.
 */
export abstract class Lock implements LockContract {
    /** The number of milliseconds to wait between blocked attempts. */
    protected sleepMilliseconds = 250;

    /** Create a new lock instance. */
    public constructor(
        protected readonly name: string,
        protected readonly seconds: number,
        protected readonly ownerId: string = Str.random(),
    ) {}

    /** Attempt to acquire the lock. */
    public abstract acquire(): boolean;

    /** Release the lock. */
    public abstract release(): boolean;

    /** Returns the owner value written into the driver for this lock. */
    protected abstract getCurrentOwner(): string | undefined;

    /** Releases this lock in disregard of ownership. */
    public abstract forceRelease(): void;

    /** Attempt to acquire the lock, running the callback while it is held. */
    public get<T>(callback?: () => T): T | boolean {
        const result = this.acquire();

        if (result && callback !== undefined) {
            try {
                return callback();
            } finally {
                this.release();
            }
        }

        return result;
    }

    /** Attempt to acquire the lock for the given number of seconds. */
    public block<T>(seconds: number, callback?: () => T): T | boolean {
        const starting = os.clock();

        while (!this.acquire()) {
            if (os.clock() - starting >= seconds) {
                throw new LockTimeoutException(`Timed out waiting for the [${this.name}] lock.`);
            }

            task.wait(this.sleepMilliseconds / 1000);
        }

        if (callback !== undefined) {
            try {
                return callback();
            } finally {
                this.release();
            }
        }

        return true;
    }

    /** Returns the owner value written into the driver for this lock. */
    public owner(): string {
        return this.ownerId;
    }

    /** Determines whether this lock is allowed to release the lock in the driver. */
    public isOwnedByCurrentProcess(): boolean {
        return this.isOwnedBy(this.ownerId);
    }

    /** Determine whether this lock is owned by the given identifier. */
    public isOwnedBy(owner: string): boolean {
        return this.getCurrentOwner() === owner;
    }

    /** Determine whether the lock is being held. */
    public isLocked(): boolean {
        return this.getCurrentOwner() !== undefined;
    }

    /** Specify the number of milliseconds to sleep between blocked attempts. */
    public betweenBlockedAttemptsSleepFor(milliseconds: number): this {
        this.sleepMilliseconds = milliseconds;

        return this;
    }
}
