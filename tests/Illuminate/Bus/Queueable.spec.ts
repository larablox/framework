/// <reference types="@rbxts/testez/globals" />
import { Queueable } from 'Illuminate/Bus/Queueable';

/**
 * PHP: `Illuminate\Tests\Bus\QueueableTest`.
 *
 * Upstream's data providers cover a PHP `BackedEnum` argument
 * (`ConnectionEnum::SQS` etc.) resolving to its `->value`. `onConnection()`/
 * `onQueue()` here take a plain `string | undefined` (`Queueable.ts`) -- there
 * is no backed-enum concept to hand them, so only the string and `undefined`
 * cases of each provider are ported; the enum cases have no analogue.
 */
class FakeJob extends Queueable {}

export = (): void => {
    describe('Queueable', () => {
        it('onConnection() sets the connection from a string', () => {
            // PHP: QueueableTest::testOnConnection ('uses string')
            const job = new FakeJob();
            job.onConnection('redis');

            expect(job.connection).to.equal('redis');
        });

        it('onConnection() accepts undefined', () => {
            // PHP: QueueableTest::testOnConnection ('uses null')
            const job = new FakeJob();
            job.onConnection(undefined);

            expect(job.connection).to.equal(undefined);
        });

        it('allOnConnection() sets both connection and chainConnection from a string', () => {
            // PHP: QueueableTest::testAllOnConnection ('uses string')
            const job = new FakeJob();
            job.allOnConnection('redis');

            expect(job.connection).to.equal('redis');
            expect(job.chainConnection).to.equal('redis');
        });

        it('allOnConnection() accepts undefined', () => {
            // PHP: QueueableTest::testAllOnConnection ('uses null')
            const job = new FakeJob();
            job.allOnConnection(undefined);

            expect(job.connection).to.equal(undefined);
            expect(job.chainConnection).to.equal(undefined);
        });

        it('onQueue() sets the queue from a string', () => {
            // PHP: QueueableTest::testOnQueue ('uses string')
            const job = new FakeJob();
            job.onQueue('high');

            expect(job.queue).to.equal('high');
        });

        it('onQueue() accepts undefined', () => {
            // PHP: QueueableTest::testOnQueue ('uses null')
            const job = new FakeJob();
            job.onQueue(undefined);

            expect(job.queue).to.equal(undefined);
        });

        it('allOnQueue() sets both queue and chainQueue from a string', () => {
            // PHP: QueueableTest::testAllOnQueue ('uses string')
            const job = new FakeJob();
            job.allOnQueue('high');

            expect(job.queue).to.equal('high');
            expect(job.chainQueue).to.equal('high');
        });

        it('allOnQueue() accepts undefined', () => {
            // PHP: QueueableTest::testAllOnQueue ('uses null')
            const job = new FakeJob();
            job.allOnQueue(undefined);

            expect(job.queue).to.equal(undefined);
            expect(job.chainQueue).to.equal(undefined);
        });
    });
};
