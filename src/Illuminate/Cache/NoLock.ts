import { Lock } from 'Illuminate/Cache/Lock';

/** PHP: `Illuminate\Cache\NoLock`. */
export class NoLock extends Lock {
    /** Attempt to acquire the lock. */
    public acquire(): boolean {
        return true;
    }

    /** Release the lock. */
    public release(): boolean {
        return true;
    }

    /** Returns the owner value written into the driver for this lock. */
    protected getCurrentOwner(): string | undefined {
        return this.ownerId;
    }

    /** Releases this lock in disregard of ownership. */
    public forceRelease(): void {
        //
    }
}
