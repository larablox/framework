import { Arr } from "Illuminate/Support/Arr";
import { Conditionable } from "Illuminate/Support/Traits/Conditionable";
import { InteractsWithData } from "Illuminate/Support/Traits/InteractsWithData";
import { Str } from "Illuminate/Support/Str";
import { Util } from "Illuminate/Container/Util";
import { data_get, data_set } from "Illuminate/Support/Helpers";
import type { ArrayAccessible } from "Illuminate/Support/Arr";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused in the code, but declaration emit writes the specifier from this import; without it the `.d.ts` keeps the baseUrl path, which no consumer can resolve.
import type { ConditionableShape } from "Illuminate/Support/Traits/Conditionable";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused in the code, but declaration emit writes the specifier from this import; without it the `.d.ts` keeps the baseUrl path, which no consumer can resolve.
import type { InteractsWithDataShape } from "Illuminate/Support/Traits/InteractsWithData";
import type { Route } from "Illuminate/Routing/Route";
import type { Transport } from "Illuminate/Http/Remote";

/**
 * PHP: `Illuminate\Http\Request`.
 *
 * PHP extends Symfony's request, which models an HTTP message: headers,
 * cookies, files, a session, a URL. None of that exists on a remote call, so
 * the class stands on its own and keeps the half that is actually about the
 * incoming data -- `InteractsWithInput` and, under it, `InteractsWithData`.
 *
 * One member has no PHP counterpart: `player()`. It is the identity of the
 * caller, and the engine supplies it as the first argument of every remote
 * event -- it cannot be forged from the client. In PHP that role is split
 * between `ip()`, the session and `user()`; `Illuminate\Auth` will sit on top
 * of this one.
 *
 * Not ported, for want of a protocol: headers, cookies, files, the session,
 * `url()`/`fullUrl()`/`root()`/`host()`, `ajax()`/`pjax()`/`prefetch()`,
 * `secure()`, the content-type negotiation of `InteractsWithContentTypes`, the
 * flash data of `InteractsWithFlashData`, `CanBePrecognitive`, and `json()`
 * (the payload is already a table). `user()` arrives with `Illuminate\Auth`.
 *
 * `toArray()` hands back a plain table rather than implementing `Arrayable`:
 * the payload crosses the remote boundary as an unordered Luau table, and the
 * ported contract promises an `Array` or an `OrderedMap`, neither of which
 * this is.
 */
export class Request extends InteractsWithData(Conditionable()) {
    /**
     * The player the request came from.
     *
     * Named apart from the `player()` accessor: a field and a method of the
     * same name both live in the class table and collide, which is why the
     * container calls its own field `sharedInstance`.
     */
    protected callingPlayer: Player;

    /** The verb the request was made with, uppercased. */
    protected requestMethod: string;

    /** The path the request was made to, without leading or trailing slashes. */
    protected requestPath: string;

    /** The input the request carries. */
    protected inputSource: ArrayAccessible;

    /**
     * The remote the request arrived on.
     *
     * PHP's counterpart is the scheme: it says how the request travelled, not
     * what it asks for, and a route may insist on one (`Route::reliable()`
     * ports `httpsOnly()`).
     */
    protected requestTransport: Transport;

    /** The route resolver callback. */
    protected routeResolver?: () => Route | undefined;

    /** Create a new request instance. */
    public constructor(
        player: Player,
        method: string,
        path: string,
        input: ArrayAccessible = {},
        transport: Transport = "call",
    ) {
        super();

        this.callingPlayer = player;
        this.requestMethod = method.upper();
        this.requestPath = Request.normalizePath(path);
        this.inputSource = input;
        this.requestTransport = transport;
    }

    /** Strip the slashes PHP's `getPathInfo()` would have left behind. */
    protected static normalizePath(path: string): string {
        const trimmed = Str.trim(path, "/");

        return trimmed === "" ? "/" : trimmed;
    }

    /**
     * Get the player that made the request.
     *
     * No PHP counterpart; see the class comment.
     */
    public player(): Player {
        return this.callingPlayer;
    }

    /** Get the request method. */
    public method(): string {
        return this.requestMethod;
    }

    /**
     * Get the remote the request arrived on.
     *
     * No PHP counterpart; the nearest thing is `getScheme()`.
     */
    public transport(): Transport {
        return this.requestTransport;
    }

    /** Checks if the request method is of specified type. */
    public isMethod(method: string): boolean {
        return this.requestMethod === method.upper();
    }

