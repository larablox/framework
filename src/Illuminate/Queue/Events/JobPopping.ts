/** PHP: `IlluminateQueueEventsJobPopping`. */
export class JobPopping {
    /** Create a new event instance. */
    public constructor(
        public readonly connectionName: string,
        public readonly queue?: string,
    ) {}
}
