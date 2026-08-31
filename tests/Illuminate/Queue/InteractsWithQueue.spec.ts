/// <reference types="@rbxts/testez/globals" />
import { InteractsWithQueue } from 'Illuminate/Queue/InteractsWithQueue';
import { ManuallyFailedException } from 'Illuminate/Queue/ManuallyFailedException';
import type { Job } from 'Illuminate/Contracts/Queue/Job';

/**
 * PHP: `Illuminate\Tests\Queue\InteractsWithQueueTest`.
 *
 * `InteractsWithQueue` is a trait in PHP, used by an anonymous class; TypeScript
 * has no multiple inheritance, so this port's `InteractsWithQueue.ts` is a base
 * class a job extends instead (see its own class comment) -- the fixture below
 * is a small subclass rather than an anonymous class with `use InteractsWithQueue`.
 * The Mockery `Job` mock's `shouldReceive('fail')->withArgs(...)` expectation
 * becomes a hand-written fake that records what it was called with.
 */

class FakeJob implements Partial<Job>
{
    public failedWith?: unknown;

    public fail(e?: unknown): void
    {
        this.failedWith = e;
    }
}

class JobFixture extends InteractsWithQueue
{}

export = (): void => {
    describe('InteractsWithQueue', () => {
        // PHP: InteractsWithQueueTest::testCreatesAnExceptionFromString
        it('fail() turns a string into a ManuallyFailedException before handing it to the queue job', () => {
            const queueJob = new FakeJob();
            const job = new JobFixture();
            job.setJob(queueJob as unknown as Job);

            job.fail('Whoops!');

            expect(queueJob.failedWith instanceof ManuallyFailedException).to.equal(true);
            expect((queueJob.failedWith as ManuallyFailedException).getMessage()).to.equal('Whoops!');
        });

        // Not directly in the PHP suite -- exercises fail() passing a non-string
        // exception through unchanged, the branch alongside the ported case.
        it('fail() passes a non-string exception through unchanged', () => {
            const queueJob = new FakeJob();
            const job = new JobFixture();
            job.setJob(queueJob as unknown as Job);

            const e = new ManuallyFailedException('boom');
            job.fail(e);

            expect(queueJob.failedWith).to.equal(e);
        });

        // Not directly in the PHP suite -- exercises attempts()/release()/
        // delete() delegating to the underlying job when one is set.
        it('delegates attempts(), release() and delete() to the underlying job', () => {
            const calls = new Array<string>();

            const queueJob: Partial<Job> = {
                attempts()
                {
                    return 3;
                },
                release(delay?: number)
                {
                    calls.push(`release:${delay}`);
                },
                delete()
                {
                    calls.push('delete');
                },
            };

            const job = new JobFixture();
            job.setJob(queueJob as Job);

            expect(job.attempts()).to.equal(3);

            job.release(5);
            job.delete();

            expect(calls[0]).to.equal('release:5');
            expect(calls[1]).to.equal('delete');
        });

        it('attempts() answers 1 when there is no underlying job yet', () => {
            const job = new JobFixture();

            expect(job.attempts()).to.equal(1);
        });
    });
};
