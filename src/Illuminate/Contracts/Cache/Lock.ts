/** PHP: `Illuminate\Contracts\Cache\Lock`. */
export interface Lock
{
    /** Attempt to acquire the lock, running the callback while it is held. */
    get<T>(callback?: () => T): T | boolean;

    /** Attempt to acquire the lock for the given number of seconds. */
    block<T>(seconds: number, callback?: () => T): T | boolean;

    /** Release the lock. */
    release(): boolean;

    /** Returns the owner value written into the driver for this lock. */
    owner(): string;

    /** Releases this lock regardless of ownership. */
    forceRelease(): void;
}
