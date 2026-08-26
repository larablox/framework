/// <reference types="@rbxts/testez/globals" />
import { ArrayStore } from "Illuminate/Cache/ArrayStore";
import { Limit } from "Illuminate/Cache/RateLimiting/Limit";
import { RateLimiter } from "Illuminate/Cache/RateLimiter";
import { Repository } from "Illuminate/Cache/Repository";

/**
 * PHP: `Illuminate\Tests\Cache\RateLimiterTest` and
 * `Illuminate\Tests\Cache\CacheRateLimiterTest`.
 *
 * No mocking framework here (see `Repository.spec.ts`'s class comment) --
 * `CacheRateLimiterTest`'s per-test `Cache` mock, wired with exact
 * `shouldReceive('add')->once()->with(...)` expectations on every call
 * `RateLimiter` makes, is replaced below with a real `Repository` over a real
 * `ArrayStore`: the tests assert the resulting cache state and return values
 * instead of the exact sequence of calls into the store, which is the same
 * "no mocks" substitute `ArrayStore.spec.ts`/`Repository.spec.ts` already
 * use.
 *
 * `RateLimiter.ts`'s class comment says `cleanRateLimiterKey()` does not
 * strip HTML entities the way PHP's does -- there is no HTML here. The two
 * PHP cases that rely on that stripping
 * (`testKeysAreSanitizedFromUnicodeCharacters`, `testKeyIsSanitizedOnlyOnce`)
 * are adapted below to assert the identity behaviour instead, each said so at
 * the point of the assertion.
 *
 * Not ported, no equivalent in this port: `testRegisterNamedRateLimiter`'s
 * `BackedEnum`/`UnitEnum`/`int` limiter names (`for()`/`limiter()` here take
 * a plain `string`, already covered by the `'yolo'` case, which is ported
 * below) and `testMacroable` (no `Macroable` trait on `RateLimiter.ts`).
 */
