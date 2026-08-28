/// <reference types="@rbxts/testez/globals" />
import { isPipeArray, isPipeWithParameters, wrapPipes } from 'Illuminate/Pipeline/helpers';
import type { Next } from 'Illuminate/Pipeline/Pipeline';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * No PHP twin: `Pipeline/helpers.ts` is a port-only module (its parity waiver
 * says why) -- PHP spells a parameterized pipe inside a single string
 * (`'Class:60,1'`), so the questions these functions answer never arise
 * upstream. What is pinned here is the platform contract the docblocks
 * promise, including the documented heuristic edge: a two-entry list
 * `[ClassPipe, 'bindingName']` reads as one parameterized pipe, not two pipes.
 */
class HelpersSpecPipe
{
    public handle(piped: unknown, _next: Next): unknown
    {
        return _next(piped);
    }
}

export = (): void => {
    describe('isPipeWithParameters', () => {
        it('recognizes a class head followed by string arguments as one pipe', () => {
            expect(isPipeWithParameters([
                HelpersSpecPipe,
                '60',
            ])).to.equal(true);
            expect(isPipeWithParameters([
                HelpersSpecPipe,
                'one',
                'two',
            ])).to.equal(true);
        });

        it('rejects everything that is not that shape', () => {
            expect(isPipeWithParameters('throttle:60')).to.equal(false);
            expect(isPipeWithParameters(() => undefined)).to.equal(false);
            expect(isPipeWithParameters([])).to.equal(false);
            expect(isPipeWithParameters([HelpersSpecPipe])).to.equal(false);
            // A list that leads with a string is a list of binding names.
            expect(isPipeWithParameters([
                'one-binding',
                'other-binding',
            ])).to.equal(false);
            // Two classes side by side are two pipes, not class-plus-argument.
            expect(isPipeWithParameters([
                HelpersSpecPipe,
                HelpersSpecPipe,
            ])).to.equal(false);
        });
    });

    describe('isPipeArray', () => {
        it("answers is_array($pipes)'s question: a list of pipes, the empty list included", () => {
            expect(isPipeArray([
                (piped: unknown, _next: Next) => _next(piped),
                (piped: unknown, _next: Next) => _next(piped),
            ])).to.equal(true);
            expect(isPipeArray([
                'one-binding',
                'other-binding',
            ])).to.equal(true);
            expect(isPipeArray([])).to.equal(true);
        });

        it('rejects a single pipe of every carrier, the parameterized list included', () => {
            expect(isPipeArray('throttle:60')).to.equal(false);
            expect(isPipeArray((piped: unknown, _next: Next) => _next(piped))).to.equal(false);
            expect(isPipeArray(HelpersSpecPipe)).to.equal(false);
            expect(isPipeArray(new HelpersSpecPipe())).to.equal(false);
            expect(isPipeArray([
                HelpersSpecPipe,
                '60',
            ])).to.equal(false);
        });

        it('reads the documented heuristic edge as one parameterized pipe', () => {
            // [ClassPipe, 'bindingName'] is indistinguishable from a class
            // with one argument -- the docblocked contract is that it reads
            // as one pipe, and a binding name next to a class must spell its
            // own arguments inline or come first.
            expect(isPipeArray([
                HelpersSpecPipe,
                'some-binding',
            ])).to.equal(false);
        });
    });

    describe('wrapPipes', () => {
        it('wraps one parameterized pipe instead of taking it for a list', () => {
            const pipe: Pipe = [
                HelpersSpecPipe,
                '60',
            ];
            const wrapped = wrapPipes(pipe);

            expect(wrapped.size()).to.equal(1);
            expect(wrapped[0]).to.equal(pipe);
        });

        it('passes a list through and wraps a single pipe', () => {
            const list: Array<Pipe> = [
                HelpersSpecPipe,
                HelpersSpecPipe,
            ];
            expect(wrapPipes(list)).to.equal(list);

            const single = wrapPipes(HelpersSpecPipe);
            expect(single.size()).to.equal(1);
            expect(single[0]).to.equal(HelpersSpecPipe);

            expect(wrapPipes([]).size()).to.equal(0);
        });
    });
};
