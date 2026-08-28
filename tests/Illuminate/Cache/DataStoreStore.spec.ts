/// <reference types="@rbxts/testez/globals" />
import { DataStoreLock } from 'Illuminate/Cache/DataStoreLock';
import { DataStoreStore, MAX_KEY_LENGTH } from 'Illuminate/Cache/DataStoreStore';
import { InvalidArgumentException } from 'Illuminate/Exception';

/**
 * PHP: `Illuminate\Tests\Cache\CacheDatabaseStoreTest`.
 *
 * Upstream mocks `Connection`/query builder and asserts the exact SQL-builder
 * calls each `DatabaseStore` method issues (`whereIn`, `upsert`,
 * `lockForUpdate`, ...). `DataStoreStore.ts` talks to `DataStoreService`
 * instead -- there is no query builder to assert against, and no mocking
 * framework to fake one with (see `Repository.spec.ts`'s class comment).
 * Every case below exercises the real store against `DataStoreService` -- a
 * real Roblox service, reachable only from a running Studio session with API
 * access enabled -- and asserts the round-tripped behaviour instead of the
 * call upstream mocks. Each test uses its own `storeName`, generated from
 * `HttpService`'s `GenerateGUID`, so tests never see each other's keys.
 *
 * **Write throttling drives the shape of this file.** `DataStoreStore.ts`'s
 * class comment says writes to one key are throttled to roughly once every
 * six seconds; every case below therefore writes each key at most once (or
 * touches a distinct key for its second write), rather than PHP's pattern of
 * upserting the same row repeatedly within one test. `testIncrementReturnsCorrectValues`/
 * `testDecrementReturnsCorrectValues` (three sequential `UpdateAsync` calls
 * against the very row PHP mocks in one test) is the one case this changes
 * the shape of the most -- see the comment at that case below.
 *
 * Postgres/SQLite base64 framing (`testValueIsReturnedOnPostgres`,
 * `testValueIsReturnedOnSqlite`, `testValueIsUpsertedOnPostgres`,
 * `testValueIsUpsertedOnSqlite`, `testTouchExtendsTtlOnPostgres`,
 * `testTouchExtendsTtlOnSqlite`) has no equivalent here: `DataStoreStore` has
 * one connection, `DataStoreService`, encoding through `Support/Serializer`
 * regardless of driver -- already exercised by the plain `get`/`put` cases
 * below. `getTime()` mock overrides (`testValueIsUpserted`,
 * `testTouchExtendsTtl`, ...) have no equivalent either: there is no seam to
 * freeze `InteractsWithTime.currentTime()` on (see `ArrayStore.spec.ts`'s
 * class comment), so TTL assertions below check the round-tripped value
 * survives/expires instead of the literal `expiration` number written.
 *
 * Not ported, no equivalent in this port: `setLockConnection()`/
 * `getLockConnection()`/a separate `cache_locks` table
 * (`testLocksMayBeFlushedFromCache` -- `DataStoreLock` writes into the same
 * `DataStoreStore` under a `lock:` key, see `DataStoreLock.ts`, so lock
 * flushing has no separate connection to exercise), and `forgetIfExpired`'s
 * `illuminate:cache:flexible:created:*` companion-key deletion
 * (`testNullIsReturnedAndItemDeletedWhenItemIsExpired`'s second `whereIn`
 * key -- `flexible()` is not ported, see `Repository.ts`'s class comment, so
 * there is no companion key to delete).
 */

const HttpService = game.GetService('HttpService');

/** A fresh store, isolated from every other test by a random store name. */
function freshStore(prefix = 'prefix'): DataStoreStore {
    return new DataStoreStore(HttpService.GenerateGUID(false), prefix);
}

