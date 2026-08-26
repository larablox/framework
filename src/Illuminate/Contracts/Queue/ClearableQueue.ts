/** PHP: `Illuminate\Contracts\Queue\ClearableQueue`. */
export interface ClearableQueue {
    /** Delete all of the jobs from the queue. */
    clear(queue?: string): number;
}
