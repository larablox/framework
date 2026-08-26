/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../TestHelpers";
import { Repository } from "Illuminate/Cache/Repository";
import type { Store } from "Illuminate/Contracts/Cache/Store";

/**
 * A minimal `Store` implementation that records every call and lets a test
 * choose what each method returns -- this codebase has no mocking framework,
 * so this stands in everywhere upstream uses `m::mock(Store::class)` /
 * `$repo->getStore()->shouldReceive(...)`. `getReturns` answers per-key, the
 * way `->with('foo')->andReturn('bar')` picks an answer by argument;
 * `defaultGetReturn` covers the `->andReturn(null)` calls that don't care
 * which key was asked for.
 */
class FakeStore implements Store {
    public getCalls = new Array<string>();
    public getReturns = new Map<string, unknown>();
    public defaultGetReturn: unknown = undefined;

    public manyCalls = new Array<Array<string>>();

    public putCalls = new Array<[string, unknown, number]>();
    public putReturn = true;

    public putManyCalls = new Array<[Map<string, unknown>, number]>();

    public incrementCalls = new Array<[string, number]>();
    public incrementReturn: number | false = false;

    public decrementCalls = new Array<[string, number]>();
    public decrementReturn: number | false = false;

    public foreverCalls = new Array<[string, unknown]>();
    public foreverReturn = true;

    public touchCalls = new Array<[string, number]>();
    public touchReturn = true;

    public forgetCalls = new Array<string>();
    public forgetReturn = true;

    public flushCalls = 0;
    public flushReturn = true;

    public get(key: string): unknown {
        this.getCalls.push(key);

        return this.getReturns.has(key)
            ? this.getReturns.get(key)
            : this.defaultGetReturn;
    }

    public many(keys: Array<string>): Map<string, unknown> {
        this.manyCalls.push(keys);

        const values = new Map<string, unknown>();

        for (const key of keys) {
            values.set(key, this.get(key));
        }

        return values;
    }

    public put(key: string, value: unknown, seconds: number): boolean {
        this.putCalls.push([key, value, seconds]);

        return this.putReturn;
    }

    public putMany(values: Map<string, unknown>, seconds: number): boolean {
        this.putManyCalls.push([values, seconds]);

        return true;
    }

    public increment(key: string, value = 1): number | false {
        this.incrementCalls.push([key, value]);

        return this.incrementReturn;
    }

    public decrement(key: string, value = 1): number | false {
        this.decrementCalls.push([key, value]);

        return this.decrementReturn;
    }

    public forever(key: string, value: unknown): boolean {
        this.foreverCalls.push([key, value]);

        return this.foreverReturn;
    }

    public touch(key: string, seconds: number): boolean {
        this.touchCalls.push([key, seconds]);

        return this.touchReturn;
    }

    public forget(key: string): boolean {
        this.forgetCalls.push(key);

        return this.forgetReturn;
    }

    public flush(): boolean {
        this.flushCalls++;

        return this.flushReturn;
    }

    public getPrefix(): string {
        return "";
    }
}

/**
 * PHP: `RedisStore`/similar stores whose `add()` is called directly, rather
 * than `Repository::add()` falling back to `get()`+`put()`. `Store` here has
 * no `add()` of its own (see `Contracts/Cache/Store.ts`); `Repository.add()`
 * probes for one dynamically, exactly the way PHP tests distinguish a store
 * mock that defines `add` from one that does not.
 */
class FakeStoreWithAdd extends FakeStore {
    public addCalls = new Array<[string, unknown, number]>();
    public addReturn = true;

    public add(key: string, value: unknown, seconds: number): boolean {
        this.addCalls.push([key, value, seconds]);

        return this.addReturn;
    }
}