export = (): void => {
    describe("RateLimiter", () => {
        // PHP: RateLimiterTest::testRegisterNamedRateLimiter (only the plain-string
        // name case ports, see class comment)
        it("for() registers a named limiter that limiter() can look back up", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            limiter.for("yolo", () => Limit.perMinute(100));

            expect(limiter.limiter("yolo")).never.to.equal(undefined);
            expect(limiter.limiter("does-not-exist")).to.equal(undefined);
        });

        // PHP: RateLimiterTest::testShouldUseOriginKeyAsPrefixWhenMultipleLimiterWithSameKey
        it("two limits built by() distinct keys track attempts independently", () => {
            const cache = new Repository(new ArrayStore());
            const limiter = new RateLimiter(cache);

            limiter.for("user_limiter", (...args: Array<unknown>) => {
                const userId = args[0] as string;

                return [
                    Limit.perSecond(3).by(userId),
                    Limit.perMinute(5).by(userId),
                ];
            });

            const userId1 = "123";
            const userId2 = "456";

            const namedLimiter = limiter.limiter("user_limiter") as unknown as (
                ...args: Array<unknown>
            ) => Array<Limit>;
            const forUser1 = namedLimiter(userId1);
            const forUser2 = namedLimiter(userId2);

            for (let index = 0; index < 3; index++) {
                expect(
                    limiter.tooManyAttempts(
                        forUser1[0].key,
                        forUser1[0].maxAttempts,
                    ),
                ).to.equal(false);
                expect(
                    limiter.tooManyAttempts(
                        forUser2[0].key,
                        forUser2[0].maxAttempts,
                    ),
                ).to.equal(false);

                limiter.hit(forUser1[0].key, forUser1[0].decaySeconds);
                limiter.hit(forUser2[0].key, forUser2[0].decaySeconds);
            }

            expect(forUser1[0].key).never.to.equal(forUser2[0].key);
            expect(forUser1[1].key).never.to.equal(forUser2[1].key);
        });

        // PHP: CacheRateLimiterTest::testTooManyAttemptsReturnTrueIfAlreadyLockedOut
        it("tooManyAttempts() is true once the max is hit and the timer is still live", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            limiter.hit("key", 60);
            expect(limiter.tooManyAttempts("key", 1)).to.equal(true);
        });

        // PHP: CacheRateLimiterTest::testHitProperlyIncrementsAttemptCount
        it("hit() increments the attempt count and sets the lockout timer", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            expect(limiter.hit("key", 1)).to.equal(1);
            expect(limiter.attempts("key")).to.equal(1);
        });

        // PHP: CacheRateLimiterTest::testIncrementProperlyIncrementsAttemptCount
        it("increment() adds a custom amount to the attempt count", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            expect(limiter.increment("key", 1, 5)).to.equal(5);
        });

        // PHP: CacheRateLimiterTest::testDecrementProperlyDecrementsAttemptCount
        it("decrement() subtracts a custom amount from the attempt count", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            expect(limiter.decrement("key", 1, 5)).to.equal(-5);
        });

        // PHP: CacheRateLimiterTest::testHitHasNoMemoryLeak / testIncrementWithCustomAmountHasNoMemoryLeak
        // (adapted -- upstream asserts the exact fallback `put()` call a
        // Redis-style `INCR`-on-a-forever-key leak guard needs; `ArrayStore`
        // here has no such leak to guard against, since `increment()` on an
        // already-decayed key just re-creates it. The case below asserts the
        // count is right after the key has expired and hit() is called
        // again, which is the same ground under this store's own semantics.)
        it("hitting again after the key has decayed starts the count over", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            limiter.hit("key", 1);
            task.wait(1.2);

            expect(limiter.hit("key", 1)).to.equal(1);
        });

        // PHP: CacheRateLimiterTest::testRemainingIsNotNegative
        it("remaining()/retriesLeft() never go below zero", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            limiter.increment("key", 60, 5);

            expect(limiter.remaining("key", 3)).to.equal(0);
            expect(limiter.retriesLeft("key", 3)).to.equal(0);
        });

        // PHP: CacheRateLimiterTest::testRetriesLeftReturnsCorrectCount
        it("retriesLeft() is maxAttempts minus the current attempt count", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            limiter.increment("key", 60, 3);

            expect(limiter.retriesLeft("key", 5)).to.equal(2);
        });

        // PHP: CacheRateLimiterTest::testClearClearsTheCacheKeys
        it("clear() forgets both the attempt key and its timer", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            limiter.hit("key", 60);
            limiter.clear("key");

            expect(limiter.attempts("key")).to.equal(0);
            expect(limiter.availableIn("key")).to.equal(0);
        });

        // PHP: CacheRateLimiterTest::testAvailableInReturnsPositiveValues
        it("availableIn() never goes negative once the timer has passed", () => {
            const cache = new Repository(new ArrayStore());
            const limiter = new RateLimiter(cache);

            cache.put("key:timer", os.time() - 60, 60);

            expect(limiter.availableIn("key")).to.equal(0);
        });

        // PHP: CacheRateLimiterTest::testAttemptsCallbackReturnsTrue
        it("attempt() runs the callback and hits the limiter when under the max", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));
            let executed = false;

            const result = limiter.attempt(
                "key",
                1,
                () => {
                    executed = true;
                },
                1,
            );

            expect(executed).to.equal(true);
            expect(result).to.equal(true);
        });

        // PHP: CacheRateLimiterTest::testAttemptsCallbackReturnsCallbackReturn
        it("attempt() returns the callback's own return value when it is not undefined", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            expect(limiter.attempt("key", 5, () => "foo", 1)).to.equal("foo");
            expect(limiter.attempt("key", 5, () => false, 1)).to.equal(false);
            expect(limiter.attempt("key", 5, () => 0, 1)).to.equal(0);
            expect(limiter.attempt("key", 5, () => "", 1)).to.equal("");
        });

        // PHP: CacheRateLimiterTest::testAttemptsCallbackReturnsFalse
        it("attempt() returns false without running the callback once locked out", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));
            limiter.hit("key", 60);
            limiter.hit("key", 60);
            let executed = false;

            const result = limiter.attempt(
                "key",
                1,
                () => {
                    executed = true;
                },
                1,
            );

            expect(result).to.equal(false);
            expect(executed).to.equal(false);
        });

        // PHP: CacheRateLimiterTest::testKeysAreSanitizedFromUnicodeCharacters
        // (adapted -- `cleanRateLimiterKey()` here is the identity function,
        // see class comment; the test below asserts that directly, instead of
        // a Unicode key being stripped down to ASCII.)
        it("cleanRateLimiterKey() returns the key unchanged (divergence from upstream)", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            expect(limiter.cleanRateLimiterKey("jôhn")).to.equal("jôhn");
        });

        // PHP: CacheRateLimiterTest::testKeyIsSanitizedOnlyOnce (adapted, same reason)
        it("cleanRateLimiterKey() is idempotent", () => {
            const limiter = new RateLimiter(new Repository(new ArrayStore()));

            const key = "john'doe";
            const cleaned = limiter.cleanRateLimiterKey(key);

            expect(limiter.cleanRateLimiterKey(cleaned)).to.equal(cleaned);
            expect(cleaned).to.equal(key);
        });
    });
};
