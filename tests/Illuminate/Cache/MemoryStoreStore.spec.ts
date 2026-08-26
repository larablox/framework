/// <reference types="@rbxts/testez/globals" />
import {
    MAX_EXPIRATION,
    MemoryStoreStore,
} from "Illuminate/Cache/MemoryStoreStore";
import { MemoryStoreLock } from "Illuminate/Cache/MemoryStoreLock";

/**
 * PHP: `Illuminate\Tests\Cache\CacheRedisStoreTest`.
 *
 * Upstream mocks the `Redis` connection and asserts the exact wire command
 * each `RedisStore` method issues (`setex`, `incrby`, `expire`, `flushdb`,
 * ...). `MemoryStoreStore.ts` talks to `MemoryStoreService` instead, over
 * `UpdateAsync`/`GetAsync`/`SetAsync`/`RemoveAsync` -- there is no
 * command-level wire protocol to assert against, and no mocking framework to
 * fake one with (see `Repository.spec.ts`'s class comment). Every case below
 * exercises the real store against `MemoryStoreService` -- a real Roblox
 * service, reachable only from a running Studio session with API access
 * enabled -- and asserts the round-tripped behaviour instead of the call
 * upstream mocks. Each test uses its own `mapName`, generated from `HttpService`'s
 * `GenerateGUID`, so tests never see each other's keys even though the map is
 * shared across the whole `MemoryStoreService`.
 *
 * `MemoryStoreStore.ts`'s class comment documents three platform-forced
 * divergences from `RedisStore`, each covered by a case below:
 *
 * - `forever()` stores for `MAX_EXPIRATION` (45 days), the longest
 *   MemoryStore allows, not literally forever -- `testStoreItemForeverProperlyCallsRedis`
 *   is adapted to assert that ceiling instead of an unbounded `set()`.
 * - `flush()` answers `false` -- MemoryStore has no "delete everything" call
 *   -- where `testFlushesCached` expects `true`. Adapted below.
 * - Values are serialized (numbers stay raw for `increment()`/`decrement()`),
 *   matching `RedisStore`'s own `serialize()`/numeric special case, so
 *   `testRedisValueIsReturnedForNumerics`/`testSetMethodProperlyCallsRedisForNumerics`
 *   port directly.
 *
 * Not ported, no equivalent in this port: `getRedis()`/`setPrefix()`/multiple
 * Redis connections (`testGetAndSetPrefix` -- the prefix here is set once
 * through the constructor, already exercised by every case below scoping its
 * key through a fresh store), `setLockConnection()`/`flushLocks()`
 * (`testFlushesCachedLocks` -- `MemoryStoreStore` has no separate lock
 * connection, locks live in the same map as values, see `lockMap()`), and
 * `putMany`'s Redis `multi`/`exec` transaction framing
 * (`testSetMultipleMethodProperlyCallsRedis` -- `putMany()` here just loops
 * `put()`, already covered by `many()`'s round trip below).
 */

const HttpService = game.GetService("HttpService");

/**
 * How long a value with no explicit TTL lives.
 *
 * Not `MAX_EXPIRATION`, which is what `MemoryStoreStore` defaults to: the
 * universe's MemoryStore quota is 64 KB, it is shared with the running game,
 * and every run here writes under a map name of its own -- so a 45-day
 * default means each run's leavings hold their share of that quota for a
 * month and a half. After enough runs `SetAsync` starts answering
 * `TotalMemoryOverLimit` and every test below fails for a reason that has
 * nothing to do with the code. Long enough for a test, short enough to be
 * gone before the next run needs the room.
 */
const EXPIRATION = 30;

/** A fresh store, isolated from every other test by a random map name. */
function freshStore(prefix = ""): MemoryStoreStore {
    return new MemoryStoreStore(
        HttpService.GenerateGUID(false),
        prefix,
        EXPIRATION,
    );
}