    /** Get the current path info for the request. */
    public path(): string {
        return this.requestPath;
    }

    /** Get all of the segments for the request path. */
    public segments(): Array<string> {
        const segments = new Array<string>();

        for (const segment of this.requestPath.split("/")) {
            if (segment !== "") {
                segments.push(segment);
            }
        }

        return segments;
    }

    /**
     * Get a segment from the URI (1 based index).
     *
     * PHP indexes segments from one, and so does Luau; unlike PHP this needs no
     * adjustment.
     */
    public segment(index: number, defaultValue?: string): string | undefined {
        return this.segments()[index - 1] ?? defaultValue;
    }

    /** Determine if the current request URI matches a pattern. */
    public is(...patterns: Array<string>): boolean {
        return Str.is(patterns, this.decodedPath());
    }

    /**
     * Get the current decoded path info for the request.
     *
     * There is nothing to percent-decode on a remote call, so this is `path()`;
     * the method is kept because `is()` is written in terms of it in PHP.
     */
    public decodedPath(): string {
        return this.requestPath;
    }

    /** Get the route handling the request. */
    public route(param?: string, defaultValue?: unknown): unknown {
        const route = this.getRouteResolver()();

        if (route === undefined || param === undefined) {
            return route;
        }

        return route.parameter(param, defaultValue);
    }

    /** Determine if the route name matches a given pattern. */
    public routeIs(...patterns: Array<string>): boolean {
        const route = this.getRouteResolver()();

        return route !== undefined && route.named(...patterns);
    }

    /** Get the route resolver callback. */
    public getRouteResolver(): () => Route | undefined {
        return this.routeResolver ?? (() => undefined);
    }

    /** Set the route resolver callback. */
    public setRouteResolver(callback: () => Route | undefined): this {
        this.routeResolver = callback;

        return this;
    }

    /** Get all of the input for the request. */
    public all(keys?: string | Array<string>): ArrayAccessible {
        const input = table.clone(this.inputSource);

        if (keys === undefined) {
            return input;
        }

        const results: ArrayAccessible = {};

        for (const key of Util.arrayWrap(keys)) {
            Arr.set(results, key, Arr.get(input, key));
        }

        return results;
    }

    /** Retrieve an input item from the request. */
    public input(key?: string, defaultValue?: unknown): unknown {
        return data_get(this.inputSource, key, defaultValue);
    }

    /**
     * Get the keys for all of the input.
     *
     * A Luau table has no defined iteration order, so neither has this list --
     * PHP returns the keys in insertion order.
     */
    public keys(): Array<string> {
        const keys = new Array<string>();

        for (const [key] of pairs(this.inputSource)) {
            keys.push(key as string);
        }

        return keys;
    }

    /** Retrieve data from the instance. */
    protected data(key?: string, defaultValue?: unknown): unknown {
        return this.input(key, defaultValue);
    }

    /**
     * Merge new input into the current request's input array.
     *
     * PHP folds the new entries in with `data_set()`, not with a plain
     * assignment, so a dotted key writes into the nested structure --
     * `merge(['user.last_name' => 'Otwell'])` reaches `user`, it does not
     * add a top-level key spelled `user.last_name`.
     */
    public merge(input: ArrayAccessible): this {
        for (const [key, value] of pairs(input)) {
            data_set(this.inputSource, key as string, value);
        }

        return this;
    }

    /** Merge new input into the request's input, but only when that key is missing. */
    public mergeIfMissing(input: ArrayAccessible): this {
        for (const [key, value] of pairs(input)) {
            if (this.missing(key as string)) {
                data_set(this.inputSource, key as string, value);
            }
        }

        return this;
    }

    /** Replace the input values for the current request. */
    public replace(input: ArrayAccessible): this {
        this.inputSource = input;

        return this;
    }

    /** Get the input source for the request. */
    public getInputSource(): ArrayAccessible {
        return this.inputSource;
    }

    /** Get all of the input and files for the request. */
    public toArray(): ArrayAccessible {
        return this.all();
    }

    /** Determine if the given offset exists. */
    public offsetExists(offset: string): boolean {
        return Arr.has(this.all(), offset);
    }

    /** Get the value at the given offset. */
    public offsetGet(offset: string): unknown {
        return data_get(this.all(), offset);
    }

    /** Set the value at the given offset. */
    public offsetSet(offset: string, value: unknown): void {
        this.inputSource[offset] = value;
    }

    /** Remove the value at the given offset. */
    public offsetUnset(offset: string): void {
        delete this.inputSource[offset];
    }
}
