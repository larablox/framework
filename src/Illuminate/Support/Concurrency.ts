/**
 * PHP: `Illuminate\Concurrency`'s `run()`, without the manager, the drivers or
 * the facade.
 *
 * Laravel runs each task in a process of its own, which is why upstream's
 * tasks may close over only what a process can carry. These are coroutines on
 * the one Luau thread, so a task closes over whatever it likes -- and what is
 * gained is not parallelism but **overlap**: while one task waits on a Roblox
 * service, the next gets to start waiting too. Measured against
 * `DataStoreService`, ten reads cost 3.05s one after another and 0.80s
 * overlapped; `MemoryStoreService` behaves the same way.
 *
 * That is also the whole of when this is worth reaching for. Tasks that only
 * compute gain nothing -- there is one thread, and they will take turns on it
 * either way -- and pay the scheduler for the privilege.
 */
export class Concurrency {
    /**
     * Run the given tasks concurrently, and answer their results in order.
     *
     * Every task settles before this returns, whatever happens: the first
     * error raised is re-raised here afterwards, rather than in a thread
     * nobody is watching, and it never leaves the others half-run.
     *
     * A task has to answer *something* -- a Luau array cannot hold a nil, so
     * one that answered nothing would leave a hole where the results after it
     * should be. A caller with nothing to report answers `true`.
     */
    public static run<T extends defined>(tasks: Array<() => T>): Array<T> {
        const results = new Array<T>();
        const total = tasks.size();

        if (total === 0) {
            return results;
        }

        let settled = 0;
        let failure: unknown;
        let failed = false;
        let waiting: thread | undefined;

        const settle = (): void => {
            settled += 1;

            if (settled < total || waiting === undefined) {
                return;
            }

            const resume = waiting;

            waiting = undefined;

            task.spawn(resume);
        };

        for (let index = 0; index < total; index++) {
            const run = tasks[index];

            task.spawn(() => {
                const [ok, value] = pcall(run);

                if (ok) {
                    results[index] = value as T;
                } else if (!failed) {
                    failed = true;
                    failure = value;
                }

                settle();
            });
        }

        // Only when something is still running. A task that never yielded has
        // already settled, and the resume it would have sent would arrive
        // before the yield below -- leaving this thread asleep for good.
        if (settled < total) {
            waiting = coroutine.running();

            coroutine.yield();
        }

        if (failed) {
            // Level 0, and so not `throw`, which compiles to `error(x)`: that
            // stamps the raiser's own position onto a string error, and the
            // raiser here is this line rather than whatever actually failed.
            error(failure, 0);
        }

        return results;
    }
}