export = (): void => {
    describe("MemoryStoreStore", () => {
        // PHP: CacheRedisStoreTest::testGetReturnsNullWhenNotFound
        it("get() returns undefined for a key that was never set", () => {
            const store = freshStore();

            expect(store.get("foo")).to.equal(undefined);
        });

        // PHP: CacheRedisStoreTest::testRedisValueIsReturned
        it("a put() value round-trips through get()", () => {
            const store = freshStore("prefix:");

            expect(store.put("foo", "foo", 60)).to.equal(true);
            expect(store.get("foo")).to.equal("foo");
        });

        // PHP: CacheRedisStoreTest::testRedisMultipleValuesAreReturned
        it("many() reads several keys, undefined for the ones never set", () => {
            const store = freshStore();
            store.put("foo", "bar", 60);
            store.put("fizz", "buzz", 60);
            store.put("norf", "quz", 60);

            const results = store.many(["foo", "fizz", "norf", "null"]);

            expect(results.get("foo")).to.equal("bar");
            expect(results.get("fizz")).to.equal("buzz");
            expect(results.get("norf")).to.equal("quz");
            expect(results.get("null")).to.equal(undefined);
        });

        // PHP: CacheRedisStoreTest::testRedisValueIsReturnedForNumerics /
        // testSetMethodProperlyCallsRedisForNumerics
        it("numeric values are stored and returned raw, not serialized", () => {
            const store = freshStore();

            expect(store.put("foo", 1, 60)).to.equal(true);
            expect(store.get("foo")).to.equal(1);
        });

        // PHP: CacheRedisStoreTest::testIncrementMethodProperlyCallsRedis
        it("increment() adds to a stored numeric value", () => {
            const store = freshStore();
            store.put("foo", 10, 60);

            expect(store.increment("foo", 5)).to.equal(15);
        });

        // PHP: CacheRedisStoreTest::testDecrementMethodProperlyCallsRedis
        it("decrement() subtracts from a stored numeric value", () => {
            const store = freshStore();
            store.put("foo", 10, 60);

            expect(store.decrement("foo", 5)).to.equal(5);
        });

        // PHP: CacheRedisStoreTest::testStoreItemForeverProperlyCallsRedis
        // (adapted -- `forever()` stores for `MAX_EXPIRATION`, not literally
        // forever, see class comment)
        it("forever() stores the value, capped at MAX_EXPIRATION rather than unbounded (divergence from upstream)", () => {
            const store = freshStore();

            expect(store.forever("foo", "foo")).to.equal(true);
            expect(store.get("foo")).to.equal("foo");
            expect(store.maxExpiration()).to.equal(MAX_EXPIRATION);

            // The one write here that `EXPIRATION` cannot shorten -- 45 days
            // is what `forever()` means and what the assertion above is
            // about. Taken back by hand so it does not sit in the quota.
            store.forget("foo");
        });

        // PHP: CacheRedisStoreTest::testTouchMethodProperlyCallsRedis
        it("touch() extends the TTL of a live key", () => {
            const store = freshStore();
            store.put("key", "value", 60);

            expect(store.touch("key", 120)).to.equal(true);
            expect(store.get("key")).to.equal("value");
        });

        // PHP: no direct equivalent -- upstream's Redis mock has no failure
        // path for `touch()` on a missing key; `MemoryStoreStore.touch()`
        // reads before writing (see its own comment) and this is the natural
        // case that read covers.
        it("touch() on a never-set key fails", () => {
            const store = freshStore();

            expect(store.touch("never-set", 60)).to.equal(false);
        });

        // PHP: CacheRedisStoreTest::testForgetMethodProperlyCallsRedis
        it("forget() removes the key", () => {
            const store = freshStore();
            store.put("foo", "bar", 60);

            expect(store.forget("foo")).to.equal(true);
            expect(store.get("foo")).to.equal(undefined);
        });

        // PHP: CacheRedisStoreTest::testFlushesCached (adapted -- `flush()`
        // answers `false`, see class comment)
        it("flush() answers false: MemoryStore has no delete-everything call (divergence from upstream)", () => {
            const store = freshStore();

            expect(store.flush()).to.equal(false);
        });

        // PHP: no direct equivalent -- `add()` has no Redis-mock counterpart in
        // this file (Redis's `SETNX` isn't exercised there), but it is the
        // compare-and-set `Repository::add()`/rate limiting depend on
        // (`agent_docs/laravel-parity.md`'s "Cache: MemoryStore РєР°Рє Redis").
        it("add() only writes when the key is absent", () => {
            const store = freshStore();

            expect(store.add("foo", "first", 60)).to.equal(true);
            expect(store.add("foo", "second", 60)).to.equal(false);
            expect(store.get("foo")).to.equal("first");
        });

        // PHP: no direct equivalent -- exercises `MemoryStoreLock` the way
        // `ArrayStore.spec.ts`'s lock cases exercise `ArrayLock`, over the
        // same `UpdateAsync` compare-and-set `laravel-parity.md` documents for
        // this store.
        it("a lock cannot be acquired twice, and can be acquired again once released", () => {
            const store = freshStore();
            const lock = store.lock("a-lock", 60) as MemoryStoreLock;

            expect(lock.acquire()).to.equal(true);
            expect(lock.acquire()).to.equal(false);
            expect(lock.release()).to.equal(true);
            expect(lock.acquire()).to.equal(true);
        });

        // PHP: no direct equivalent -- same ownership contract
        // `ArrayStore.spec.ts::testAnotherOwnerCannotReleaseLock` exercises,
        // over `MemoryStoreLock`.
        it("another owner cannot release a lock it does not own", () => {
            const store = freshStore();
            const owner = store.lock("shared-lock", 60) as MemoryStoreLock;
            const wannabeOwner = store.lock(
                "shared-lock",
                60,
            ) as MemoryStoreLock;
            owner.acquire();

            expect(wannabeOwner.release()).to.equal(false);
            expect(wannabeOwner.forceRelease()).to.equal(undefined);
            expect(wannabeOwner.acquire()).to.equal(true);
        });
    });
};
