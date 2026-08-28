import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { Remote, RemoteLimits } from 'Illuminate/Http/Remote';
import { Request } from 'Illuminate/Http/Request';
import { Response } from 'Illuminate/Http/Response';
import { RuntimeException } from 'Illuminate/Exception';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { LogManager } from 'Illuminate/Log/LogManager';
import type { ResponseEnvelope, Transport } from 'Illuminate/Http/Remote';

const RunService = game.GetService('RunService');

/** What the gateway hands a request to. */
export type RequestHandler = (request: Request) => Response;

/** What an envelope turned into, or the status explaining why it did not. */
type ParseResult = Request | number;

/**
 * The server end of the transport: it turns a remote call into a `Request` and
 * a `Response` back into something replicable.
 *
 * There is no PHP counterpart. This is the web server, the part PHP never
 * writes: `public/index.php` receives a request that PHP-FPM has already
 * parsed and hands it to a handler. So does this -- `listen()` takes the
 * handler, which is the HTTP kernel.
 *
 * What it enforces before the handler is reached, in order:
 *
 * 1. the envelope is well formed -- a verb, a path, and a payload that is a
 *    table of bounded size and depth (`RemoteLimits`), so that a malformed or
 *    oversized call costs as little as possible;
 * 2. the application has finished bootstrapping, or the caller gets a 503
 *    rather than a half-built container;
 * 3. anything thrown by the handler becomes a 500 with no content, and the
 *    reason goes to the log. The kernel answers rather than throws, so this
 *    last one is a net under the kernel itself.
 *
 * The player comes from the engine, never from the payload.
 */
export class RemoteGateway {
    /** The connections made by `listen()`, kept so `stop()` can undo them. */
    protected connections = new Array<RBXScriptConnection>();

    /** Whether the gateway is currently attached to the remotes. */
    protected listening = false;

    /** Create a new gateway. */
    public constructor(@Inject('app') protected readonly app: Application) {}

    /** Attach the gateway to the remotes and route what arrives to the handler. */
    public listen(handler: RequestHandler): void {
        if (!RunService.IsServer()) {
            throw new RuntimeException('The remote gateway may only listen on the server.');
        }

        if (this.listening) {
            throw new RuntimeException('The remote gateway is already listening.');
        }

        Remote.call().OnServerInvoke = (player: Player, ...args: Array<unknown>) =>
            this.handleCall(handler, player, args);

        this.connections.push(
            Remote.send().OnServerEvent.Connect((player: Player, ...args: Array<unknown>) => {
                this.handleDispatchOnly(handler, player, args, 'send');
            }),
        );

        this.connections.push(
            Remote.stream().OnServerEvent.Connect((player: Player, ...args: Array<unknown>) => {
                this.handleDispatchOnly(handler, player, args, 'stream');
            }),
        );

        this.listening = true;
    }

    /** Detach the gateway from the remotes. */
    public stop(): void {
        Remote.call().OnServerInvoke = undefined;

        for (const connection of this.connections) {
            connection.Disconnect();
        }

        this.connections.clear();
        this.listening = false;
    }

    /** Determine whether the gateway is attached to the remotes. */
    public isListening(): boolean {
        return this.listening;
    }

    /** Handle a request that expects a response. */
    protected handleCall(handler: RequestHandler, player: Player, args: Array<unknown>): ResponseEnvelope {
        const parsed = this.parse(player, args, 'call');

        if (typeIs(parsed, 'number')) {
            return { status: parsed };
        }

        return this.envelope(this.dispatch(handler, parsed));
    }

    /**
     * Handle a request that expects nothing back.
     *
     * A rejected envelope is dropped: there is no one listening for the status,
     * which is what a client gets for hanging up before the response.
     */
    protected handleDispatchOnly(
        handler: RequestHandler,
        player: Player,
        args: Array<unknown>,
        transport: Transport,
    ): void {
        const parsed = this.parse(player, args, transport);

        if (typeIs(parsed, 'number')) {
            return;
        }

        this.dispatch(handler, parsed, transport);
    }

    /**
     * Turn an envelope into a request, or into the status it failed with.
     *
     * The arguments arrive positionally -- `(method, path, data)` -- because a
     * wrapper table would be one more allocation on every call for nothing.
     */
    protected parse(player: Player, args: Array<unknown>, transport: Transport): ParseResult {
        if (!this.app.hasBeenBootstrapped()) {
            return Response.HTTP_SERVICE_UNAVAILABLE;
        }

        const [method, path, data] = args;

        if (!typeIs(method, 'string') || method.size() === 0 || method.size() > RemoteLimits.method) {
            return Response.HTTP_BAD_REQUEST;
        }

        if (!typeIs(path, 'string') || path.size() === 0 || path.size() > RemoteLimits.path) {
            return Response.HTTP_BAD_REQUEST;
        }

        if (data !== undefined && !typeIs(data, 'table')) {
            return Response.HTTP_BAD_REQUEST;
        }

        if (data !== undefined && !this.withinLimits(data, 1, { count: 0 })) {
            return Response.HTTP_BAD_REQUEST;
        }

        return new Request(player, method, path, (data as ArrayAccessible | undefined) ?? {}, transport);
    }

    /**
     * Determine whether a payload is small and shallow enough to look at.
     *
     * Keys are checked too: a Luau table may be keyed by anything, and only
     * strings and numbers mean anything to the code downstream.
     */
    protected withinLimits(value: object, depth: number, counter: { count: number }): boolean {
        if (depth > RemoteLimits.depth) {
            return false;
        }

        for (const [key, nested] of pairs(value as Record<string, unknown>)) {
            if (!typeIs(key, 'string') && !typeIs(key, 'number')) {
                return false;
            }

            counter.count += 1;

            if (counter.count > RemoteLimits.nodes) {
                return false;
            }

            if (typeIs(nested, 'table') && !this.withinLimits(nested, depth + 1, counter)) {
                return false;
            }
        }

        return true;
    }

    /** Run the handler, turning anything it throws into a 500. */
    protected dispatch(handler: RequestHandler, request: Request, transport: Transport = 'call'): Response {
        try {
            return handler(request);
        } catch (exception) {
            // The kernel answers rather than throws: it reports and renders
            // through the exception handler, which is where a 404 becomes a
            // 404. Reaching here means the kernel itself failed, so the reason
            // goes to the log and the caller gets a bare 500 -- a server-side
            // error message is not its business.
            this.report(request, transport, exception);

            return new Response(undefined, Response.HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /** Flatten a response into something the remote can carry. */
    protected envelope(response: Response): ResponseEnvelope {
        const headers: Record<string, string> = {};
        let hasHeaders = false;

        for (const [key, value] of response.getHeaders().entries()) {
            headers[key] = value;
            hasHeaders = true;
        }

        return {
            status: response.status(),
            data: response.getContent(),
            headers: hasHeaders ? headers : undefined,
        };
    }

    /**
     * Report a failed request.
     *
     * PHP hands this to `ExceptionHandler::report()`; the exceptions component
     * is not ported, so the log takes it directly -- the same trade the queue
     * worker makes.
     */
    protected report(request: Request, transport: Transport, exception: unknown): void {
        if (!this.app.bound('log')) {
            warn(`[${transport}] ${request.method()} ${request.path()}`, exception);

            return;
        }

        this.app.make<LogManager>('log').error(`Unhandled exception for [${request.method()} ${request.path()}].`, {
            transport: transport,
            player: request.player().Name,
            exception: exception,
        });
    }
}
