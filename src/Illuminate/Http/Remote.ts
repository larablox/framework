/**
 * The transport under the request cycle. There is no PHP counterpart: this is
 * the socket, the part PHP leaves to the web server.
 *
 * Three remotes carry client-to-server traffic and one carries the other
 * direction. They are declared in the Rojo project file rather than created at
 * runtime, so they exist before any script runs and no side has to race for
 * them.
 *
 * | Instance  | Class                   | Carries                     |
 * |-----------|-------------------------|-----------------------------|
 * | `Call`    | `RemoteFunction`        | a request that wants a reply |
 * | `Send`    | `RemoteEvent`           | a request that does not      |
 * | `Stream`  | `UnreliableRemoteEvent` | a request that may be lost   |
 * | `Push`    | `RemoteEvent`           | server to client, no reply   |
 *
 * `Push` is here for `Illuminate\Broadcasting` to pick up; nothing writes to
 * it yet. `RemoteFunction:InvokeClient` is deliberately absent: the server
 * would wait on a client that may never answer.
 */

const REMOTES_FOLDER = 'Larablox';

const ReplicatedStorage = game.GetService('ReplicatedStorage');

/** Which remote a request arrived on, or should leave on. */
export type Transport = 'call' | 'send' | 'stream';

/** What a handled request looks like once it is flat enough to replicate. */
export interface ResponseEnvelope
{
    /** The HTTP-shaped status code the handler answered with. */
    status: number;

    /** The response content, already a replicable value. */
    data?: unknown;

    /** The headers, flattened out of the response's ordered map. */
    headers?: Record<string, string>;
}

/**
 * What the gateway accepts before it will look at a request at all.
 *
 * Provisional: the numbers are placeholders until they are measured against a
 * running server, which is what the routing design calls for. They are checked
 * before routing so that a malformed or oversized payload costs as little as
 * possible.
 */
export const RemoteLimits = {
    /** The longest path a request may address. */
    path: 256,

    /** The longest verb a request may use. */
    method: 10,

    /** How deeply the payload may nest tables. */
    depth: 8,

    /** How many values the payload may hold in total. */
    nodes: 512,
};

/** Locates the remotes, and caches what it finds. */
export class Remote
{
    private static folderInstance?: Folder;

    private static callRemote?: RemoteFunction;

    private static sendRemote?: RemoteEvent;

    private static streamRemote?: UnreliableRemoteEvent;

    private static pushRemote?: RemoteEvent;

    /**
     * The folder holding the remotes.
     *
     * `WaitForChild` returns at once on the server, where the instances come
     * with the place file, and blocks on a client only until replication
     * catches up.
     */
    public static folder(): Folder
    {
        if (Remote.folderInstance === undefined) {
            Remote.folderInstance = ReplicatedStorage.WaitForChild(REMOTES_FOLDER) as Folder;
        }

        return Remote.folderInstance;
    }

    /** The remote carrying requests that expect a response. */
    public static call(): RemoteFunction
    {
        if (Remote.callRemote === undefined) {
            Remote.callRemote = Remote.folder().WaitForChild('Call') as RemoteFunction;
        }

        return Remote.callRemote;
    }

    /** The remote carrying requests that expect no response. */
    public static send(): RemoteEvent
    {
        if (Remote.sendRemote === undefined) {
            Remote.sendRemote = Remote.folder().WaitForChild('Send') as RemoteEvent;
        }

        return Remote.sendRemote;
    }

    /**
     * The remote carrying requests that may be dropped.
     *
     * The engine caps an unreliable payload at 1000 bytes and drops anything
     * larger without a word.
     */
    public static stream(): UnreliableRemoteEvent
    {
        if (Remote.streamRemote === undefined) {
            Remote.streamRemote = Remote.folder().WaitForChild('Stream') as UnreliableRemoteEvent;
        }

        return Remote.streamRemote;
    }

    /** The remote carrying server-to-client traffic. */
    public static push(): RemoteEvent
    {
        if (Remote.pushRemote === undefined) {
            Remote.pushRemote = Remote.folder().WaitForChild('Push') as RemoteEvent;
        }

        return Remote.pushRemote;
    }
}
