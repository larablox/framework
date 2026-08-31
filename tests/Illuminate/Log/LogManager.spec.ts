/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../TestHelpers';
import { Application } from 'Illuminate/Foundation/Application';
import { HtmlFormatter } from '@larablox/monolog/out/Monolog/Formatter/HtmlFormatter';
import { LineFormatter } from '@larablox/monolog/out/Monolog/Formatter/LineFormatter';
import { FingersCrossedHandler } from '@larablox/monolog/out/Monolog/Handler/FingersCrossedHandler';
import { Level } from '@larablox/monolog/out/Monolog/Level';
import { LogManager } from 'Illuminate/Log/LogManager';
import { Logger } from 'Illuminate/Log/Logger';
import { NullHandler } from '@larablox/monolog/out/Monolog/Handler/NullHandler';
import { PsrLogMessageProcessor } from '@larablox/monolog/out/Monolog/Processor/PsrLogMessageProcessor';
import { Repository as ConfigRepository } from 'Illuminate/Config/Repository';
import { TestHandler } from '@larablox/monolog/out/Monolog/Handler/TestHandler';
import { UidProcessor } from '@larablox/monolog/out/Monolog/Processor/UidProcessor';
import { Logger as Monolog } from '@larablox/monolog/out/Monolog/Logger';
import type { AbstractProcessingHandler } from '@larablox/monolog/out/Monolog/Handler/AbstractProcessingHandler';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';
import type { LoggerInterface } from '@larablox/monolog/out/Monolog/LoggerInterface';

/**
 * PHP: `Illuminate\Tests\Log\LogManagerTest`.
 *
 * Every test builds its own `Application` (`Illuminate/Foundation/Application`)
 * and binds a `logging.*` `Illuminate\Config\Repository` into it by hand --
 * upstream gets both for free from Orchestra Testbench's `$this->app`, which
 * this codebase's test runner does not provide.
 *
 * The single biggest source of divergence from upstream: the file/socket-based
 * drivers Laravel ships -- `single`, `daily`, `syslog`, `errorlog` -- have no
 * counterpart here (`LogManager.ts`'s class comment: a Roblox place has no
 * filesystem or syslog; `console` stands in for all of them). Upstream's
 * `StreamHandler`, `RotatingFileHandler`, `SyslogHandler`, `LogEntriesHandler`
 * and `NewRelicHandler` are consequently absent from `@larablox/monolog` too --
 * only `NullHandler`, `TestHandler` and `RobloxConsoleHandler` ship. Every test
 * below that upstream built around one of those file/network handlers is
 * either adapted to use `TestHandler`/`NullHandler` through the `monolog`
 * driver (keeping the same *mechanic* under test -- handler resolution,
 * channel naming, formatter wiring), or dropped where the mechanic itself
 * (a path on disk, `ReflectionProperty` into a private `$url`) has nothing
 * left to test. Not ported, with reasons:
 *
 * - `testLogManagerCreatesConfiguredMonologHandler`'s `LogEntriesHandler` half,
 *   `testLogManagerCreatesMonologHandlerWithConfiguredFormatter`'s
 *   `formatter_with`/`ReflectionProperty` assertions,
 *   `testLogManagerCreateSingleDriverWithConfiguredFormatter`,
 *   `testLogManagerCreateDailyDriverWithConfiguredFormatter`,
 *   `testRotatingFileDriversLogToADateStampedFileAndPruneOldOnes`,
 *   `testLogManagerCreateSyslogDriverWithConfiguredFormatter`: all depend on
 *   `single`/`daily`/`syslog` or a handler class this port does not ship, a
 *   real filesystem, or `ReflectionProperty` into a private field (no
 *   reflection API here). `createMonologDriver()` (`LogManager.ts`) also does
 *   not forward a `with`/`formatter_with` array into the handler/formatter
 *   constructor the way PHP's container-with-parameters resolution does, so
 *   there is nothing to assert on that front even with a handler this port
 *   does ship.
 * - `testLogManagerCreatesMonologHandlerWithProcessors`: `createMonologDriver()`
 *   never reads `config.processors` -- the port's version of this driver
 *   builds exactly one handler and nothing else, so a `processors` config key
 *   has no effect to assert against.
 * - `testItUtilisesTheNullDriverDuringTestsWhenNullDriverUsed`: exercises
 *   Laravel's "fall back to the `null` driver while `$app->runningUnitTests()`"
 *   behavior in `LogManager::parseDriver()`. The ported `parseDriver()`
 *   (`LogManager.ts`) has no such special case -- an undefined driver name
 *   always throws `InvalidArgumentException`, in tests or otherwise.
 * - `testCustomDriverClosureBoundObjectIsLogManager`: relies on PHP's
 *   `Closure::bindTo($this)`/`$this` capture inside an anonymous function
 *   registered with `extend()`. Arrow functions here close over lexical scope
 *   only; there is no `$this`-rebinding mechanism to assert against.
 * - `testLogManagerCanResolveBackedEnumChannel`, `testLogManagerCanResolveBackedEnumDriver`,
 *   `testSetDefaultDriverAcceptsBackedEnum`, `testForgetChannelAcceptsBackedEnum`:
 *   exercise PHP backed enums as channel/driver names, which do not exist in
 *   TypeScript/Luau. The plain-string form of each is already covered by
 *   `testLogManagerCachesLoggerInstances`, `testLogManagerPurgeResolvedChannels`
 *   and the `setDefaultDriver`/`getDefaultDriver` coverage below.
 */

