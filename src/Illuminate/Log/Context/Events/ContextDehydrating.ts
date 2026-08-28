import type { Repository } from 'Illuminate/Log/Context/Repository';

export class ContextDehydrating {
    /** Create a new event instance. */
    public constructor(public readonly context: Repository) {}
}
