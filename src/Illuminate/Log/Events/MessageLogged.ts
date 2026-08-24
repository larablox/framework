import type { LogContext, LogLevel } from "Illuminate/Contracts/Log/Logger";

export class MessageLogged {
    /** Create a new event instance. */
    public constructor(
        public readonly level: LogLevel,
        public readonly message: string,
        public readonly context: LogContext = {},
    ) {}
}