/**
 * PHP: `Illuminate\Tests\Cache\CacheRepositoryTest`.
 *
 * No `Carbon::setTestNow()` seam here (see `ArrayStore.spec.ts`'s class
 * comment) -- wherever upstream drives a scenario through a frozen clock,
 * the tests below use a real `DateTime` built from `os.time()` at call time.
 * `Repository.ts`'s `Ttl` is `number | DateTime | undefined` (see
 * `Support/InteractsWithTime.ts`); there is no `DateInterval` counterpart, so
 * every `DateInterval`-based case below is skipped with a note at the
 * matching seconds-only/`DateTime`-based case that already covers the same
 * `getSeconds()` mechanics.
 *
 * Not ported outright, no equivalent in this port's `Repository.ts` (see its
 * own class comment for the same list): `get()`/`put()` accepting an array of
 * keys or a key => value map (`testGetReturnsMultipleValuesFromCache*`,
 * `testPuttingMultipleItemsInCache`, `testPutManyWithNullTTLRemembersItemsForever`),
 * the PSR-16 surface beyond `set`/`delete`/`clear`
 * (`testSettingMultipleItemsInCache*`, `testGettingMultipleValuesFromCache`,
 * `testRemovingMultipleKeys*`), tags (`testAllTagsArePassedToTaggableStore`,
 * `testItThrowsExceptionWhenStoreDoesNotSupportTags`,
 * `testTagMethodReturnsTaggedCache`, `testPossibleInputTypesToTags`,
 * `testEventDispatcherIsPassedToStoreFromRepository`,
 * `testDefaultCacheLifeTimeIsSetOnTaggableStore`, `testTaggedCacheWorksWithEnumKey`),
 * `flushLocks()`/`supportsTags()`/`supportsFlushingLocks()`
 * (`testFlushLocksDelegatesToStore`, `testTaggableRepositoriesSupportTags`,
 * `testNonTaggableRepositoryDoesNotSupportTags`,
 * `testFlushableLockRepositorySupportsFlushingLocks`,
 * `testNonFlushableLockRepositoryDoesNotSupportFlushingLocks`,
 * `testItThrowsExceptionWhenStoreDoesNotSupportFlushingLocks`), `macro()`
 * (`testRegisterMacroWithNonStaticCall`), `rememberWithWarmth()`
 * (`testRememberWithWarmthReturnsCachedValue`,
 * `testRememberWithWarmthCallsPutAndReturnsDefault`), `withoutOverlapping()`
 * (`testAtomicExecutesCallbackAndReturnsResult`,
 * `testAtomicPassesLockAndWaitSecondsToLock`, `testAtomicPassesOwnerToLock`,
 * `testAtomicThrowsOnLockTimeout`), `handleUnserializableClassUsing()` and
 * PHP's `__PHP_Incomplete_Class` (`testGetReturnsIncompleteClassWhenNoHandlerRegistered`,
 * `testGetCallsHandlerWithKeyAndClassForIncompleteClass`,
 * `testManyCallsHandlerForEachIncompleteClass`), `float()`
 * (`testItGetsAsFloat`, `testItGetsAsFloatWithDefault`,
 * `testItGetsAsFloatFromNumericString`, `testItThrowsExceptionWhenGettingNonFloatAsFloat`
 * -- `Repository.ts`'s class comment explains why), and PHP backed enum keys
 * (`testTouchWorksWithEnumKey` -- a key here is already a plain string, with
 * no separate enum-key form to distinguish it from).
 *
 * Several typed getters (`string()`/`integer()`/`boolean()`/`array()`) throw
 * `InvalidArgumentException` upstream on a type mismatch; this port's
 * versions coerce permissively instead (`tostring()`, `tonumber() ?? 0`,
 * a truthy/`"true"`/`1` check, and a `typeIs(..., "table")` check that falls
 * back to `[]`). The four `testItThrowsExceptionWhenGetting...` cases below
 * are adapted to assert what the code actually returns instead of an
 * exception, each said so at the point of the assertion.
 */
