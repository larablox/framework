import { LogicException } from 'Illuminate/Exception';
import { Util } from 'Illuminate/Container/Util';
import type { AbstractClass } from 'Illuminate/Container/Types';
import type { Pipe } from 'Illuminate/Contracts/Pipeline/Pipeline';

/**
 * PHP: `[Controller::class, 'method']`.
 *
 * The string spelling `'Controller@method'` is not ported: there is no class
 * string and no autoloader to turn one back into a class.
 */
export type ControllerAction = [AbstractClass, string];

/** What a route runs: a closure, or a controller method. */
export type ActionTarget = Callback | ControllerAction;

/**
 * PHP: the route's `$action` array.
 *
 * PHP keeps it as an associative array with well-known keys; the keys are
 * spelled out here instead, which is what an associative array with a fixed
 * shape is in TypeScript. `namespace` and `domain` have no meaning without
 * PSR-4 and without hosts, so they are absent.
 */
export interface ActionAttributes
{
    /** What the route runs. */
    uses?: ActionTarget;

    /** The controller behind `uses`, when there is one. */
    controller?: ControllerAction;

    /** The route name, or the name prefix when it comes from a group. */
    as?: string;

    /** The URI prefix contributed by the enclosing groups. */
    prefix?: string;

    /** The middleware the route runs through. */
    middleware?: Array<Pipe>;

    /** The middleware the route opts out of. */
    excluded_middleware?: Array<Pipe>;

    /** The patterns the route's parameters have to match. */
    where?: Record<string, string>;
}

/**
 * PHP: `Illuminate\Routing\RouteAction`.
 *
 * `makeInvokable` (a controller class alone, dispatched to `__invoke`) and the
 * serialized-closure branch are not ported: there is no `__invoke` and a
 * closure does not serialize.
 */
export class RouteAction
{
    /** Parse the given action into an array format. */
    public static parse(uri: string, action?: ActionTarget | ActionAttributes): ActionAttributes
    {
        // If no action is passed in right away, we assume the user will make use of
        // fluent routing. In that case, we set a default closure, to be executed
        // if the user never explicitly sets an action to handle the given uri.
        if (action === undefined) {
            return RouteAction.missingAction(uri);
        }

        if (typeIs(action, 'function')) {
            return { uses: action };
        }

        if (RouteAction.isControllerAction(action)) {
            return { uses: action, controller: action };
        }

        const attributes = action as ActionAttributes;

        if (attributes.uses === undefined) {
            throw new LogicException(
                `Route for [${uri}] has no action: give it a closure, a [Controller, "method"] pair, or a "uses" key.`,
            );
        }

        if (RouteAction.isControllerAction(attributes.uses)) {
            attributes.controller = attributes.uses;
        }

        return attributes;
    }

    /**
     * Determine whether the given value is a controller and method pair.
     *
     * PHP asks `Reflector::isCallable($action, true)`; the shape is checked
     * here instead -- a two-element list whose second element is a string.
     */
    public static isControllerAction(action: unknown): action is ControllerAction
    {
        if (!Util.isArray(action)) {
            return false;
        }

        const pair = action as Array<unknown>;

        return pair.size() === 2 && typeIs(pair[1], 'string');
    }

    /** Get an action for a route that has no action. */
    protected static missingAction(uri: string): ActionAttributes
    {
        return {
            uses: () => {
                throw new LogicException(`Route for [${uri}] has no action.`);
            },
        };
    }
}
