/// <reference types="@rbxts/testez/globals" />
import { MaxAttemptsExceededException } from 'Illuminate/Queue/MaxAttemptsExceededException';
import { TimeoutExceededException } from 'Illuminate/Queue/TimeoutExceededException';
import type { Job } from 'Illuminate/Contracts/Queue/Job';

/**
 * PHP: `Illuminate\Tests\Queue\QueueExceptionTest`.
 *
 * `MyFakeRedisJob extends RedisJob` with an empty constructor, overriding
 * `resolveName()`, becomes a small `Partial<Job>` fake here -- there is no
 * `RedisJob` base to extend for the sole purpose of skipping its constructor.
 */

function fakeJob(name: string): Job
{
    return { resolveName: () => name } as unknown as Job;
}

export = (): void => {
    describe('Exception', () => {
        // PHP: QueueExceptionTest::test_it_can_create_timeout_exception_for_job
        it('TimeoutExceededException.forJob() names the job and carries it', () => {
            const job = fakeJob('App.Jobs.UnderlyingJob');

            const e = TimeoutExceededException.forJob(job);

            expect(e.getMessage()).to.equal('App.Jobs.UnderlyingJob has timed out.');
            expect(e.job).to.equal(job);
        });

        // PHP: QueueExceptionTest::test_it_can_create_max_attempts_exception_for_job
        it('MaxAttemptsExceededException.forJob() names the job and carries it', () => {
            const job = fakeJob('App.Jobs.UnderlyingJob');

            const e = MaxAttemptsExceededException.forJob(job);

            expect(e.getMessage()).to.equal('App.Jobs.UnderlyingJob has been attempted too many times.');
            expect(e.job).to.equal(job);
        });

        it('TimeoutExceededException is a MaxAttemptsExceededException', () => {
            const job = fakeJob('Job');

            expect(TimeoutExceededException.forJob(job) instanceof MaxAttemptsExceededException).to.equal(true);
        });
    });
};
