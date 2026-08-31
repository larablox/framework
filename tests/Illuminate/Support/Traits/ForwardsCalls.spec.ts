/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual, expectThrows } from '../../TestHelpers';
import { BadMethodCallException } from 'Illuminate/Exception';
import { ForwardsCalls, throwBadMethodCallException } from 'Illuminate/Support/Traits/ForwardsCalls';

/**
 * PHP: `Illuminate\Tests\Support\ForwardsCallsTest`.
 *
 * `ForwardsCalls.ts`'s class comment: PHP calls the forwarded method and
 * turns the resulting `Error` back into a `BadMethodCallException` by
 * matching the engine's message. Indexing a Luau table for a missing method
 * just yields `nil`, so the port checks "does this method exist" up front --
 * `testNonForwardedErrorIsNotTamperedWith` (an *unrelated* error thrown from
 * inside a real, existing method) has no counterpart to test here, since that
 * distinction no longer exists. `testMissingAlphanumericForwardedCallThrowsCorrectError`
 * exercises the same "missing method" path under a differently-spelled method
 * name -- PHP's alphanumeric-vs-symbolic method name distinction does not
 * exist here, so it is covered by the single "missing method" case below
 * rather than duplicated.
 */
export = (): void => {
    describe('ForwardsCalls', () => {
        class ForwardsCallsBase
        {
            public forwardedBase(...parameters: Array<unknown>): Array<unknown>
            {
                return parameters;
            }
        }

        class ForwardsCallsTwo extends ForwardsCalls(ForwardsCallsBase)
        {
            public forwardedTwo(...parameters: Array<unknown>): Array<unknown>
            {
                return parameters;
            }

            public call(method: string, parameters: Array<unknown>): unknown
            {
                return this.forwardCallTo(this, method, parameters);
            }
        }

        class ForwardsCallsOne extends ForwardsCalls()
        {
            private readonly target = new ForwardsCallsTwo();

            public call(method: string, parameters: Array<unknown>): unknown
            {
                return this.forwardCallTo(this.target, method, parameters);
            }

            public throwTestException(method: string): never
            {
                throwBadMethodCallException(this, method);
            }
        }

        it('forwards a call to the target and returns its result', () => {
            // PHP: ForwardsCallsTest::testForwardsCalls
            const one = new ForwardsCallsOne();

            expectDeepEqual(
                one.call('forwardedTwo', [
                    'foo',
                    'bar',
                ]),
                [
                    'foo',
                    'bar',
                ],
            );
        });

        it('forwards a call through a chain of ForwardsCalls users', () => {
            // PHP: ForwardsCallsTest::testNestedForwardCalls
            const one = new ForwardsCallsOne();

            expectDeepEqual(
                one.call('forwardedBase', [
                    'foo',
                    'bar',
                ]),
                [
                    'foo',
                    'bar',
                ],
            );
        });

        it('throws BadMethodCallException naming the target class for a missing method', () => {
            // PHP: ForwardsCallsTest::testMissingForwardedCallThrowsCorrectError
            const one = new ForwardsCallsOne();

            expectThrows(() =>
                one.call('missingMethod', [
                    'foo',
                    'bar',
                ])
            );

            let thrown: unknown;
            try {
                one.call('missingMethod', [
                    'foo',
                    'bar',
                ]);
            } catch (e) {
                thrown = e;
            }
            expect(thrown instanceof BadMethodCallException).to.equal(true);
        });

        it('throwBadMethodCallException() throws naming the given target and method', () => {
            // PHP: ForwardsCallsTest::testThrowBadMethodCallException
            const one = new ForwardsCallsOne();

            expectThrows(() => one.throwTestException('test'));
        });
    });
};