export = (): void => {
    describe("Repository", () => {
        // PHP: CacheRepositoryTest::testGetReturnsValueFromCache
        it("get() returns the value from the store", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "bar");
            const repo = new Repository(store);

            expect(repo.get("foo")).to.equal("bar");
            expectDeepEqual(store.getCalls, ["foo"]);
        });

        // PHP: CacheRepositoryTest::testDefaultValueIsReturned
        it("get() falls back to the default value, or calls it if it is a function", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.get("foo", "bar")).to.equal("bar");
            expect(repo.get("boom", () => "baz")).to.equal("baz");
        });

        // PHP: CacheRepositoryTest::testSettingDefaultCacheTime
        it("the default cache time can be set and read back", () => {
            const store = new FakeStore();
            const repo = new Repository(store);
            repo.setDefaultCacheTime(10);

            expect(repo.getDefaultCacheTime()).to.equal(10);
        });

        // PHP: CacheRepositoryTest::testHasMethod
        it("has() is true whenever get() answers anything but undefined", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", undefined);
            store.getReturns.set("bar", "bar");
            store.getReturns.set("baz", false);
            const repo = new Repository(store);

            expect(repo.has("bar")).to.equal(true);
            expect(repo.has("foo")).to.equal(false);
            expect(repo.has("baz")).to.equal(true);
        });

        // PHP: CacheRepositoryTest::testMissingMethod
        it("missing() is the inverse of has()", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", undefined);
            store.getReturns.set("bar", "bar");
            const repo = new Repository(store);

            expect(repo.missing("foo")).to.equal(true);
            expect(repo.missing("bar")).to.equal(false);
        });

        // PHP: CacheRepositoryTest::testRememberMethodCallsPutAndReturnsDefault
        // ("Use a callable..." variant not ported: `Ttl` has no callable form,
        // see class comment)
        it("remember() calls put() with the resolved seconds and returns the fresh value", () => {
            let store = new FakeStore();
            let repo = new Repository(store);
            let result = repo.remember("foo", 10, () => "bar");

            expect(result).to.equal("bar");
            expect(store.putCalls.size()).to.equal(1);
            expectDeepEqual(store.putCalls[0], ["foo", "bar", 10]);

            store = new FakeStore();
            repo = new Repository(store);
            const inTenMinutesTwoSeconds = DateTime.fromUnixTimestamp(
                os.time() + 602,
            );
            const inTenMinutesLessTwoSeconds = DateTime.fromUnixTimestamp(
                os.time() + 598,
            );

            result = repo.remember("foo", inTenMinutesTwoSeconds, () => "bar");
            expect(result).to.equal("bar");

            const secondResult = repo.remember(
                "baz",
                inTenMinutesLessTwoSeconds,
                () => "qux",
            );
            expect(secondResult).to.equal("qux");

            expect(store.putCalls.size()).to.equal(2);
            expectDeepEqual(store.putCalls[0], ["foo", "bar", 602]);
            expectDeepEqual(store.putCalls[1], ["baz", "qux", 598]);
        });

        // PHP: CacheRepositoryTest::testRememberForeverMethodCallsForeverAndReturnsDefault
        it("rememberForever() calls forever() and returns the fresh value", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            const result = repo.rememberForever("foo", () => "bar");

            expect(result).to.equal("bar");
            expect(store.foreverCalls.size()).to.equal(1);
            expectDeepEqual(store.foreverCalls[0], ["foo", "bar"]);
        });

        // PHP: CacheRepositoryTest::testPutWithNullTTLRemembersItemForever
        it("put() with no TTL stores the item forever", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.put("foo", "bar")).to.equal(true);
            expect(store.foreverCalls.size()).to.equal(1);
            expectDeepEqual(store.foreverCalls[0], ["foo", "bar"]);
        });

        // PHP: CacheRepositoryTest::testPutWithDatetimeInPastOrZeroSecondsRemovesOldItem
        it("put() with a TTL in the past or at now removes the old item instead", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            const tenMinutesAgo = DateTime.fromUnixTimestamp(os.time() - 600);
            const now = DateTime.fromUnixTimestamp(os.time());

            expect(repo.put("foo", "bar", tenMinutesAgo)).to.equal(true);
            expect(repo.put("foo", "bar", now)).to.equal(true);

            expect(store.putCalls.size()).to.equal(0);
            expectDeepEqual(store.forgetCalls, ["foo", "foo"]);
        });

        // PHP: CacheRepositoryTest::testAddWithStoreFailureReturnsFalse
        it("add() falls back to get()+put() when the store has no add(), and fails when put() fails", () => {
            const store = new FakeStore();
            store.putReturn = false;
            const repo = new Repository(store);

            expect(repo.add("foo", "bar", 60)).to.equal(false);
        });

        // PHP: CacheRepositoryTest::testCacheAddCallsRedisStoreAdd
        it("add() calls the store's own add() directly when it has one", () => {
            const store = new FakeStoreWithAdd();
            const repo = new Repository(store);

            expect(repo.add("k", "v", 60)).to.equal(true);
            expect(store.addCalls.size()).to.equal(1);
            expectDeepEqual(store.addCalls[0], ["k", "v", 60]);
        });

        // PHP: CacheRepositoryTest::testAddMethodCanAcceptDateIntervals
        // (not ported -- no `DateInterval` here, see class comment; covered
        // for a plain-seconds TTL by the store-without-add half of this test)
        //
        // PHP: CacheRepositoryTest::testAddMethodCanAcceptDateTimeInterface
        it("add() accepts a DateTime TTL, on a store with add() and one without", () => {
            const storeWithAdd = new FakeStoreWithAdd();
            const repoWithAdd = new Repository(storeWithAdd);

            expect(
                repoWithAdd.add(
                    "k",
                    "v",
                    DateTime.fromUnixTimestamp(os.time() + 61),
                ),
            ).to.equal(true);
            expect(storeWithAdd.addCalls.size()).to.equal(1);
            expectDeepEqual(storeWithAdd.addCalls[0], ["k", "v", 61]);

            const storeWithoutAdd = new FakeStore();
            const repoWithoutAdd = new Repository(storeWithoutAdd);

            expect(
                repoWithoutAdd.add(
                    "k",
                    "v",
                    DateTime.fromUnixTimestamp(os.time() + 62),
                ),
            ).to.equal(true);
            expectDeepEqual(storeWithoutAdd.getCalls, ["k"]);
            expect(storeWithoutAdd.putCalls.size()).to.equal(1);
            expectDeepEqual(storeWithoutAdd.putCalls[0], ["k", "v", 62]);
        });

        // PHP: CacheRepositoryTest::testAddWithNullTTLRemembersItemForever
        it("add() with no TTL stores the item forever when the key is absent", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.add("foo", "bar")).to.equal(true);
            expectDeepEqual(store.getCalls, ["foo"]);
            expect(store.foreverCalls.size()).to.equal(1);
            expectDeepEqual(store.foreverCalls[0], ["foo", "bar"]);
        });

        // PHP: CacheRepositoryTest::testAddWithDatetimeInPastOrZeroSecondsReturnsImmediately
        it("add() with a TTL in the past, at now, or negative returns false immediately", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            const tenMinutesAgo = DateTime.fromUnixTimestamp(os.time() - 600);
            const now = DateTime.fromUnixTimestamp(os.time());

            expect(repo.add("foo", "bar", tenMinutesAgo)).to.equal(false);
            expect(repo.add("foo", "bar", now)).to.equal(false);
            expect(repo.add("foo", "bar", -1)).to.equal(false);

            expect(store.getCalls.size()).to.equal(0);
            expect(store.putCalls.size()).to.equal(0);
        });

        // PHP: CacheRepositoryTest::testGetSeconds (data provider: only the
        // `int`/`DateTime` cases port -- `DateTimeImmutable` exercises the
        // same `Delay` branch as `DateTime`, and `DateInterval` has no
        // counterpart, see class comment)
        it("put() resolves a plain number of seconds and a DateTime the same way", () => {
            let store = new FakeStore();
            let repo = new Repository(store);
            repo.put("foo", "bar", 300);
            expect(store.putCalls.size()).to.equal(1);
            expectDeepEqual(store.putCalls[0], ["foo", "bar", 300]);

            store = new FakeStore();
            repo = new Repository(store);
            repo.put("foo", "bar", DateTime.fromUnixTimestamp(os.time() + 300));
            expect(store.putCalls.size()).to.equal(1);
            expectDeepEqual(store.putCalls[0], ["foo", "bar", 300]);
        });

        // PHP: CacheRepositoryTest::testForgettingCacheKey
        it("forget() proxies to the store", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            repo.forget("a-key");

            expectDeepEqual(store.forgetCalls, ["a-key"]);
        });

        // PHP: CacheRepositoryTest::testRemovingCacheKey
        it("delete() is an alias of forget()", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            repo.delete("a-key");

            expectDeepEqual(store.forgetCalls, ["a-key"]);
        });

        // PHP: CacheRepositoryTest::testSettingCache
        it("set() proxies to put()", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            const result = repo.set("foo", "bar", 1);

            expect(result).to.equal(true);
            expect(store.putCalls.size()).to.equal(1);
            expectDeepEqual(store.putCalls[0], ["foo", "bar", 1]);
        });

        // PHP: CacheRepositoryTest::testClearingWholeCache
        it("clear() proxies to flush()", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            repo.clear();

            expect(store.flushCalls).to.equal(1);
        });

        // PHP: CacheRepositoryTest::testTouchWithSecondsTtlCorrectlyProxiesToStore
        it("touch() with a seconds TTL proxies to the store", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.touch("key", 60)).to.equal(true);
            expect(store.touchCalls.size()).to.equal(1);
            expectDeepEqual(store.touchCalls[0], ["key", 60]);
        });

        // PHP: CacheRepositoryTest::testTouchWithDatetimeTtlCorrectlyProxiesToStore
        it("touch() with a DateTime TTL resolves it to seconds first", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            const now = DateTime.fromUnixTimestamp(os.time());

            expect(
                repo.touch(
                    "key",
                    DateTime.fromUnixTimestamp(now.UnixTimestamp + 60),
                ),
            ).to.equal(true);
            expect(store.touchCalls.size()).to.equal(1);
            expectDeepEqual(store.touchCalls[0], ["key", 60]);
        });

        // PHP: CacheRepositoryTest::testTouchWithDateIntervalTtlCorrectlyProxiesToStore
        // (not ported -- no `DateInterval` here, see class comment; the
        // seconds-resolution mechanics it exercises are already covered by
        // the seconds and DateTime cases above)
        //
        // PHP: CacheRepositoryTest::testTouchWithDatetimeInPastOrZeroSecondsRemovesOldItem
        // (adapted -- `Repository.touch()` here has no past/zero special
        // case the way `put()` does: it always calls `store.touch()` with
        // whatever `getSeconds()` resolves to, zero included, rather than
        // falling back to `forget()`. The test below asserts what the code
        // actually does.)
        it("touch() with a TTL in the past or at now calls store.touch() with zero seconds, rather than forgetting (divergence from upstream)", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(
                repo.touch("key", DateTime.fromUnixTimestamp(os.time() - 60)),
            ).to.equal(true);
            expect(repo.touch("key", 0)).to.equal(true);

            expect(store.touchCalls.size()).to.equal(2);
            expectDeepEqual(store.touchCalls[0], ["key", 0]);
            expectDeepEqual(store.touchCalls[1], ["key", 0]);
            expect(store.forgetCalls.size()).to.equal(0);
        });

        // PHP: CacheRepositoryTest::testItGetsAsString
        it("string() reads back a string value", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "bar");
            const repo = new Repository(store);

            expect(repo.string("foo")).to.equal("bar");
        });

        // PHP: CacheRepositoryTest::testItGetsAsStringWithDefault
        it("string() falls back to the default value", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.string("foo", "default")).to.equal("default");
        });

        // PHP: CacheRepositoryTest::testItThrowsExceptionWhenGettingNonStringAsString
        // (adapted -- `string()` here does not check the type, it just
        // `tostring()`s whatever it got; the test below asserts that.)
        it("string() stringifies a non-string value instead of throwing (divergence from upstream)", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", 123);
            const repo = new Repository(store);

            expect(repo.string("foo")).to.equal("123");
        });

        // PHP: CacheRepositoryTest::testItGetsAsInteger
        it("integer() reads back a number value", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", 123);
            const repo = new Repository(store);

            expect(repo.integer("foo")).to.equal(123);
        });

        // PHP: CacheRepositoryTest::testItGetsAsIntegerWithDefault
        it("integer() falls back to the default value", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.integer("foo", 456)).to.equal(456);
        });

        // PHP: CacheRepositoryTest::testItGetsAsIntegerFromNumericString
        it("integer() parses a numeric string", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "123");
            const repo = new Repository(store);

            expect(repo.integer("foo")).to.equal(123);
        });

        // PHP: CacheRepositoryTest::testItThrowsExceptionWhenGettingNonIntegerAsInteger
        // (adapted -- `integer()` here does not check the type, it just
        // `tonumber() ?? 0`s whatever it got; the test below asserts that.)
        it("integer() falls back to zero for a non-numeric value instead of throwing (divergence from upstream)", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "bar");
            const repo = new Repository(store);

            expect(repo.integer("foo")).to.equal(0);
        });

        // PHP: CacheRepositoryTest::testItThrowsExceptionWhenGettingFloatStringAsInteger
        // (adapted -- Luau has one numeric type, so there is no separate
        // "must be an integer, not a float" check; `integer()` parses the
        // numeric string and returns it as-is.)
        it("integer() parses a non-integer numeric string as a number instead of throwing (divergence from upstream)", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "1.5");
            const repo = new Repository(store);

            expect(repo.integer("foo")).to.equal(1.5);
        });

        // PHP: CacheRepositoryTest::testItGetsAsBoolean
        it("boolean() reads back a boolean value", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", true);
            const repo = new Repository(store);

            expect(repo.boolean("foo")).to.equal(true);
        });

        // PHP: CacheRepositoryTest::testItGetsAsBooleanWithDefault
        it("boolean() falls back to the default value", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expect(repo.boolean("foo", false)).to.equal(false);
        });

        // PHP: CacheRepositoryTest::testItThrowsExceptionWhenGettingNonBooleanAsBoolean
        // (adapted -- `boolean()` here does not check the type, it treats
        // anything that isn't `true`/`"true"`/`1` as false; the test below
        // asserts that.)
        it("boolean() treats a non-boolean value as false instead of throwing (divergence from upstream)", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "bar");
            const repo = new Repository(store);

            expect(repo.boolean("foo")).to.equal(false);
        });

        // PHP: CacheRepositoryTest::testItGetsAsArray
        it("array() reads back an array value", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", ["bar", "baz"]);
            const repo = new Repository(store);

            expectDeepEqual(repo.array("foo"), ["bar", "baz"]);
        });

        // PHP: CacheRepositoryTest::testItGetsAsArrayWithDefault
        it("array() falls back to the default value", () => {
            const store = new FakeStore();
            const repo = new Repository(store);

            expectDeepEqual(repo.array("foo", ["default"]), ["default"]);
        });

        // PHP: CacheRepositoryTest::testItThrowsExceptionWhenGettingNonArrayAsArray
        // (adapted -- `array()` here does not check the type, it answers an
        // empty array for anything that isn't a table; the test below
        // asserts that.)
        it("array() answers an empty array for a non-array value instead of throwing (divergence from upstream)", () => {
            const store = new FakeStore();
            store.getReturns.set("foo", "bar");
            const repo = new Repository(store);

            expect(repo.array("foo").size()).to.equal(0);
        });
    });
};
