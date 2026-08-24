import { InvalidArgumentException } from "Illuminate/Exception";

/** PHP: `Illuminate\Queue\InvalidPayloadException`. */
export class InvalidPayloadException extends InvalidArgumentException {
    /** Create a new exception instance. */
    public constructor(
        message: string,
        public readonly value?: unknown,
    ) {
        super(message);
    }
}
