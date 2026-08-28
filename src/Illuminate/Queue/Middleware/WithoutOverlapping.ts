import { Container } from "Illuminate/Container/Container";
import { InteractsWithTime } from "Illuminate/Support/InteractsWithTime";
import { Reflector } from "Illuminate/Support/Reflector";
import type { Delay } from "Illuminate/Support/InteractsWithTime";
import type { InteractsWithQueue } from "Illuminate/Queue/InteractsWithQueue";
import type { Next } from "Illuminate/Pipeline/Pipeline";
import type { Repository as Cache } from "Illuminate/Cache/Repository";

/**
 * PHP: `Illuminate\Queue\Middleware\WithoutOverlapping`.
 *
 * Takes a cache lock before the job runs and releases it after, so two copies
 * of the same job never overlap. Over the `memorystore` cache that holds across
 * servers; over `array`, only within this one.
 *
 * PHP hashes the job's display name into the key with `xxh128`; there is no
 * hash function here, so the name goes in as it is.
 */
export class WithoutOverlapping {
    /** The prefix of the lock key. */
    public prefix = "laravel-queue-overlap:";

    /** Indicates whether the lock key should be shared across job classes. */
    public shareKey = false;

    /** The number of seconds before the lock expires. */
    public expiresAfter: number;

    /** Create a new middleware instance. */
    public constructor(
        public key = "",
        public releaseAfterSeconds: number | undefined = 0,
        expiresAfter: Delay = 0,
    ) {
        this.expiresAfter = InteractsWithTime.secondsUntil(expiresAfter);
    }

    /** Process the job. */
    public handle(job: InteractsWithQueue, _next: Next): unknown {
        const lock = Container.getInstance().make<Cache>("cache.store").lock(this.getLockKey(job), this.expiresAfter);

        if (lock.get() === true) {
            try {
                return _next(job);
            } finally {
                lock.release();
            }
        }

        if (this.releaseAfterSeconds !== undefined) {
            job.release(this.releaseAfterSeconds);
        }

        return undefined;
    }

    /** Set the number of seconds the job should be released for. */
    public releaseAfter(seconds: number): this {
        this.releaseAfterSeconds = seconds;

        return this;
    }

    /** Do not release the job back to the queue if no lock can be acquired. */
    public dontRelease(): this {
        this.releaseAfterSeconds = undefined;

        return this;
    }

    /** Set the maximum number of seconds that can elapse before the lock is released. */
    public expireAfter(seconds: Delay): this {
        this.expiresAfter = InteractsWithTime.secondsUntil(seconds);

        return this;
    }

    /** Set the prefix of the lock key. */
    public withPrefix(prefix: string): this {
        this.prefix = prefix;

        return this;
    }

    /** Indicate that the lock key should be shared across job classes. */
    public shared(): this {
        this.shareKey = true;

        return this;
    }

    /** Get the lock key for the given job. */
    public getLockKey(job: object): string {
        if (this.shareKey) {
            return this.prefix + this.key;
        }

        return `${this.prefix}${Reflector.className(Reflector.classOf(job))}:${this.key}`;
    }
}
