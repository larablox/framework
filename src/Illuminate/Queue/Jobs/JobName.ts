import { Str } from 'Illuminate/Support/Str';
import { Util } from 'Illuminate/Container/Util';
import type { Abstract } from 'Illuminate/Container/Types';
import type { JobHandler, JobPayload } from 'Illuminate/Contracts/Queue/Job';

/** PHP: `Illuminate\Queue\Jobs\JobName`. */
export class JobName
{
    /**
     * Parse the given job name into a class / method array.
     *
     * PHP always parses a `Class@method` string. The class may stand in for its
     * own name here, alone or already paired with the method, so both spellings
     * are accepted and a plain string still goes through `Str::parseCallback`.
     */
    public static parse(job: JobHandler): [Abstract, string]
    {
        if (typeIs(job, 'string')) {
            const [klass, method] = Str.parseCallback(job, 'fire');

            return [
                klass,
                method ?? 'fire',
            ];
        }

        if (Util.isArray(job)) {
            const [klass, method] = job as [Abstract, string];

            return [
                klass,
                method,
            ];
        }

        return [
            job as Abstract,
            'fire',
        ];
    }

    /** Get the resolved name of the queued job class. */
    public static resolve(name: JobHandler, payload: JobPayload): string
    {
        const displayName = payload.displayName;

        if (displayName !== undefined && displayName !== '') {
            return displayName;
        }

        const [klass] = JobName.parse(name);

        return tostring(klass);
    }

    /** Get the class name for queued job class. */
    public static resolveClassName(name: JobHandler, payload: JobPayload): Abstract
    {
        const data = payload.data as { commandName?: Abstract; } | undefined;

        if (data?.commandName !== undefined) {
            return data.commandName;
        }

        const [klass] = JobName.parse(name);

        return klass;
    }
}
