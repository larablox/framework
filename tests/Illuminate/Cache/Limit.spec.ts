/// <reference types="@rbxts/testez/globals" />
import { GlobalLimit } from "Illuminate/Cache/RateLimiting/GlobalLimit";
import { Limit } from "Illuminate/Cache/RateLimiting/Limit";

/**
 * PHP: `Illuminate\Tests\Cache\LimitTest`.
 *
 * `Limit.ts`'s own class comment already documents that `response()` is not
 * ported (it builds an HTTP response, and there are no requests here); that
 * has no test of its own upstream to skip. Everything in `testConstructors`
 * ports directly -- every named constructor and `GlobalLimit` exist with the
 * same argument order.
 */
export = (): void => {
    describe("Limit", () => {
        it("constructors compute maxAttempts/decaySeconds the same way PHP does", () => {
            // PHP: LimitTest::testConstructors
            let limit = new Limit("", 3, 1);
            expect(limit.decaySeconds).to.equal(1);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perSecond(3);
            expect(limit.decaySeconds).to.equal(1);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perSecond(3, 5);
            expect(limit.decaySeconds).to.equal(5);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perMinute(3);
            expect(limit.decaySeconds).to.equal(60);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perMinute(3, 4);
            expect(limit.decaySeconds).to.equal(240);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perMinutes(2, 3);
            expect(limit.decaySeconds).to.equal(120);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perHour(3);
            expect(limit.decaySeconds).to.equal(3600);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perHour(3, 2);
            expect(limit.decaySeconds).to.equal(7200);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perDay(3);
            expect(limit.decaySeconds).to.equal(86400);
            expect(limit.maxAttempts).to.equal(3);

            limit = Limit.perDay(3, 5);
            expect(limit.decaySeconds).to.equal(432000);
            expect(limit.maxAttempts).to.equal(3);

            limit = new GlobalLimit(3);
            expect(limit.decaySeconds).to.equal(60);
            expect(limit.maxAttempts).to.equal(3);
        });
    });
};
