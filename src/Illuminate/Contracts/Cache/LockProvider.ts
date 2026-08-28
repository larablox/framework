import type { Lock } from 'Illuminate/Contracts/Cache/Lock';

/** PHP: `Illuminate\Contracts\Cache\LockProvider`. */
export interface LockProvider {
    /** Get a lock instance. */
    lock(name: string, seconds?: number, owner?: string): Lock;

    /** Restore a lock instance using the owner identifier. */
    restoreLock(name: string, owner: string): Lock;
}
