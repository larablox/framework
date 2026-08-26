/// <reference types="@rbxts/testez/globals" />
import { Container } from "Illuminate/Container/Container";
import { Hub } from "Illuminate/Pipeline/Hub";
import { InvalidArgumentException } from "Illuminate/Exception";
import { Pipeline } from "Illuminate/Pipeline/Pipeline";
import type { Passable } from "Illuminate/Contracts/Pipeline/Pipeline";

/**
 * PHP: `Illuminate\Tests\Pipeline\HubTest`.
 *
 * Ported in full -- all three PHP tests translate directly.
 *
 * `testPipeThrowsExceptionForUndefinedPipeline` is kept faithful to
 * upstream's contract, not to this port's current behavior: `Hub.pipe()`
 * (`Hub.ts`) does not actually throw for an undefined pipeline name -- it
 * silently returns `undefined` instead (`if (builder === undefined) { return
 * undefined; }`), whereas PHP's `Hub::pipe()` throws
 * `InvalidArgumentException("Pipeline [{$name}] is not defined.")`. This is
 * not a documented platform limitation (unlike, say, `Pipeline`'s
 * `withinTransaction()`), just a gap in `Hub.ts` -- so, per this repo's
 * testing philosophy (`agent_docs/testing.md`'s Monolog counterpart: "Real
 * bugs this suite has already caught"), the test is ported as upstream
 * specifies it and is expected to fail against `Hub.ts` as it stands today,
 * rather than being quietly rewritten to match the gap.
 */
export = (): void => {
    describe("Hub", () => {
        let hub: Hub;

        beforeEach(() => {
            hub = new Hub(new Container());
        });

        it("sends an object through the default pipeline", () => {
            // PHP: HubTest::testPipeSendsObjectThroughDefaultPipeline
            hub.defaults((pipeline: Pipeline, object: Passable) =>
                pipeline.send(object).through([]).thenReturn(),
            );

            expect(hub.pipe("foo")).to.equal("foo");
        });

        it("sends an object through a named pipeline", () => {
            // PHP: HubTest::testPipeSendsObjectThroughNamedPipeline
            hub.pipeline("named", (pipeline: Pipeline, object: Passable) =>
                pipeline.send(object).through([]).thenReturn(),
            );

            expect(hub.pipe("foo", "named")).to.equal("foo");
        });

        it("throws for an undefined pipeline", () => {
            // PHP: HubTest::testPipeThrowsExceptionForUndefinedPipeline
            // (see class comment -- this currently fails against Hub.ts)
            const [ok, err] = pcall(() => hub.pipe("foo", "missing"));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
            expect((err as InvalidArgumentException).getMessage()).to.equal(
                "Pipeline [missing] is not defined.",
            );
        });
    });
};
