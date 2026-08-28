/// <reference types="@rbxts/testez/globals" />
import { Application } from 'Illuminate/Foundation/Application';
import { Facade } from 'Illuminate/Support/Facades/Facade';
import { Forwards } from 'Illuminate/Support/Facades/Forwards';
import type { Forwarded } from 'Illuminate/Support/Facades/Forwards';
import type { Abstract } from 'Illuminate/Container/Types';

/**
 * PHP: `Illuminate\Tests\Support\SupportFacadeTest`.
 *
 * `Facade.ts`'s class comment: the Mockery helpers (`spy`, `partialMock`,
 * `shouldReceive`, `expects`) are not ported -- there is no mocking library
 * here. `testShouldReceiveReturnsAMockeryMock`, `testSpyReturnsAMockerySpy`,
 * `testShouldReceiveCanBeCalledTwice`, `testCanBeMockedWithoutUnderlyingInstance`
 * and `testExpectsReturnsAMockeryMockWithExpectationRequired` all exercise
 * that surface directly and have nothing to port from.
 *
 * `Forwards.ts` replaces PHP's `Facade::__callStatic()` with a metatable
 * `__index` hook, resolving the facade root through the real container
 * (`Illuminate/Foundation/Application`) rather than PHP's `ArrayAccess`
 * `ApplicationStub`; `bar()` on a plain stub object stands in for the
 * PHP tests' Mockery expectation of "called exactly N times, returns 'baz'".
 */
export = (): void => {
    describe('Facade', () => {
        class RootStub {
            public calls = 0;

            public bar(): string {
                this.calls += 1;

                return 'baz';
            }
        }

        @Forwards()
        class FacadeStub extends Facade {
            declare public static bar: Forwarded<RootStub['bar']>;

            protected static getFacadeAccessor(): Abstract {
                return 'foo';
            }
        }

        beforeEach(() => {
            // PHP: SupportFacadeTest::setUp
            Facade.clearResolvedInstances();
            FacadeStub.setFacadeApplication(undefined);
        });

        it("forwards an unresolved static call to the underlying application's bound instance", () => {
            // PHP: SupportFacadeTest::testFacadeCallsUnderlyingApplication
            const app = new Application();
            const root = new RootStub();
            app.instance('foo', root);

            FacadeStub.setFacadeApplication(app);

            expect(FacadeStub.bar()).to.equal('baz');
        });

        it('resolves again after clearing the specific resolved instance', () => {
            // PHP: SupportFacadeTest::testFacadeResolvesAgainAfterClearingSpecific
            const app = new Application();
            const root = new RootStub();
            app.instance('foo', root);

            // Resolve for the first time
            FacadeStub.setFacadeApplication(app);
            expect(FacadeStub.bar()).to.equal('baz');

            // Clear resolved instance and resolve the second time
            FacadeStub.clearResolvedInstance();
            expect(FacadeStub.bar()).to.equal('baz');

            // Clear resolved instance through parent and resolve the third time
            Facade.clearResolvedInstance('foo');
            expect(FacadeStub.bar()).to.equal('baz');

            expect(root.calls).to.equal(3);
        });

        it('resolves again after clearing all resolved instances', () => {
            // PHP: SupportFacadeTest::testFacadeResolvesAgainAfterClearingAll
            const app = new Application();
            const root = new RootStub();
            app.instance('foo', root);

            // Resolve for the first time
            FacadeStub.setFacadeApplication(app);
            expect(FacadeStub.bar()).to.equal('baz');

            // Clear all resolved instances and resolve a second time
            Facade.clearResolvedInstances();
            expect(FacadeStub.bar()).to.equal('baz');

            expect(root.calls).to.equal(2);
        });
    });
};
