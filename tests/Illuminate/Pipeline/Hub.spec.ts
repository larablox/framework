/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';
import { Hub } from 'Illuminate/Pipeline/Hub';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Pipeline } from 'Illuminate/Pipeline/Pipeline';
import type { Passable } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `Illuminate\Tests\Pipeline\HubTest`.
 *
 * Ported in full -- all three PHP tests translate directly.
 *
 * `testPipeThrowsExceptionForUndefinedPipeline` was ported as upstream
 * specifies it rather than as `Hub.ts` then behaved -- it answered
 * `undefined` for an unknown pipeline name instead of throwing -- and the
 * gap it exposed is fixed.
 */
export = (): void => {
    describe('Hub', () => {
        let hub: Hub;

        beforeEach(() => {
            hub = new Hub(new Container());
        });

        it('sends an object through the default pipeline', () => {
            // PHP: HubTest::testPipeSendsObjectThroughDefaultPipeline
            hub.defaults((pipeline: Pipeline, object: Passable) => pipeline.send(object).through([]).thenReturn());

            expect(hub.pipe('foo')).to.equal('foo');
        });

        it('sends an object through a named pipeline', () => {
            // PHP: HubTest::testPipeSendsObjectThroughNamedPipeline
            hub.pipeline(
                'named',
                (pipeline: Pipeline, object: Passable) => pipeline.send(object).through([]).thenReturn(),
            );

            expect(hub.pipe('foo', 'named')).to.equal('foo');
        });

        it("an empty pipeline name falls back to the default, PHP's ?: semantics", () => {
            // No upstream twin: pins $pipeline = $pipeline ?: 'default' --
            // '' and '0' are falsy in PHP, so both reach the default pipeline
            // instead of throwing.
            hub.defaults((pipeline: Pipeline, object: Passable) => pipeline.send(object).through([]).thenReturn());

            expect(hub.pipe('foo', '')).to.equal('foo');
            expect(hub.pipe('foo', '0')).to.equal('foo');
        });

        it('throws for an undefined pipeline', () => {
            // PHP: HubTest::testPipeThrowsExceptionForUndefinedPipeline
            const [ok, err] = pcall(() => hub.pipe('foo', 'missing'));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
            expect((err as InvalidArgumentException).getMessage()).to.equal('Pipeline [missing] is not defined.');
        });
    });
};
