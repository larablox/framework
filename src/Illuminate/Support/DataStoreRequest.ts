import { retry } from 'Illuminate/Support/Helpers';

/**
 * A rejection the platform is responsible for, and so worth another go.
 *
 * `504` is deliberately absent. A request that timed out may well have been
 * applied before the answer went missing, and repeating one is only safe when
 * it certainly was not: `502` is a rejection and `503` a request dropped
 * before it was read, neither of which reaches the data.
 */
const TRANSIENT = ['502', '503', 'too many requests', 'exceeded limit'];

/** How long to wait before each further attempt. */
const BACKOFF = [1000, 2000, 4000];

/**
 * A DataStore call that gets another go when the platform, and not the
 * caller, is what refused it.
 *
 * PHP: `Illuminate\Database\Connection::run()` with
 * `DetectsLostConnections`, in shape -- every call goes through one place
 * that knows which failures are worth repeating. What qualifies differs: a
 * lost MySQL connection there, a rejected request here.
 *
 * `DataStoreService` refuses a call for two unrelated kinds of reason. The
 * caller can be wrong -- a key over 50 characters, a value that will not
 * store -- and no number of attempts will make it right. Or the platform can
 * be busy: each kind of request has a budget that refills by the minute, and
 * `ListKeysAsync`'s is tighter than the rest by an order of magnitude
 * (`5 + players * 2`, against several hundred for reads and writes). Past it
 * a call comes back rejected rather than queued, and the same call a moment
 * later goes through.
 *
 * Only the second kind is repeated, and the waits are whole seconds because
 * the budget being waited on refills by the minute -- there is nothing to be
 * gained from asking again in fifty milliseconds.
 *
 * A call must answer a single value, not a Luau tuple: `retry()` carries a
 * result through a table, and `{ nil, keyInfo }` -- which is exactly what
 * `GetAsync` answers for a key that holds nothing -- has no defined length.
 */
export class DataStoreRequest {
    /** Whether the platform, rather than the caller, refused the call. */
    public static isTransient(exception: unknown): boolean {
        const message = tostring(exception).lower();

        for (const fragment of TRANSIENT) {
            if (message.find(fragment, 1, true)[0] !== undefined) {
                return true;
            }
        }

        return false;
    }

    /** Make a DataStore call, repeating it while it is worth repeating. */
    public static run<TReturn>(call: () => TReturn): TReturn {
        return retry(BACKOFF, call, 0, (exception) => DataStoreRequest.isTransient(exception));
    }
}