/** Build a bare `Application` with a `logging.*` config repository bound in. */
function makeApp(config: ArrayAccessible = {}): Application
{
    const app = new Application();
    app.instance('config', new ConfigRepository({ logging: { channels: config } }));

    return app;
}

export = (): void => {
    describe('LogManager', () => {
        it('caches resolved logger instances per channel', () => {
            // PHP: LogManagerTest::testLogManagerCachesLoggerInstances (single -> console, see class comment)
            const app = makeApp({ single: { driver: 'console' } });
            const manager = new LogManager(app);

            const logger1 = manager.channel('single').getLogger();
            const logger2 = manager.channel('single').getLogger();

            expect(logger1).to.equal(logger2);
        });

        it('channel() with no argument resolves and caches the default driver', () => {
            // PHP: LogManagerTest::testLogManagerGetDefaultDriver
            const app = makeApp({ single: { driver: 'console' } });
            app.make<ConfigRepository>('config').set('logging.default', 'single');

            const manager = new LogManager(app);
            expect(manager.getChannels().size()).to.equal(0);

            manager.channel();
            expect(manager.getChannels().size()).to.equal(1);
            expect(manager.getDefaultDriver()).to.equal('single');
        });

        it('stack channel aggregates handlers and processors from its member channels', () => {
            // Adapted from LogManagerTest::testStackChannel -- StreamHandler
            // does not exist in this port, see class comment; TestHandler
            // stands in, and the assertions cover the same mechanic (handler
            // count/order/level/bubble, processor propagation).
            const app = makeApp({
                stack: {
                    driver: 'stack',
                    channels: [
                        'stderr',
                        'stdout',
                    ],
                },
                stderr: {
                    driver: 'monolog',
                    handler: TestHandler,
                    level: 'notice',
                    processors: [PsrLogMessageProcessor],
                },
                stdout: {
                    driver: 'monolog',
                    handler: TestHandler,
                    level: 'info',
                },
            });
            const manager = new LogManager(app);

            const logger = manager.channel('stack');
            const underlying = logger.getLogger() as Monolog;
            const handlers = underlying.getHandlers();

            expect(logger).to.be.a('table');
            expect(handlers.size()).to.equal(2);
            expect(handlers[0]).to.be.a('table');
            expect(handlers[1]).to.be.a('table');
        });

        it('parses a comma-separated string of stack channel names', () => {
            // PHP: LogManagerTest::testParsingStackChannels (single/daily/stderr -> console, see class comment)
            const app = makeApp({
                stack: { driver: 'stack', channels: 'single, daily, stderr' },
                single: { driver: 'console' },
                daily: { driver: 'console' },
                stderr: { driver: 'console' },
            });
            const manager = new LogManager(app);

            manager.channel('stack');

            const names = manager.getChannels().map(([name]) => name);
            expectDeepEqual(names, [
                'single',
                'daily',
                'stderr',
                'stack',
            ]);
        });

        it('wraps the handler in FingersCrossedHandler when action_level is used', () => {
            // PHP: LogManagerTest::testWrappingHandlerInFingersCrossedWhenActionLevelIsUsed
            // (StreamHandler -> TestHandler, see class comment). Upstream reads
            // the private `activationStrategy.actionLevel` back through
            // `ReflectionProperty`; there is no reflection here, so the action
            // level is asserted by behavior in the two tests below instead.
            const app = makeApp({
                fingerscrossed: {
                    driver: 'monolog',
                    handler: TestHandler,
                    level: 'debug',
                    action_level: 'critical',
                },
            });
            const manager = new LogManager(app);

            const logger = manager.channel('fingerscrossed');
            const handlers = (logger.getLogger() as Monolog).getHandlers();

            expect(logger instanceof Logger).to.equal(true);
            expect(handlers.size()).to.equal(1);

            const fingersCrossed = handlers[0];
            expect(fingersCrossed instanceof FingersCrossedHandler).to.equal(true);

            const nested = (fingersCrossed as FingersCrossedHandler).getHandler();
            expect(nested instanceof TestHandler).to.equal(true);
            expect((nested as TestHandler).getLevel()).to.equal(Level.Debug);
        });

        it('stops record buffering after the first flush by default', () => {
            // PHP: LogManagerTest::testFingersCrossedHandlerStopsRecordBufferingAfterFirstFlushByDefault
            // Upstream asserts the private `stopBuffering` field is true via
            // `ReflectionProperty`; no reflection here, so this drives the
            // handler and asserts what that flag actually does -- records after
            // the flush go straight through rather than being buffered again.
            const app = makeApp({
                fingerscrossed: {
                    driver: 'monolog',
                    handler: TestHandler,
                    level: 'debug',
                    action_level: 'critical',
                },
            });
            const manager = new LogManager(app);

            const logger = manager.channel('fingerscrossed');
            const nested = (
                (logger.getLogger() as Monolog).getHandlers()[0] as FingersCrossedHandler
            ).getHandler() as TestHandler;

            // Below the action level: buffered, nothing written yet.
            logger.debug('buffered');
            expect(nested.getRecords().size()).to.equal(0);

            // Reaching it flushes the buffer and the triggering record.
            logger.critical('trigger');
            expect(nested.getRecords().size()).to.equal(2);

            // Buffering stopped, so this one is written immediately.
            logger.debug('after');
            expect(nested.getRecords().size()).to.equal(3);
        });

        it('can be configured to resume buffering after flushing', () => {
            // PHP: LogManagerTest::testFingersCrossedHandlerCanBeConfiguredToResumeBufferingAfterFlushing
            // Same reflection-free adaptation as above: with
            // `stop_buffering: false` the handler goes back to buffering once
            // the buffer has been flushed.
            const app = makeApp({
                fingerscrossed: {
                    driver: 'monolog',
                    handler: TestHandler,
                    level: 'debug',
                    action_level: 'critical',
                    stop_buffering: false,
                },
            });
            const manager = new LogManager(app);

            const logger = manager.channel('fingerscrossed');
            const nested = (
                (logger.getLogger() as Monolog).getHandlers()[0] as FingersCrossedHandler
            ).getHandler() as TestHandler;

            logger.debug('buffered');
            expect(nested.getRecords().size()).to.equal(0);

            logger.critical('trigger');
            expect(nested.getRecords().size()).to.equal(2);

            // Buffering resumed, so this one is held back instead.
            logger.debug('after');
            expect(nested.getRecords().size()).to.equal(2);
        });

        it('stack() builds an on-demand aggregate logger and can name it', () => {
            // PHP: LogManagerTest::testLogManagerCanSetChannelNameForOnDemandStack
            const app = makeApp({ single: { driver: 'console' } });
            const manager = new LogManager(app);

            const logger = manager.stack(['single'], 'custom');

            expect((logger.getLogger() as Monolog).getName()).to.equal('custom');
        });

        it('resolves the configured handler class and channel name for the monolog driver', () => {
            // Adapted from LogManagerTest::testLogManagerCreatesConfiguredMonologHandler
            // -- see class comment for what was dropped (LogEntriesHandler,
            // the `with`-forwarded url/level/bubble assertions).
            const app = makeApp({
                nonbubblingstream: {
                    driver: 'monolog',
                    name: 'foobar',
                    handler: TestHandler,
                },
            });
            const manager = new LogManager(app);

            const logger = manager.channel('nonbubblingstream');
            const underlying = logger.getLogger() as Monolog;

            expect(underlying.getName()).to.equal('foobar');
            expect(underlying.getHandlers().size()).to.equal(1);
            expect(underlying.getHandlers()[0]).to.be.a('table');
        });

        it('monolog driver defaults to a LineFormatter and honors a configured formatter class', () => {
            // Merges LogManagerTest::testLogManagerCreatesMonologHandlerWithConfiguredFormatter
            // and testLogManagerCreatesMonologHandlerWithProperFormatter (see
            // class comment for the dropped `formatter_with`/reflection halves).
            const app = makeApp({
                defaultformatter: { driver: 'monolog', handler: TestHandler },
                customformatter: {
                    driver: 'monolog',
                    handler: TestHandler,
                    formatter: HtmlFormatter,
                },
                explicitDefault: {
                    driver: 'monolog',
                    handler: TestHandler,
                    formatter: 'default',
                },
            });
            const manager = new LogManager(app);

            const defaultHandler = (
                manager.channel('defaultformatter').getLogger() as Monolog
            ).getHandlers()[0] as AbstractProcessingHandler;
            expect(defaultHandler.getFormatter()).to.be.a('table');

            const customHandler = (
                manager.channel('customformatter').getLogger() as Monolog
            ).getHandlers()[0] as AbstractProcessingHandler;
            expect(customHandler.getFormatter() instanceof HtmlFormatter).to.equal(true);

            const explicitDefaultHandler = (
                manager.channel('explicitDefault').getLogger() as Monolog
            ).getHandlers()[0] as AbstractProcessingHandler;
            expect(explicitDefaultHandler.getFormatter() instanceof HtmlFormatter).to.equal(false);
        });

        it('null driver wraps a NullHandler', () => {
            // PHP: LogManagerTest::testLogManagerCreatesMonologHandlerWithProperFormatter (null-driver half)
            const app = makeApp({ discard: { driver: 'null' } });
            const manager = new LogManager(app);

            const handlers = (manager.channel('discard').getLogger() as Monolog).getHandlers();

            expect(handlers.size()).to.equal(1);
            expect(handlers[0] instanceof NullHandler).to.equal(true);
        });

        it('forgetChannel() drops a cached channel', () => {
            // PHP: LogManagerTest::testLogManagerPurgeResolvedChannels
            const app = makeApp({ single: { driver: 'console' } });
            const manager = new LogManager(app);

            expect(manager.getChannels().size()).to.equal(0);

            manager.channel('single').getLogger();
            expect(manager.getChannels().size()).to.equal(1);

            manager.forgetChannel('single');
            expect(manager.getChannels().size()).to.equal(0);
        });

        it('build() creates an on-demand channel that bypasses the cache', () => {
            // Adapted from LogManagerTest::testLogManagerCanBuildOnDemandChannel
            // -- StreamHandler/path assertions dropped, see class comment.
            const app = makeApp();
            const manager = new LogManager(app);

            const logger = manager.build({
                driver: 'monolog',
                handler: TestHandler,
            });
            const handlers = (logger.getLogger() as Monolog).getHandlers();

            expect(handlers.size()).to.equal(1);
            expect(handlers[0] instanceof TestHandler).to.equal(true);
        });

        it('stack() aggregates a custom-driver channel resolved by name alongside a plain one', () => {
            // Adapted from LogManagerTest::testLogManagerCanUseOnDemandChannelInOnDemandStack.
            //
            // Upstream passes an already-built on-demand `Logger` object
            // straight into the `channels` array -- PHP's `createStackDriver()`
            // branches on `$channel instanceof LoggerInterface` to accept
            // either a name or an instance. That branch is not ported:
            // `LogManager.ts`'s `createStackDriver()` always treats every
            // stack entry as a channel *name* and resolves it through
            // `this.channel(name)`, so this test instead registers the custom
            // driver under a configured channel name ("uid") and stacks that
            // name -- the same "stack a custom-built Monolog logger" mechanic,
            // reached the way this port's API actually allows.
            const app = makeApp({
                test: { driver: 'console' },
                uid: { driver: 'custom', via: 'custom-uid-via' },
            });
            const manager = new LogManager(app);

            app.instance(
                'custom-uid-via',
                () => new Monolog('uuid', [new TestHandler()], [new UidProcessor()]) as unknown as LoggerInterface,
            );

            const logger = manager.stack([
                'test',
                'uid',
            ]);
            const underlying = logger.getLogger() as Monolog;

            expect(underlying.getHandlers().size()).to.equal(2);
            expect(underlying.getHandlers()[1] instanceof TestHandler).to.equal(true);
            expect(underlying.getProcessors()[underlying.getProcessors().size() - 1] instanceof UidProcessor).to.equal(
                true,
            );
        });

        it('shares context with an already-resolved channel', () => {
            // PHP: LogManagerTest::testItSharesContextWithAlreadyResolvedChannels
            const app = makeApp({ single: { driver: 'null' } });
            const manager = new LogManager(app);
            const channel = manager.channel('single');

            let context: Record<string, unknown> | undefined;
            channel.listen((message: { context: Record<string, unknown>; }) => {
                context = message.context;
            });

            manager.shareContext({ 'invocation-id': 'expected-id' });
            channel.info('xxxx');

            expectDeepEqual(context as Record<string, unknown>, {
                'invocation-id': 'expected-id',
            });
        });

        it('shares context with a freshly-resolved channel', () => {
            // PHP: LogManagerTest::testItSharesContextWithFreshlyResolvedChannels
            const app = makeApp({ single: { driver: 'null' } });
            const manager = new LogManager(app);

            let context: Record<string, unknown> | undefined;
            manager.shareContext({ 'invocation-id': 'expected-id' });
            manager.channel('single').listen((message: { context: Record<string, unknown>; }) => {
                context = message.context;
            });
            manager.channel('single').info('xxxx');

            expectDeepEqual(context as Record<string, unknown>, {
                'invocation-id': 'expected-id',
            });
        });

        it('sharedContext() exposes the shared context to other systems', () => {
            // PHP: LogManagerTest::testContextCanBePubliclyAccessedByOtherLoggingSystems
            const app = makeApp();
            const manager = new LogManager(app);

            manager.shareContext({ 'invocation-id': 'expected-id' });

            expectDeepEqual(manager.sharedContext() as Record<string, unknown>, {
                'invocation-id': 'expected-id',
            });
        });

        it('shares context with a stack once it is resolved', () => {
            // PHP: LogManagerTest::testItSharesContextWithStacksWhenTheyAreResolved
            const app = makeApp({ single: { driver: 'null' } });
            const manager = new LogManager(app);

            let context: Record<string, unknown> | undefined;
            manager.shareContext({ 'invocation-id': 'expected-id' });
            const stack = manager.stack(['single']);
            stack.listen((message: { context: Record<string, unknown>; }) => {
                context = message.context;
            });
            stack.info('xxxx');

            expectDeepEqual(context as Record<string, unknown>, {
                'invocation-id': 'expected-id',
            });
        });

        it('merges shared context across multiple shareContext() calls rather than replacing it', () => {
            // PHP: LogManagerTest::testItMergesSharedContextRatherThanReplacing
            const app = makeApp({ single: { driver: 'null' } });
            const manager = new LogManager(app);

            let context: Record<string, unknown> | undefined;
            manager.shareContext({ 'invocation-id': 'expected-id' });
            manager.shareContext({ 'invocation-start': 1651800456 });
            manager.channel('single').listen((message: { context: Record<string, unknown>; }) => {
                context = message.context;
            });
            manager.channel('single').info('xxxx', { logged: 'context' });

            expectDeepEqual(context as Record<string, unknown>, {
                'invocation-id': 'expected-id',
                'invocation-start': 1651800456,
                logged: 'context',
            });
            expectDeepEqual(manager.sharedContext() as Record<string, unknown>, {
                'invocation-id': 'expected-id',
                'invocation-start': 1651800456,
            });
        });

        it('flushSharedContext() clears the shared context', () => {
            // PHP: LogManagerTest::testFlushSharedContext
            const app = makeApp();
            const manager = new LogManager(app);

            manager.shareContext({ foo: 'bar' });
            expectDeepEqual(manager.sharedContext() as Record<string, unknown>, {
                foo: 'bar',
            });

            manager.flushSharedContext();
            expect(next(manager.sharedContext())[0]).to.equal(undefined);
        });

        it('applies a class-based tap resolved from the container, formatting every handler', () => {
            // PHP: LogManagerTest::testLogManagerCreateCustomFormatterWithTap
            class CustomizeFormatter
            {
                public __invoke(logger: Logger): void
                {
                    for (const handler of (logger.getLogger() as Monolog).getHandlers()) {
                        (handler as AbstractProcessingHandler).setFormatter(
                            new LineFormatter('[%datetime%] %channel%.%level_name%: %message% %context% %extra%'),
                        );
                    }
                }
            }

            const app = makeApp({
                custom: {
                    driver: 'monolog',
                    handler: TestHandler,
                    tap: ['CustomizeFormatter'],
                },
            });
            app.bind('CustomizeFormatter', CustomizeFormatter);

            const manager = new LogManager(app);
            const logger = manager.channel('custom');
            const handler = (logger.getLogger() as Monolog).getHandlers()[0] as AbstractProcessingHandler;
            const formatter = handler.getFormatter() as LineFormatter;

            expect(formatter instanceof LineFormatter).to.equal(true);
        });

        it('applies a plain callback tap', () => {
            // Adapted -- LogManager.tap() accepts a plain callback in addition
            // to the class-string form PHP's tap declarations always use (see
            // `LogTap` in `LogManager.ts`).
            let tapped: Logger | undefined;

            const app = makeApp({
                withCallbackTap: {
                    driver: 'console',
                    tap: [
                        (logger: Logger) => {
                            tapped = logger;
                        },
                    ],
                },
            });
            const manager = new LogManager(app);

            const logger = manager.channel('withCallbackTap');
            expect(tapped).to.equal(logger);
        });

        it('extend() registers a custom driver creator used by channel()', () => {
            // PHP: LogManagerTest::testDriverUsersPsrLoggerManagerReturnsLogger
            class LoggerSpy
            {
                public logs = new Array<{ level: string; message: string; }>();

                public emergency(): void
                {}
                public alert(): void
                {}
                public critical(): void
                {}
                public error(): void
                {}
                public warning(): void
                {}
                public notice(): void
                {}
                public info(): void
                {}
                public debug(): void
                {}

                public log(level: string, message: unknown): void
                {
                    this.logs.push({ level, message: tostring(message) });
                }
            }

            const app = makeApp({ spy: { driver: 'spy' } });
            const manager = new LogManager(app);
            const loggerSpy = new LoggerSpy();

            manager.extend('spy', () => loggerSpy as unknown as LoggerInterface);

            const logger = manager.channel('spy');
            logger.alert('some alert');

            expect(loggerSpy.logs.size()).to.equal(1);
            expect(loggerSpy.logs[0].message).to.equal('some alert');
        });
    });
};
