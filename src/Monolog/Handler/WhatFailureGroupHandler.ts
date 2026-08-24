import { GroupHandler } from "Monolog/Handler/GroupHandler";
import type { LogRecord } from "Monolog/LogRecord";

/**
 * PHP: `Monolog\Handler\WhatFailureGroupHandler`.
 *
 * Like `GroupHandler`, but a handler that throws is ignored. This is what
 * `LogManager` wraps a stack in when `ignore_exceptions` is set.
 */
export class WhatFailureGroupHandler extends GroupHandler {
    public handle(record: LogRecord): boolean {
        let processed = record;

        if (!this.processors.isEmpty()) {
            processed = this.processRecord(processed);
        }

        for (const handler of this.handlers) {
            pcall(() => handler.handle(processed.clone()));
        }

        return this.bubble === false;
    }

    /** Closes every handler, ignoring failures. */
    public close(): void {
        for (const handler of this.handlers) {
            pcall(() => handler.close());
        }
    }
}
