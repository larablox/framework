import { RobloxConsoleHandler } from '@larablox/monolog/out/Monolog/Handler/RobloxConsoleHandler';
import { ContextLogProcessor as ContextLogProcessorContract } from 'Illuminate/Contracts/Log/ContextLogProcessor';
import { FingersCrossedHandler } from '@larablox/monolog/out/Monolog/Handler/FingersCrossedHandler';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Level, Levels } from '@larablox/monolog/out/Monolog/Level';
import { LineFormatter } from '@larablox/monolog/out/Monolog/Formatter/LineFormatter';
import { Logger } from 'Illuminate/Log/Logger';
import { Logger as Monolog } from '@larablox/monolog/out/Monolog/Logger';
import { NullHandler } from '@larablox/monolog/out/Monolog/Handler/NullHandler';
import { OrderedMap } from 'Illuminate/Support/OrderedMap';
import { Str } from 'Illuminate/Support/Str';
import { Util } from 'Illuminate/Container/Util';
import { WhatFailureGroupHandler } from '@larablox/monolog/out/Monolog/Handler/WhatFailureGroupHandler';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { Application } from 'Illuminate/Contracts/Foundation/Application';
import type { Dispatcher } from 'Illuminate/Contracts/Events/Dispatcher';
import type { FormatterInterface } from '@larablox/monolog/out/Monolog/Formatter/FormatterInterface';
import type { HandlerInterface } from '@larablox/monolog/out/Monolog/Handler/HandlerInterface';
import type { LogContext, LogLevel, Logger as LoggerContract } from 'Illuminate/Contracts/Log/Logger';
import type { Processor } from '@larablox/monolog/out/Monolog/Processor/ProcessorInterface';
import type { Repository } from 'Illuminate/Contracts/Config/Repository';

/** A factory registered through `extend()`. */
export type LogDriverCreator = (app: Application, config: ArrayAccessible) => LoggerContract;

/** A tap: `__invoke($logger)` in PHP, a plain callback here. */
export type LogTap = (logger: Logger, ...args: Array<string>) => void;

/**
 * PHP: `Illuminate\Log\LogManager`.
 *
 * The Monolog layer it builds on is the `@larablox/monolog` package. The
 * drivers that wrote to a file, a socket or syslog -- `single`, `daily`,
 * `slack`, `syslog`, `errorlog` -- have no counterpart on this platform;
 * `console` takes their place and writes to the Roblox output through
 * `RobloxConsoleHandler`. `stack`,
 * `monolog`, `null` and `custom` are ported as they are.
 *
 * `ParsesLogConfiguration` is a trait in PHP; its `level()`, `actionLevel()`
 * and `parseChannel()` are folded in here.
 */
export class LogManager implements LoggerContract
{
    /** The array of resolved channels. */
    protected channels = new OrderedMap<string, Logger>();

    /** The registered custom driver creators. */
    protected customCreators = new OrderedMap<string, LogDriverCreator>();

    /** The context shared across channels and stacks. */
    protected sharedContextValues: LogContext = {};

    /** The standard date format to use when writing logs. */
    protected dateFormat = '%Y-%m-%d %H:%M:%S';

    /** Create a new Log manager instance. */
    public constructor(protected app: Application)
    {}

    /** Build an on-demand log channel. */
    public build(config: ArrayAccessible): Logger
    {
        this.channels.delete('ondemand');

        return this.get('ondemand', config);
    }

    /** Create a new, on-demand aggregate logger instance. */
    public stack(channels: Array<string>, channel?: string): Logger
    {
        return new Logger(
            // PHP passes the channel name under `name`, which is the key
            // `parseChannel()` reads; under `channel` it would never be seen
            // and the stack would fall back to the default channel name.
            this.createStackDriver({
                channels,
                name: channel,
            } as unknown as ArrayAccessible),
            this.events(),
        ).withContext(this.sharedContextValues);
    }

    /** Get a log channel instance. */
    public channel(channel?: string): Logger
    {
        return this.driver(channel);
    }

    /** Get a log driver instance. */
    public driver(driver?: string): Logger
    {
        return this.get(this.parseDriver(driver));
    }

