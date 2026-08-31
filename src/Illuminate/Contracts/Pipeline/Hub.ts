import { Contract } from 'Illuminate/Container/Contract';

/** PHP: `Illuminate\Contracts\Pipeline\Hub`. */
export interface Hub
{
    /** Send an object through one of the available pipelines. */
    pipe(object: unknown, pipeline?: string): unknown;
}

/** PHP: `Hub::class` -- the interface name as a container key. */
export const HubContract = new Contract<Hub>('Illuminate\\Contracts\\Pipeline\\Hub');