export = (): void => {
    describe('DataStoreStore', () => {
        // PHP: CacheDatabaseStoreTest::testNullIsReturnedWhenItemNotFound
        it('get() returns undefined for a key that was never set', () => {
            const store = freshStore();

            expect(store.get('foo')).to.equal(undefined);
        });

        // PHP: CacheDatabaseStoreTest::testDecryptedValueIsReturnedWhenItemIsValid
        it('a put() value round-trips through get()', () => {
            const store = freshStore();

            expect(store.put('foo', 'bar', 999_999)).to.equal(true);
            expect(store.get('foo')).to.equal('bar');
        });

        // PHP: CacheDatabaseStoreTest::testNullIsReturnedAndItemDeletedWhenItemIsExpired
        it('get() returns undefined, and deletes the row, once the TTL has elapsed', () => {
            const store = freshStore();
            store.put('foo', 'bar', 1);

            task.wait(1.2);

            expect(store.get('foo')).to.equal(undefined);
        });

        // PHP: CacheDatabaseStoreTest::testForeverCallsStoreItemWithReallyLongTime
        // (adapted -- this port's `forever()` writes `expiresAt: 0`, meaning
        // "never", rather than PHP's finite-but-huge 315360000 seconds; see
        // `DataStoreStore.forever()`/`expiresAt()`.)
        it('forever() stores the item with no expiration (divergence from upstream)', () => {
            const store = freshStore();

            expect(store.forever('foo', 'bar')).to.equal(true);
            expect(store.get('foo')).to.equal('bar');
        });

        // PHP: CacheDatabaseStoreTest::testItemsMayBeRemovedFromCache
        it('forget() removes the item', () => {
            const store = freshStore();
            store.put('foo', 'bar', 999_999);

            expect(store.forget('foo')).to.equal(true);
            expect(store.get('foo')).to.equal(undefined);
        });

        // PHP: CacheDatabaseStoreTest::testItemsMayBeFlushedFromCache
        it('flush() removes every item under the prefix', () => {
            const store = freshStore();
            store.put('foo', 'bar', 999_999);
            store.put('baz', 'boom', 999_999);

            expect(store.flush()).to.equal(true);
            expect(store.get('foo')).to.equal(undefined);
            expect(store.get('baz')).to.equal(undefined);
        });

        // PHP: CacheDatabaseStoreTest::testIncrementReturnsCorrectValues /
        // testDecrementReturnsCorrectValues (adapted -- upstream chains three
        // upserts against the same row within one test; write throttling
        // (see class comment) makes that unsafe here, so this is split: a
        // non-existing key increments from zero, a set key increments from
        // its stored value, each its own key.)
        it('increment() on a non-existing key starts from zero', () => {
            const store = freshStore();

            expect(store.increment('counter-a')).to.equal(1);
        });

        it('increment()/decrement() add to and subtract from a stored numeric value', () => {
            const store = freshStore();
            store.put('counter-b', 2, 999_999);

            expect(store.increment('counter-b', 1)).to.equal(3);
        });

        it('decrement() subtracts from a stored numeric value', () => {
            const store = freshStore();
            store.put('counter-c', 3, 999_999);

            expect(store.decrement('counter-c')).to.equal(2);
        });

        // PHP: CacheDatabaseStoreTest::testTouchExtendsTtl
        it('touch() extends the TTL of a live item', () => {
            const store = freshStore();
            store.put('key', 'value', 1);

            expect(store.touch('key', 60)).to.equal(true);

            task.wait(1.2);

            expect(store.get('key')).to.equal('value');
        });

        // PHP: no direct equivalent -- exercises `itemKey()`'s length guard,
        // the platform limit `DataStoreStore.ts`'s class comment documents
        // (a key over `MAX_KEY_LENGTH` characters is refused rather than
        // truncated into a collision).
        it('a key longer than MAX_KEY_LENGTH is refused rather than truncated', () => {
            const store = freshStore('');
            const tooLong = string.rep('k', MAX_KEY_LENGTH + 1);

            const [ok, err] = pcall(() => store.itemKey(tooLong));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
        });

        // PHP: no direct equivalent -- exercises `add()`'s compare-and-set,
        // covered on the Redis-backed store by `MemoryStoreStore.spec.ts`'s
        // "add() only writes when the key is absent"; ported here too since
        // `DataStoreLock`/`DataStoreStore.add()` share the same
        // `UpdateAsync`-based mechanism as `DataStoreLock.acquire()`.
        it('add() only writes when the key is absent', () => {
            const store = freshStore();

            expect(store.add('foo', 'first', 999_999)).to.equal(true);
            expect(store.add('foo', 'second', 999_999)).to.equal(false);
            expect(store.get('foo')).to.equal('first');
        });

        // PHP: no direct equivalent -- exercises `DataStoreLock`, the same
        // ownership contract `ArrayStore.spec.ts`'s lock cases exercise for
        // `ArrayLock`, over `DataStoreStore`'s `UpdateAsync`-based locks.
        it('a lock cannot be acquired twice, and can be acquired again once released', () => {
            const store = freshStore();
            const lock = store.lock('a-lock', 999_999) as DataStoreLock;

            expect(lock.acquire()).to.equal(true);
            expect(lock.acquire()).to.equal(false);
            expect(lock.release()).to.equal(true);
            expect(lock.acquire()).to.equal(true);
        });
    });
};