    /** Attempt to get the log from the local cache. */
    protected get(name: string, config?: ArrayAccessible): Logger
    {
        const cached = this.channels.get(name);

        if (cached !== undefined) {
            return cached;
        }

        const [ok, resolved] = pcall(() => this.resolve(name, config));

        if (!ok) {
            const emergency = this.createEmergencyLogger();

            emergency.emergency('Unable to create configured logger. Using emergency logger.', {
                exception: tostring(resolved),
            });

            return emergency;
        }

        const logger = this.tap(name, new Logger(resolved as LoggerContract, this.events())).withContext(
            this.sharedContextValues,
        );

        const underlying = logger.getLogger();

        if (underlying instanceof Monolog && this.app.bound(ContextLogProcessorContract)) {
            underlying.pushProcessor(this.app.make(ContextLogProcessorContract) as unknown as Processor);
        }

        this.channels.set(name, logger);

        return logger;
    }

    /**
     * Apply the configured taps for the logger.
     *
     * PHP resolves each tap out of the container and invokes it; a tap is
     * written as `Class:argument,argument` in the channel configuration, and a
     * plain callback is accepted too.
     */
    protected tap(name: string, logger: Logger): Logger
    {
        const taps = (this.configurationFor(name)?.tap ?? []) as Array<string | LogTap>;

        for (const entry of taps) {
            if (typeIs(entry, 'function')) {
                (entry as LogTap)(logger);

                continue;
            }

            const [target, argumentList] = this.parseTap(entry as string);
            const tap = this.app.make(target);
            const args = argumentList === '' ? [] : argumentList.split(',');

            if (typeIs(tap, 'function')) {
                (tap as unknown as Callback)(logger, ...args);

                continue;
            }

            // PHP invokes the tap object; Luau has no `__call`, so the tap
            // declares an `__invoke` method and the receiver is passed by hand
            // -- roblox-ts compiles a call through a function-valued property
            // as a dot call, which would drop it.
            const invoke = (tap as Record<string, unknown>).__invoke;

            if (!typeIs(invoke, 'function')) {
                throw new InvalidArgumentException(`Log tap [${target}] has no __invoke method.`);
            }

            (invoke as Callback)(tap, logger, ...args);
        }

        return logger;
    }

    /** Parse the given tap class string into a class name and arguments string. */
    protected parseTap(tap: string): [string, string]
    {
        return Str.contains(tap, ':') ? [Str.before(tap, ':'), Str.after(tap, ':')] : [tap, ''];
    }

    /** Create an emergency log handler to avoid white screens of death. */
    protected createEmergencyLogger(): Logger
    {
        const handler = new RobloxConsoleHandler(Level.Debug);

        return new Logger(new Monolog('larablox', this.prepareHandlers([handler])), this.events());
    }

    /** Resolve the given log instance by name. */
    protected resolve(name: string, config?: ArrayAccessible): LoggerContract
    {
        const resolved = config ?? this.configurationFor(name);

        if (resolved === undefined) {
            throw new InvalidArgumentException(`Log [${name}] is not defined.`);
        }

        const driver = resolved.driver as string | undefined;

        if (driver === undefined) {
            throw new InvalidArgumentException(`Log [${name}] is missing a driver.`);
        }

        const custom = this.customCreators.get(driver);

        if (custom !== undefined) {
            return this.callCustomCreator(driver, resolved);
        }

        if (driver === 'console') {
            return this.createConsoleDriver(resolved);
        }

        if (driver === 'stack') {
            return this.createStackDriver(resolved);
        }

        if (driver === 'monolog') {
            return this.createMonologDriver(resolved);
        }

        if (driver === 'null') {
            return this.createNullDriver(resolved);
        }

        if (driver === 'custom') {
            return this.createCustomDriver(resolved);
        }

        throw new InvalidArgumentException(`Driver [${driver}] is not supported.`);
    }

    /** Call a custom driver creator. */
    protected callCustomCreator(driver: string, config: ArrayAccessible): LoggerContract
    {
        return (this.customCreators.get(driver) as LogDriverCreator)(this.app, config);
    }

