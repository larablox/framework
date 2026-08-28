/// <reference types="@rbxts/testez/globals" />
import { Backoff } from 'Illuminate/Queue/Attributes/Backoff';
import { Connection } from 'Illuminate/Queue/Attributes/Connection';
import { Delay } from 'Illuminate/Queue/Attributes/Delay';
import { FailOnTimeout } from 'Illuminate/Queue/Attributes/FailOnTimeout';
import { MaxExceptions } from 'Illuminate/Queue/Attributes/MaxExceptions';
import { Queue } from 'Illuminate/Queue/Attributes/Queue';
import { ReadsClassAttributes } from 'Illuminate/Support/Traits/ReadsClassAttributes';
import { Timeout } from 'Illuminate/Queue/Attributes/Timeout';
import { Tries } from 'Illuminate/Queue/Attributes/Tries';

/**
 * PHP: `Illuminate\Tests\Queue\QueueAttributesTest`.
 *
 * Upstream exercises `Queue`/`Connection` normalizing a PHP backed or unit
 * enum to a string. Neither attribute normalizes anything here -- `Queue.ts`
 * and `Connection.ts` (see their source) take a plain `string` and store it
 * as is, and roblox-ts has no backed-enum construct to hand them instead --
 * so `test_queue_attribute_normalizes_*_enum_to_string` and
 * `test_connection_attribute_normalizes_*_enum_to_string` are not ported.
 * What is ported instead: that every queue attribute decorator records its
 * value and that `ReadsClassAttributes.getAttributeValue()` -- the mechanism
 * `Queue.ts`'s `createObjectPayload()` actually reads these through -- prefers
 * an instance property, falls back to the attribute, walks up to a parent
 * class's attribute, and falls back to a default. This is also where
 * `QueueDatabaseQueueUnitTest::testPushUsesPropertiesDeclaredOnChildClassOverInheritedAttributes`
 * / `testPushStillUsesAttributesDeclaredOnSameClassOverDefaultProperties` land,
 * adapted from mocked `insertGetId` payload assertions to direct
 * `getAttributeValue()` calls.
 */

@Backoff(9)
@FailOnTimeout()
@MaxExceptions(3)
@Timeout(40)
@Tries(2)
abstract class ParentJobWithAttributes {}

class ChildJobWithPropertiesOverridingParentAttributes extends ParentJobWithAttributes {
    public backoff = 13;
    public failOnTimeout = false;
    public maxExceptions = 11;
    public timeout = 1700;
    public tries = 7;
}

@Backoff(9)
@FailOnTimeout()
@MaxExceptions(3)
@Timeout(40)
@Tries(2)
class JobWithAttributesAndDefaultProperties {
    public backoff = 13;
    public failOnTimeout = false;
    public maxExceptions = 11;
    public timeout = 1700;
    public tries = 7;
}

@Timeout(40)
class JobWithOnlyAttribute {}

class JobWithNothing {}

export = (): void => {
    describe('Attributes', () => {
        // PHP: QueueAttributesTest::test_queue_attribute_keeps_string_as_string
        it('Queue() records the queue name', () => {
            @Queue('high')
            class Job {}

            expect(ReadsClassAttributes.getAttributeValue(new Job(), Queue, 'queue')).to.equal('high');
        });

        // PHP: QueueAttributesTest::test_connection_attribute_keeps_string_as_string
        it('Connection() records the connection name', () => {
            @Connection('redis')
            class Job {}

            expect(ReadsClassAttributes.getAttributeValue(new Job(), Connection, 'connection')).to.equal('redis');
        });

        it('Delay() records the delay', () => {
            @Delay(15)
            class Job {}

            expect(ReadsClassAttributes.getAttributeValue(new Job(), Delay, 'delay')).to.equal(15);
        });

        // PHP: QueueDatabaseQueueUnitTest::testPushUsesPropertiesDeclaredOnChildClassOverInheritedAttributes
        it('an instance property on a child class wins over an attribute declared on its parent', () => {
            const job = new ChildJobWithPropertiesOverridingParentAttributes();

            expect(ReadsClassAttributes.getAttributeValue(job, Timeout, 'timeout')).to.equal(1700);
            expect(ReadsClassAttributes.getAttributeValue(job, Tries, 'tries')).to.equal(7);
            expect(ReadsClassAttributes.getAttributeValue(job, Backoff, 'backoff')).to.equal(13);
            expect(ReadsClassAttributes.getAttributeValue(job, MaxExceptions, 'maxExceptions')).to.equal(11);
            expect(ReadsClassAttributes.getAttributeValue(job, FailOnTimeout, 'failOnTimeout')).to.equal(false);
        });

        // PHP: QueueDatabaseQueueUnitTest::testPushStillUsesAttributesDeclaredOnSameClassOverDefaultProperties
        it('a property declared on the same class as the attribute still wins', () => {
            const job = new JobWithAttributesAndDefaultProperties();

            expect(ReadsClassAttributes.getAttributeValue(job, Timeout, 'timeout')).to.equal(1700);
            expect(ReadsClassAttributes.getAttributeValue(job, Tries, 'tries')).to.equal(7);
            expect(ReadsClassAttributes.getAttributeValue(job, Backoff, 'backoff')).to.equal(13);
            expect(ReadsClassAttributes.getAttributeValue(job, MaxExceptions, 'maxExceptions')).to.equal(11);
            expect(ReadsClassAttributes.getAttributeValue(job, FailOnTimeout, 'failOnTimeout')).to.equal(false);
        });

        // Not directly in the PHP suite -- exercises `getAttributeValue()`
        // falling through to the attribute when no property shadows it.
        it('falls back to the attribute when no instance property is set', () => {
            expect(ReadsClassAttributes.getAttributeValue(new JobWithOnlyAttribute(), Timeout, 'timeout')).to.equal(40);
        });

        // Not directly in the PHP suite -- exercises the default answer when
        // neither a property nor an attribute is present.
        it('falls back to the given default when nothing is declared', () => {
            expect(ReadsClassAttributes.getAttributeValue(new JobWithNothing(), Timeout, 'timeout', 99)).to.equal(99);
            expect(ReadsClassAttributes.getAttributeValue(new JobWithNothing(), Timeout, 'timeout')).to.equal(
                undefined,
            );
        });
    });
};
