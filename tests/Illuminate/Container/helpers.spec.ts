/// <reference types="@rbxts/testez/globals" />
import { expectThrows } from '../TestHelpers';
import { call, callMethod, isCallable, methodExists } from 'Illuminate/Container/helpers';

/**
 * No PHP twin: `Container/helpers.ts` is a port-only module (its parity
 * waiver says why) -- the language compensations for PHP's dynamic calls and
 * capability checks, which PHP gets from the language itself.
 */
class HelpersSpecTarget
{
    public handle(piped: unknown, transform: (piped: unknown) => unknown): unknown
    {
        return transform(piped);
    }
}

export = (): void => {
    describe('call', () => {
        it('calls a function or a __call table, and raises on anything else', () => {
            expect(call((a: number, b: number) => a + b, 1, 2)).to.equal(3);

            const invokable = setmetatable({}, {
                __call: (_self: object, value: unknown) => value,
            } as LuaMetatable<object>);
            expect(call(invokable, 'x')).to.equal('x');

            expectThrows(() => call('not callable'));
        });
    });

    describe('methodExists / callMethod', () => {
        it('finds a method through __index and calls it with the target as self', () => {
            const target = new HelpersSpecTarget();

            expect(methodExists(target, 'handle')).to.equal(true);
            expect(methodExists(target, 'missing')).to.equal(false);
            expect(methodExists('not a table', 'handle')).to.equal(false);

            const passed = callMethod(target, 'handle', 'foo', (piped: unknown) => piped);
            expect(passed).to.equal('foo');
        });
    });

    describe('isCallable', () => {
        it('accepts a function or a table with a __call metamethod', () => {
            expect(isCallable(() => undefined)).to.equal(true);
            expect(isCallable(setmetatable({}, { __call: () => undefined } as LuaMetatable<object>))).to.equal(true);
        });

        it('rejects everything else', () => {
            expect(isCallable('handle')).to.equal(false);
            expect(isCallable(HelpersSpecTarget)).to.equal(false);
            expect(isCallable(new HelpersSpecTarget())).to.equal(false);
            expect(isCallable([])).to.equal(false);
        });
    });
};
