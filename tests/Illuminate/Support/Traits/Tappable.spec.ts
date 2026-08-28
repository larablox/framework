/// <reference types="@rbxts/testez/globals" />
import { Tappable } from 'Illuminate/Support/Traits/Tappable';

/**
 * PHP: `Illuminate\Tests\Support\SupportTappableTest`.
 *
 * `Tappable.ts`'s class comment: `tap()` with no callback returns a
 * `HigherOrderTapProxy` in PHP, forwarding the next method call through
 * `__call`; there is no `__call` here, so the callback is required and the
 * proxy is not ported. `testTappableClassWithoutCallback` exercises exactly
 * that proxy form and has nothing to port from.
 *
 * `testTappableClassWithInvokableClass` and `testTappableClassWithNoneInvokableClass`
 * distinguish a PHP `__invoke`-able object from a plain one -- `tap()`'s
 * callback parameter here is typed as an ordinary function, so both PHP cases
 * collapse into the single "callback" case already covered by
 * `testTappableClassWithCallback`; there is no separate "not callable" shape
 * to construct in TypeScript.
 */
export = (): void => {
    describe('Tappable', () => {
        class TappableClass extends Tappable() {
            private name = '';

            public static make(): TappableClass {
                return new TappableClass();
            }

            public setName(name: string): void {
                this.name = name;
            }

            public getName(): string {
                return this.name;
            }
        }

        it('tap() calls the callback with the instance and returns the instance', () => {
            // PHP: SupportTappableTest::testTappableClassWithCallback
            const name = TappableClass.make()
                .tap((tappable) => {
                    tappable.setName('MyName');
                })
                .getName();

            expect(name).to.equal('MyName');
        });
    });
};