    /** Create an instance of a custom-made driver. */
    protected createCustomDriver(config: ArrayAccessible): LoggerContract
    {
        const via = config.via;

        if (typeIs(via, 'function')) {
            return (via as (config: ArrayAccessible) => LoggerContract)(config);
        }

        const factory = this.app.make(via as string) as (config: ArrayAccessible) => LoggerContract;

        return factory(config);
    }

    /**
     * Create an instance of the console log driver.
     *
     * Stands in for PHP's `single`, `daily` and `errorlog` drivers: those write
     * to a file or the platform log, and the output window is what a place has.
     */
    protected createConsoleDriver(config: ArrayAccessible): LoggerContract
    {
        const handler = new RobloxConsoleHandler(this.level(config), (config.bubble ?? true) === true);

        return new Monolog(this.parseChannel(config), [this.prepareHandler(handler, config)]);
    }

    /** Create an aggregate log driver instance. */
    protected createStackDriver(config: ArrayAccessible): LoggerContract
    {
        const names = Util.isArray(config.channels)
            ? (config.channels as Array<string>)
            : tostring(config.channels ?? '').split(',');

        let handlers = new Array<HandlerInterface>();
        const processors = new Array<Processor>();

        for (const name of names) {
            const underlying = this.channel(name).getLogger();

            if (!(underlying instanceof Monolog)) {
                continue;
            }

            for (const handler of underlying.getHandlers()) {
                handlers.push(handler);
            }

            for (const processor of underlying.getProcessors()) {
                processors.push(processor);
            }
        }

        if (config.ignore_exceptions === true) {
            handlers = [new WhatFailureGroupHandler(handlers)];
        }

        return new Monolog(this.parseChannel(config), handlers, processors);
    }

    /** Create an instance of any handler available in Monolog. */
    protected createMonologDriver(config: ArrayAccessible): LoggerContract
    {
        const handler = config.handler;

        if (handler === undefined) {
            throw new InvalidArgumentException('The monolog driver requires a handler.');
        }

        const built = typeIs(handler, 'function')
            ? ((handler as Callback)(config.handler_with ?? {}) as HandlerInterface)
            : (this.app.make(handler as string) as unknown as HandlerInterface);

        return new Monolog(this.parseChannel(config), [this.prepareHandler(built, config)]);
    }

    /** Create an instance of the null log driver. */
    protected createNullDriver(config: ArrayAccessible): LoggerContract
    {
        return new Monolog(this.parseChannel(config), [new NullHandler()]);
    }

    /** Prepare the handlers for usage by Monolog. */
    protected prepareHandlers(handlers: Array<HandlerInterface>): Array<HandlerInterface>
    {
        const prepared = new Array<HandlerInterface>();

        for (const handler of handlers) {
            prepared.push(this.prepareHandler(handler));
        }

        return prepared;
    }

    /** Prepare the handler for usage by Monolog. */
    protected prepareHandler(handler: HandlerInterface, config: ArrayAccessible = {}): HandlerInterface
    {
        let prepared = handler;

        if (config.action_level !== undefined) {
            prepared = new FingersCrossedHandler(
                prepared,
                this.actionLevel(config),
                0,
                true,
                (config.stop_buffering ?? true) === true,
            );
        }

        const formattable = prepared as unknown as { setFormatter?: Callback; };

        if (!typeIs(formattable.setFormatter, 'function')) {
            return prepared;
        }

        if (config.formatter === undefined) {
            (formattable.setFormatter as Callback)(prepared, this.formatter());
        } else if (config.formatter !== 'default') {
            (formattable.setFormatter as Callback)(
                prepared,
                this.app.make(config.formatter as string) as unknown as FormatterInterface,
            );
        }

        return prepared;
    }

    /** Get a Monolog formatter instance. */
    protected formatter(): FormatterInterface
    {
        return new LineFormatter(undefined, this.dateFormat, true);
    }

    /** Share context across channels and stacks. */
    public shareContext(context: LogContext): this
    {
        for (const channel of this.channels.values()) {
            channel.withContext(context);
        }

        for (const [key, value] of pairs(context)) {
            this.sharedContextValues[key as string] = value;
        }

        return this;
    }

