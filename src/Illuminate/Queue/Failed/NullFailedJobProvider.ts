import type { JobPayload } from 'Illuminate/Contracts/Queue/Job';
import type { FailedJobProviderInterface, FailedJobRecord } from 'Illuminate/Queue/Failed/FailedJobProviderInterface';

/**
 * PHP: `Illuminate\Queue\Failed\NullFailedJobProvider`.
 *
 * PHP also implements `CountableFailedJobProvider`; `count()` is kept with it.
 * The database, file and DynamoDB providers have nowhere to write here.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- storing nothing is the
   whole point of this provider. */
export class NullFailedJobProvider implements FailedJobProviderInterface {
    /** Log a failed job into storage. */
    public log(
        connection: string,
        queue: string,
        payload: JobPayload,
        exception: unknown,
    ): string | number | undefined {
        return undefined;
    }

    /** Get the IDs of all of the failed jobs. */
    public ids(queue?: string): Array<string | number> {
        return [];
    }

    /** Get a list of all of the failed jobs. */
    public all(): Array<FailedJobRecord> {
        return [];
    }

    /** Get a single failed job. */
    public find(id: string | number): FailedJobRecord | undefined {
        return undefined;
    }

    /** Delete a single failed job from storage. */
    public forget(id: string | number): boolean {
        return true;
    }

    /** Flush all of the failed jobs from storage. */
    public flush(hours?: number): void {
        //
    }

    /** Count the failed jobs. */
    public count(connection?: string, queue?: string): number {
        return 0;
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
