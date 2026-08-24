/** PHP: `enum WorkerStopReason: string`. */
export enum WorkerStopReason {
    Interrupted = "interrupted",
    LostConnection = "lost_connection",
    MaxJobsExceeded = "max_jobs",
    MaxMemoryExceeded = "memory",
    MaxTimeExceeded = "max_time",
    QueueEmpty = "empty",
    QueueEmptyFor = "empty_for",
    ReceivedRestartSignal = "restart_signal",
    TimedOut = "timed_out",
}
