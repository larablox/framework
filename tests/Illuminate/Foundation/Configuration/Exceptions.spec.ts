/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Exceptions } from "Illuminate/Foundation/Configuration/Exceptions";
import { Handler } from "Illuminate/Foundation/Exceptions/Handler";
import { HttpException } from "Illuminate/Http/Exceptions/HttpException";
import type { AbstractClass } from "Illuminate/Container/Types";

/**
 * PHP: `Illuminate\Tests\Foundation\Configuration\ExceptionsTest`.
 *
 * `testShouldRenderJsonWhen` is not ported: it reaches `Handler::shouldReturnJson()`
 * through a bound closure (`(fn () => $this->shouldReturnJson(...))->call($exceptions->handler)`)
 * to prove `shouldRenderJsonWhen()` changes its answer -- `Exceptions.ts`'s
 * class comment explains why neither exists here: "`shouldRenderJsonWhen()`
 * (every response is data already)". PHP's HTML/JSON fork collapsed into the
 * one branch a remote takes.
 *
 * `testStopIgnoring` also used a PHP anonymous class subclassing `Handler` to
 * expose `$dontReport`/`$internalDontReport` for inspection; `ExposedHandler`
 * below does the same with a public method, reading the (renamed, per
 * `CLAUDE.md`) `dontReportTypes`/`internalDontReport` protected fields
 * directly -- ordinary protected access from a subclass in the same module,
 * not reflection. PHP's second assertion pair (`ModelNotFoundException`) is
 * dropped: Eloquent is not ported, so there is no such class to ignore or
 * stop ignoring.
 */
export = (): void => {
    describe("Foundation.Configuration.Exceptions", () => {
        class ExposedHandler extends Handler {
            public getDontReport(): Array<AbstractClass> {
                return [...this.dontReportTypes, ...this.internalDontReport];
            }
        }

        it("stopIgnoring() removes a class from both dontReport lists (adapted -- see class comment)", () => {
            // PHP: ExceptionsTest::testStopIgnoring
            const container = new Container();
            const handler = new ExposedHandler(container);
            let exceptions = new Exceptions(handler);

            expect(handler.getDontReport().includes(HttpException)).to.equal(true);

            exceptions = exceptions.stopIgnoring(HttpException);
            expect(exceptions instanceof Exceptions).to.equal(true);
            expect(handler.getDontReport().includes(HttpException)).to.equal(false);
        });
    });
};
