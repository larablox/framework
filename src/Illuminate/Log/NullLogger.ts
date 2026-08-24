import type { Logger } from "Illuminate/Contracts/Log/Logger";

/** PHP: `Psr\Log\NullLogger`. Discards everything. */
export class NullLogger implements Logger {
    public emergency(): void {}

    public alert(): void {}

    public critical(): void {}

    public error(): void {}

    public warning(): void {}

    public notice(): void {}

    public info(): void {}

    public debug(): void {}

    public log(): void {}
}
