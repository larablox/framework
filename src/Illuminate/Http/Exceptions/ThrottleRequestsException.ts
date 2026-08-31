import { TooManyRequestsHttpException } from 'Illuminate/Http/Exceptions/HttpException';

/** PHP: `Illuminate\Http\Exceptions\ThrottleRequestsException`. */
export class ThrottleRequestsException extends TooManyRequestsHttpException
{
    /** Create a new throttle requests exception instance. */
    public constructor(message = 'Too Many Attempts.', headers: Record<string, string> = {})
    {
        super(undefined, message, headers);
    }
}
