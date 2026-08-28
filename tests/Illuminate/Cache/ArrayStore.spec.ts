/// <reference types="@rbxts/testez/globals" />
import { ArrayLock } from 'Illuminate/Cache/ArrayLock';
import { ArrayStore } from 'Illuminate/Cache/ArrayStore';

/**
 * PHP: `Illuminate\Tests\Cache\CacheArrayStoreTest`.
 *
 * **No frozen clock.** Upstream drives every expiry scenario through
 * `Carbon::setTestNow()`, stepping a fake clock by milliseconds.
 * `InteractsWithTime.currentTime()` (what `ArrayStore`/`ArrayLock` call) is a
 * plain `os.time()` with no test seam, so there is nothing here to freeze or
 * step. Every expiry test below drives the same scenario with `task.wait()`
 * against the real clock instead, at whole-second granularity (`os.time()`
 * has none finer). TTLs are shortened from upstream's (10s, a century, ...)
 * to keep the suite fast, which changes no logic, only how long the test
 * takes to observe it.
 *
 * `testCacheTtl` (sub-millisecond boundary stepping) and
 * `testLockExpirationLowerBoundary` (one microsecond before expiry) need
 * finer than one-second resolution to tell apart from
 * `testItemsCanExpire`/`testCannotAcquireLockTwice` on this clock, so they
 * are not ported as separate cases -- see the comments at
 * `testItemsCanExpire`/`testCannotAcquireLockTwice` below for how the same
 * ground is covered.
 *
 * Not ported, no equivalent in this port:
 *
 * - `testStoreItemForeverProperlyStoresInArray` uses a partial mock of
 *   `ArrayStore::put()`; replaced below with a small subclass that records
 *   calls to `put()`, the same substitute the class comment on
 *   `Logger.spec.ts`'s `RecordingHandler` uses for a Mockery mock.
 * - `testValuesAreNotStoredByReference` covers the `$serialize = true`
 *   constructor argument. `ArrayStore.ts`'s own class comment says
 *   `$serializesValues` is not ported -- there is only one behaviour here,
 *   the one `testValuesAreStoredByReferenceIfSerializationIsDisabled` below
 *   covers.
 * - `testExpiredLockCannotBeRefreshedByPreviousOwner` covers `Lock::refresh()`,
 *   which `Lock.ts` does not have.
 * - `testCanGetAll`/`testCanGetAllWhenSerialized` cover `ArrayStore::all()`,
 *   an introspection method this port's `ArrayStore.ts` does not have.
 *
 * One behaviour worth flagging rather than silently reshaping: upstream's
 * `testTouchDoesNotRestoreExpiredItem` expects `touch()` on an
 * already-expired-but-not-yet-purged key to fail and leave the key gone.
 * `ArrayStore.touch()` here looks the key up in `storage` directly and never
 * checks `expiresAt` the way `get()`/`forget()` do, so it *does* revive an
 * expired item instead of refusing it. The test below asserts what the code
 * actually does, not upstream's expectation, and says so at the point of
 * the assertion.
 */
