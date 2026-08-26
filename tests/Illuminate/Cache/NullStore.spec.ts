/// <reference types="@rbxts/testez/globals" />
import { NullStore } from "Illuminate/Cache/NullStore";

/**
 * PHP: `Illuminate\Tests\Cache\CacheNullStoreTest`.
 *
 * `testLocksCanBeFlushed` and `testHasSeparateLockStore` are not ported:
 * they cover `flushLocks()`/`hasSeparateLockStore()`, methods `NullStore.ts`
 * does not have (its class comment documents it implements only `Store` and
 * `LockProvider`, the two contracts this port ships).
 */
export = (): void => {
    describe("NullStore", () => {
        // PHP: CacheNullStoreTest::testItemsCanNotBeCached
        it("never stores anything, so a written key still reads back undefined", () => {
            const store = new NullStore();
            store.put("foo", "bar", 10);

            expect(store.get("foo")).to.equal(undefined);
        });

        // PHP: CacheNullStoreTest::testGetMultipleReturnsMultipleNulls
        it("many() answers every key with undefined", () => {
            const store = new NullStore();

            const values = store.many(["foo", "bar"]);

            expect(values.get("foo")).to.equal(undefined);
            expect(values.get("bar")).to.equal(undefined);
        });

        // PHP: CacheNullStoreTest::testIncrementAndDecrementReturnFalse
        it("increment()/decrement() always answer false", () => {
            const store = new NullStore();

            expect(store.increment("foo")).to.equal(false);
            expect(store.decrement("foo")).to.equal(false);
        });

        // PHP: CacheNullStoreTest::testTouchReturnsFalse
        it("touch() always answers false", () => {
            expect(new NullStore().touch("foo", 30)).to.equal(false);
        });
    });
};
