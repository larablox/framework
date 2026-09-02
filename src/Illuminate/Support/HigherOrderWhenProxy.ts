/**
 * PHP's bare `if ($value)` also coerces 0, '', '0' and [] to false; only the
 * scalar cases are handled here -- an empty Array/Map/OrderedMap reads as
 * truthy, unlike PHP.
 */
export function truthy(value: unknown): boolean
{
    return value !== undefined && value !== false && value !== 0 && value !== '' && value !== '0';
}

export class HigherOrderWhenProxy<T extends object>
{
    /** The target being conditionally operated on. */
    protected target: T;

    /** The condition for proxying. */
    protected _condition?: unknown;

    /** Indicates whether the proxy has a condition. */
    protected hasCondition = false;

    /** Determine whether the condition should be negated. */
    protected _negateConditionOnCapture?: boolean;

    /** Create a new proxy instance. */
    public constructor(target: T)
    {
        this.target = target;
    }

    /** Set the condition on the proxy. */
    public condition(condition: unknown): this
    {
        [this._condition, this.hasCondition] = [condition, true];

        return this;
    }

    /** Indicate that the condition should be negated. */
    public negateConditionOnCapture(): this
    {
        this._negateConditionOnCapture = true;

        return this;
    }

    /** Proxy accessing an attribute onto the target. */
    public __get(key: string): unknown
    {
        if (!this.hasCondition) {
            const condition = (this.target as unknown as Record<string, unknown>)[key];

            return this.condition(this._negateConditionOnCapture ? !truthy(condition) : condition);
        }

        return truthy(this._condition)
            ? (this.target as unknown as Record<string, unknown>)[key]
            : this.target;
    }

    /** Proxy a method call on the target. */
    public ___call(method: string, parameters: unknown[]): unknown
    {
        if (!this.hasCondition) {
            const condition = ((this.target as unknown as Record<string, unknown>)[method] as (...args: unknown[]) => unknown)(this.target, ...parameters);

            return this.condition(this._negateConditionOnCapture ? !truthy(condition) : condition);
        }

        return truthy(this._condition)
            ? ((this.target as unknown as Record<string, unknown>)[method] as (...args: unknown[]) => unknown)(this.target, ...parameters)
            : this.target;
    }
}