    /** The context shared across channels and stacks. */
    public sharedContext(): LogContext
    {
        return this.sharedContextValues;
    }

    /** Flush the log context on all currently resolved channels. */
    public withoutContext(keys?: Array<string>): this
    {
        for (const channel of this.channels.values()) {
            channel.withoutContext(keys);
        }

        return this;
    }

    /** Flush the shared context. */
    public flushSharedContext(): this
    {
        this.sharedContextValues = {};

        return this;
    }

    /** Get fallback log channel name. */
    protected getFallbackChannelName(): string
    {
        return this.app.bound('env') ? (this.app.environment() as string) : 'production';
    }

    /** Parse the string level from the given configuration. */
    protected level(config: ArrayAccessible): Level
    {
        const level = Levels.fromName((config.level ?? 'debug') as string);

        if (level === undefined) {
            throw new InvalidArgumentException('Invalid log level.');
        }

        return level;
    }

    /** Parse the action level from the given configuration. */
    protected actionLevel(config: ArrayAccessible): Level
    {
        const level = Levels.fromName((config.action_level ?? 'debug') as string);

        if (level === undefined) {
            throw new InvalidArgumentException('Invalid log action level.');
        }

        return level;
    }

    /** Extract the log channel from the given configuration. */
    protected parseChannel(config: ArrayAccessible): string
    {
        return (config.name ?? this.getFallbackChannelName()) as string;
    }

    /** Get the log connection configuration. */
    protected configurationFor(name: string): ArrayAccessible | undefined
    {
        return this.app.make<Repository>('config').get(`logging.channels.${name}`) as ArrayAccessible | undefined;
    }

    /** Get the default log driver name. */
    public getDefaultDriver(): string | undefined
    {
        return this.app.make<Repository>('config').get('logging.default') as string | undefined;
    }

    /** Set the default log driver name. */
    public setDefaultDriver(name: string): void
    {
        this.app.make<Repository>('config').set('logging.default', name);
    }

    /** Register a custom driver creator Closure. */
    public extend(driver: string, callback: LogDriverCreator): this
    {
        this.customCreators.set(driver, callback);

        return this;
    }

    /** Unset the given channel instance. */
    public forgetChannel(driver?: string): void
    {
        this.channels.delete(this.parseDriver(driver));
    }

    /** Parse the driver name. */
    protected parseDriver(driver?: string): string
    {
        const resolved = driver ?? this.getDefaultDriver();

        if (resolved === undefined) {
            throw new InvalidArgumentException('No default log channel is configured.');
        }

        // PHP trims here, which is what lets a stack spell its members as
        // `'single, daily, stderr'`: `createStackDriver()` splits that on the
        // comma and hands the pieces straight to `channel()`, spaces and all.
        return Str.trim(resolved);
    }

    /** Get all of the resolved log channels. */
    public getChannels(): Array<[string, Logger]>
    {
        return this.channels.entries();
    }

    /** Get the event dispatcher, if the container has one bound yet. */
    protected events(): Dispatcher | undefined
    {
        return this.app.bound('events') ? this.app.make<Dispatcher>('events') : undefined;
    }

    public emergency(message: unknown, context?: LogContext): void
    {
        this.driver().emergency(message, context);
    }

    public alert(message: unknown, context?: LogContext): void
    {
        this.driver().alert(message, context);
    }

    public critical(message: unknown, context?: LogContext): void
    {
        this.driver().critical(message, context);
    }

    public error(message: unknown, context?: LogContext): void
    {
        this.driver().error(message, context);
    }

    public warning(message: unknown, context?: LogContext): void
    {
        this.driver().warning(message, context);
    }

    public notice(message: unknown, context?: LogContext): void
    {
        this.driver().notice(message, context);
    }

    public info(message: unknown, context?: LogContext): void
    {
        this.driver().info(message, context);
    }

    public debug(message: unknown, context?: LogContext): void
    {
        this.driver().debug(message, context);
    }

    public log(level: LogLevel, message: unknown, context?: LogContext): void
    {
        this.driver().log(level, message, context);
    }

    /** Set the application instance used by the manager. */
    public setApplication(app: Application): this
    {
        this.app = app;

        return this;
    }
}
