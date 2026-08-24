/** PHP: `Illuminate\Contracts\Pipeline\Hub`. */
export interface Hub {
    /** Send an object through one of the available pipelines. */
    pipe(object: unknown, pipeline?: string): unknown;
}