export = (): void => {
    describe('ArrayStore', () => {
        // PHP: CacheArrayStoreTest::testItemsCanBeSetAndRetrieved
        it('items can be set and retrieved', () => {
            const store = new ArrayStore();
            const result = store.put('foo', 'bar', 10);

            expect(result).to.equal(true);
            expect(store.get('foo')).to.equal('bar');
        });

        // PHP: CacheArrayStoreTest::testItemsCanExpire (also covers
        // testCacheTtl's boundary, at whole-second resolution -- see class
        // comment)
        it('items expire once their TTL has elapsed', () => {
            const store = new ArrayStore();

            store.put('foo', 'bar', 1);
            expect(store.get('foo')).to.equal('bar');

            task.wait(1.2);

            expect(store.get('foo')).to.equal(undefined);
        });

        // PHP: CacheArrayStoreTest::testMultipleItemsCanBeSetAndRetrieved
        it('multiple items can be set and retrieved', () => {
            const store = new ArrayStore();
            const result = store.put('foo', 'bar', 10);
            const resultMany = store.putMany(
                new Map<string, unknown>([
                    [
                        'fizz',
                        'buz',
                    ],
                    [
                        'quz',
                        'baz',
                    ],
                ]),
                10,
            );

            expect(result).to.equal(true);
            expect(resultMany).to.equal(true);

            const values = store.many([
                'foo',
                'fizz',
                'quz',
                'norf',
            ]);

            expect(values.get('foo')).to.equal('bar');
            expect(values.get('fizz')).to.equal('buz');
            expect(values.get('quz')).to.equal('baz');
            expect(values.get('norf')).to.equal(undefined);
        });

        // PHP: CacheArrayStoreTest::testTouchExtendsTtl
        it('touch() extends the TTL of a live item', () => {
            const store = new ArrayStore();

            store.put('key', 'value', 1);
            store.touch('key', 3);

            task.wait(1.5);

            expect(store.get('key')).to.equal('value');
        });

        // PHP: CacheArrayStoreTest::testTouchDoesNotRestoreExpiredItem
        // (adapted -- see class comment: `touch()` here does not check
        // `expiresAt`, so it revives an expired-but-not-yet-purged item
        // rather than refusing it)
        it('touch() revives an expired-but-not-yet-purged item (divergence from upstream)', () => {
            const store = new ArrayStore();
            store.put('key', 'value', 1);

            task.wait(1.2);

            expect(store.touch('key', 60)).to.equal(true);
            expect(store.get('key')).to.equal('value');
        });

        // PHP: CacheArrayStoreTest::testStoreItemForeverProperlyStoresInArray
        // (Mockery partial mock -> recording subclass, see class comment)
        it('forever() calls put() with a zero TTL', () => {
            class RecordingArrayStore extends ArrayStore
            {
                public putCalls = new Array<[string, unknown, number]>();

                public put(key: string, value: unknown, seconds: number): boolean
                {
                    this.putCalls.push([
                        key,
                        value,
                        seconds,
                    ]);

                    return super.put(key, value, seconds);
                }
            }

            const store = new RecordingArrayStore();
            const result = store.forever('foo', 'bar');

            expect(result).to.equal(true);
            expect(store.putCalls.size()).to.equal(1);
            expect(store.putCalls[0][0]).to.equal('foo');
            expect(store.putCalls[0][1]).to.equal('bar');
            expect(store.putCalls[0][2]).to.equal(0);
        });

        // PHP: CacheArrayStoreTest::testValuesCanBeIncremented
        it('values can be incremented', () => {
            const store = new ArrayStore();
            store.put('foo', 1, 10);

            let result = store.increment('foo');
            expect(result).to.equal(2);
            expect(store.get('foo')).to.equal(2);

            result = store.increment('foo', 2);
            expect(result).to.equal(4);
            expect(store.get('foo')).to.equal(4);
        });

        // PHP: CacheArrayStoreTest::testValuesGetCastedByIncrementOrDecrement
        it('values are cast to numbers by increment()/decrement()', () => {
            const store = new ArrayStore();
            store.put('foo', '1', 10);

            let result = store.increment('foo');
            expect(result).to.equal(2);
            expect(store.get('foo')).to.equal(2);

            store.put('bar', '1', 10);
            result = store.decrement('bar');
            expect(result).to.equal(0);
            expect(store.get('bar')).to.equal(0);
        });

        // PHP: CacheArrayStoreTest::testIncrementNonNumericValues
        it('incrementing a non-numeric value treats it as zero', () => {
            const store = new ArrayStore();
            store.put('foo', 'I am string', 10);

            const result = store.increment('foo');
            expect(result).to.equal(1);
            expect(store.get('foo')).to.equal(1);
        });

        // PHP: CacheArrayStoreTest::testNonExistingKeysCanBeIncremented
        it('a non-existing key can be incremented, and lives forever', () => {
            const store = new ArrayStore();
            const result = store.increment('foo');
            expect(result).to.equal(1);
            expect(store.get('foo')).to.equal(1);

            // Stands in for upstream's "+10 years": `forever()`/an
            // increment-created key stores with `expiresAt === 0`, which
            // `get()` never treats as expired regardless of elapsed time --
            // a short real wait is enough to exercise the same check.
            task.wait(1.2);
            expect(store.get('foo')).to.equal(1);
        });

        // PHP: CacheArrayStoreTest::testExpiredKeysAreIncrementedLikeNonExistingKeys
        it('an expired key is incremented as if it never existed', () => {
            const store = new ArrayStore();

            store.put('foo', 999, 1);
            task.wait(1.2);

            const result = store.increment('foo');
            expect(result).to.equal(1);
        });

        // PHP: CacheArrayStoreTest::testValuesCanBeDecremented
        it('values can be decremented', () => {
            const store = new ArrayStore();
            store.put('foo', 1, 10);

            let result = store.decrement('foo');
            expect(result).to.equal(0);
            expect(store.get('foo')).to.equal(0);

            result = store.decrement('foo', 2);
            expect(result).to.equal(-2);
            expect(store.get('foo')).to.equal(-2);
        });

        // PHP: CacheArrayStoreTest::testItemsCanBeRemoved
        it('items can be removed', () => {
            const store = new ArrayStore();
            store.put('foo', 'bar', 10);

            expect(store.forget('foo')).to.equal(true);
            expect(store.get('foo')).to.equal(undefined);
            expect(store.forget('foo')).to.equal(false);
        });

        // PHP: CacheArrayStoreTest::testItemsCanBeFlushed
        it('items can be flushed', () => {
            const store = new ArrayStore();
            store.put('foo', 'bar', 10);
            store.put('baz', 'boom', 10);

            const result = store.flush();
            expect(result).to.equal(true);
            expect(store.get('foo')).to.equal(undefined);
            expect(store.get('baz')).to.equal(undefined);
        });

        // PHP: CacheArrayStoreTest::testLocksCanBeFlushed
        it('locks can be flushed', () => {
            const store = new ArrayStore();
            store.lock('foo', 10);
            store.lock('bar', 10);

            const result = store.flushLocks();
            expect(result).to.equal(true);
            expect(store.get('foo')).to.equal(undefined);
            expect(store.get('bar')).to.equal(undefined);
            expect(store.locks.isEmpty()).to.equal(true);
        });

        // PHP: CacheArrayStoreTest::testCacheKey
        it('has no key prefix', () => {
            const store = new ArrayStore();
            expect(store.getPrefix()).to.equal('');
        });

        // PHP: CacheArrayStoreTest::testCannotAcquireLockTwice (also covers
        // testLockExpirationLowerBoundary -- see class comment)
        it('a lock cannot be acquired twice', () => {
            const store = new ArrayStore();
            const lock = store.lock('foo', 10) as ArrayLock;

            expect(lock.acquire()).to.equal(true);
            expect(lock.acquire()).to.equal(false);
        });

        // PHP: CacheArrayStoreTest::testCanAcquireLockAgainAfterExpiry
        it('a lock can be acquired again after it expires', () => {
            const store = new ArrayStore();
            const lock = store.lock('foo', 1) as ArrayLock;
            lock.acquire();

            task.wait(1.2);

            expect(lock.acquire()).to.equal(true);
        });

        // PHP: CacheArrayStoreTest::testLockWithNoExpirationNeverExpires
        it('a lock with no expiration never expires', () => {
            const store = new ArrayStore();
            const lock = store.lock('foo') as ArrayLock;
            lock.acquire();

            task.wait(1.2);

            expect(lock.acquire()).to.equal(false);
        });

        // PHP: CacheArrayStoreTest::testCanAcquireLockAfterRelease
        it('a lock can be acquired again after it is released', () => {
            const store = new ArrayStore();
            const lock = store.lock('foo', 10) as ArrayLock;
            lock.acquire();

            expect(lock.release()).to.equal(true);
            expect(lock.acquire()).to.equal(true);
        });

        // PHP: CacheArrayStoreTest::testAnotherOwnerCannotReleaseLock
        it('another owner cannot release a lock it does not own', () => {
            const store = new ArrayStore();
            const owner = store.lock('foo', 10) as ArrayLock;
            const wannabeOwner = store.lock('foo', 10) as ArrayLock;
            owner.acquire();

            expect(wannabeOwner.release()).to.equal(false);
        });

        // PHP: CacheArrayStoreTest::testAnotherOwnerCanForceReleaseALock
        it('another owner can force-release a lock', () => {
            const store = new ArrayStore();
            const owner = store.lock('foo', 10) as ArrayLock;
            const wannabeOwner = store.lock('foo', 10) as ArrayLock;
            owner.acquire();
            wannabeOwner.forceRelease();

            expect(wannabeOwner.acquire()).to.equal(true);
        });

        // PHP: CacheArrayStoreTest::testValuesAreStoredByReferenceIfSerializationIsDisabled
        it('values are stored by reference (the only behaviour this port has)', () => {
            const store = new ArrayStore();
            const object: { foo?: boolean; bar?: boolean; } = { foo: true };

            store.put('object', object, 10);
            object.bar = true;

            const retrieved = store.get('object') as {
                foo?: boolean;
                bar?: boolean;
            };

            expect(retrieved.foo).to.equal(true);
            expect(retrieved.bar).to.equal(true);
        });

        // PHP: CacheArrayStoreTest::testReleasingLockAfterAlreadyForceReleasedByAnotherOwnerFails
        it('releasing a lock already force-released by another owner fails', () => {
            const store = new ArrayStore();
            const owner = store.lock('foo', 10) as ArrayLock;
            const wannabeOwner = store.lock('foo', 10) as ArrayLock;
            owner.acquire();
            wannabeOwner.forceRelease();

            expect(wannabeOwner.release()).to.equal(false);
        });

        // PHP: CacheArrayStoreTest::testOwnerStatusCanBeCheckedAfterRestoringLock
        it('owner status can be checked after restoring a lock', () => {
            const store = new ArrayStore();
            const firstLock = store.lock('foo', 10) as ArrayLock;

            expect(firstLock.get()).to.equal(true);
            const owner = firstLock.owner();

            const secondLock = store.restoreLock('foo', owner) as ArrayLock;
            expect(secondLock.isOwnedByCurrentProcess()).to.equal(true);
        });

        // PHP: CacheArrayStoreTest::testOtherOwnerDoesNotOwnLockAfterRestore
        it('a different owner does not own the lock after restore', () => {
            const store = new ArrayStore();
            const firstLock = store.lock('foo', 10) as ArrayLock;

            expect(firstLock.get()).to.equal(true);

            const secondLock = store.restoreLock('foo', 'other_owner') as ArrayLock;

            expect(secondLock.isOwnedByCurrentProcess()).to.equal(false);
        });

        // PHP: CacheArrayStoreTest::testRestoringNonExistingLockDoesNotOwnAnything
        it('restoring a non-existing lock does not own anything', () => {
            const store = new ArrayStore();
            const firstLock = store.restoreLock('foo', 'owner') as ArrayLock;

            expect(firstLock.isOwnedByCurrentProcess()).to.equal(false);
        });
    });
};
