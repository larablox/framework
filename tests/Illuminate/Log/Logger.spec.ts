/// <reference types="@rbxts/testez/globals" />
import { expectThrows } from "../TestHelpers";
import { Dispatcher } from "Illuminate/Events/Dispatcher";
import { Logger } from "Illuminate/Log/Logger";
import { MessageLogged } from "Illuminate/Log/Events/MessageLogged";
import { NullHandler } from "@larablox/monolog/out/Monolog/Handler/NullHandler";
import { TestHandler } from "@larablox/monolog/out/Monolog/Handler/TestHandler";
import { Level } from "@larablox/monolog/out/Monolog/Level";
import { Logger as Monolog } from "@larablox/monolog/out/Monolog/Logger";
import type { Dispatcher as DispatcherContract, EventName, Listener } from "Illuminate/Contracts/Events/Dispatcher";
import type { LogContext, LogLevel, Logger as LoggerContract } from "Illuminate/Contracts/Log/Logger";

/**
 * PHP: `Illuminate\Tests\Log\LogLoggerTest`.
 *
 * Upstream builds the underlying Monolog logger with Mockery
 * (`m::mock(Monolog::class)`) so it can assert exact call counts and
 * arguments without a real handler stack. There is no mocking library here
 * (`CLAUDE.md`), so a hand-written fake -- `RecordingLogger` below -- stands in
 * everywhere upstream mocks the underlying logger: it implements the same
 * `LoggerContract` PHP's `Illuminate\Log\Logger` wraps, plus an `isHandling()`
 * method `Logger.writeLog()` looks for the same way it probes real Monolog
 * (see `Logger.ts`'s `writeLog()` -- it casts to an object with an optional
 * `isHandling` and calls it only if present).
 *
 * `testListenShortcut` mocks the *dispatcher* instead
 * (`m::mock(DispatcherContract::class)`) to assert `listen()` is called with
 * the right arguments; `RecordingDispatcher` below is the same kind of
 * hand-written stand-in, recording its `listen()` calls instead of behaving
 * like a real dispatcher.
 *
 * `testSkipsSerializationWhenLogLevelNotHandled` and
 * `testSerializesWhenLogLevelIsHandled` are not ported: both exercise a
 * `Illuminate\Contracts\Support\Arrayable` object passed as the log message,
 * asserting `Logger::formatMessage()` calls `toArray()` on it lazily (only
 * once the level is actually handled). This port's `Logger.formatMessage()`
 * (`Logger.ts`) has no such branch -- it only special-cases a plain string and
 * an array via `Util.isArray()`, falling back to `tostring()` otherwise --
 * because `Arrayable` itself has not been ported into this codebase's
 * `Contracts` (there is nothing under `Illuminate/Contracts/Support` by that
 * name), so there is no lazily-serializing shape to construct a test around.
 */

/** A hand-written fake standing in for a Mockery-mocked Monolog logger. */
class RecordingLogger implements LoggerContract {
    public calls = new Array<{
        level: LogLevel;
        message: unknown;
        context: LogContext;
    }>();

    public constructor(private readonly handlingResult = true) {}

    public isHandling(): boolean {
        return this.handlingResult;
    }

    public emergency(message: unknown, context: LogContext = {}): void {
        this.log("emergency", message, context);
    }

    public alert(message: unknown, context: LogContext = {}): void {
        this.log("alert", message, context);
    }

    public critical(message: unknown, context: LogContext = {}): void {
        this.log("critical", message, context);
    }

    public error(message: unknown, context: LogContext = {}): void {
        this.log("error", message, context);
    }

    public warning(message: unknown, context: LogContext = {}): void {
        this.log("warning", message, context);
    }

    public notice(message: unknown, context: LogContext = {}): void {
        this.log("notice", message, context);
    }

    public info(message: unknown, context: LogContext = {}): void {
        this.log("info", message, context);
    }

    public debug(message: unknown, context: LogContext = {}): void {
        this.log("debug", message, context);
    }

    public log(level: LogLevel, message: unknown, context: LogContext = {}): void {
        this.calls.push({ level, message, context });
    }
}

/** A hand-written fake standing in for a Mockery-mocked events dispatcher. */
class RecordingDispatcher implements DispatcherContract {
    public listenCalls = new Array<[EventName | Array<EventName>, Listener]>();

    public listen(events: EventName | Array<EventName>, listener: Listener): void {
        this.listenCalls.push([events, listener]);
    }

    public hasListeners(): boolean {
        return false;
    }

    public subscribe(): void {}

    public until(): unknown {
        return undefined;
    }

    public dispatch(): unknown {
        return undefined;
    }

    public push(): void {}

    public flush(): void {}

    public forget(): void {}

    public forgetPushed(): void {}
}

export = (): void => {
    describe("Logger", () => {
        it("passes error() through to the underlying logger with an empty context", () => {
            // PHP: LogLoggerTest::testMethodsPassErrorAdditionsToMonolog
            const monolog = new RecordingLogger();
            const writer = new Logger(monolog);

            writer.error("foo");

            expect(monolog.calls.size()).to.equal(1);
            expect(monolog.calls[0].level).to.equal("error");
            expect(monolog.calls[0].message).to.equal("foo");
            expect(next(monolog.calls[0].context)[0]).to.equal(undefined);
        });

        it("withContext() adds context to all subsequent logs", () => {
            // PHP: LogLoggerTest::testContextIsAddedToAllSubsequentLogs
            const monolog = new RecordingLogger();
            const writer = new Logger(monolog);
            writer.withContext({ bar: "baz" });

            writer.error("foo");

            expect(monolog.calls[0].context.bar).to.equal("baz");
        });

        it("withoutContext() flushes the context", () => {
            // PHP: LogLoggerTest::testContextIsFlushed
            const monolog = new RecordingLogger();
            const writer = new Logger(monolog);
            writer.withContext({ bar: "baz" });
            writer.withoutContext();

            writer.error("foo");

            expect(next(monolog.calls[0].context)[0]).to.equal(undefined);
        });

        it("withoutContext(keys) removes only the given keys for subsequent logs", () => {
            // PHP: LogLoggerTest::testContextKeysCanBeRemovedForSubsequentLogs
            const monolog = new RecordingLogger();
            const writer = new Logger(monolog);
            writer.withContext({ bar: "baz", forget: "me" });
            writer.withoutContext(["forget"]);

            writer.error("foo");

            expect(monolog.calls[0].context.bar).to.equal("baz");
            expect(monolog.calls[0].context.forget).to.equal(undefined);
        });

        it("fires MessageLogged through the event dispatcher", () => {
            // PHP: LogLoggerTest::testLoggerFiresEventsDispatcher
            const monolog = new RecordingLogger();
            const events = new Dispatcher();
            const writer = new Logger(monolog, events);

            let level: LogLevel | undefined;
            let message: string | undefined;
            let context: LogContext | undefined;

            events.listen(MessageLogged, (event: MessageLogged) => {
                level = event.level;
                message = event.message;
                context = event.context;
            });

            writer.error("foo");

            expect(level).to.equal("error");
            expect(message).to.equal("foo");
            expect(next(context as LogContext)[0]).to.equal(undefined);
        });

        it("listen() throws without a dispatcher set", () => {
            // PHP: LogLoggerTest::testListenShortcutFailsWithNoDispatcher
            const writer = new Logger(new RecordingLogger());

            expectThrows(() => writer.listen(() => {}), "Events dispatcher has not been set.");
        });

        it("listen() shortcut registers the callback against MessageLogged", () => {
            // PHP: LogLoggerTest::testListenShortcut
            const events = new RecordingDispatcher();
            const writer = new Logger(new RecordingLogger(), events);

            const callback = () => "success";
            writer.listen(callback);

            expect(events.listenCalls.size()).to.equal(1);
            expect(events.listenCalls[0][0]).to.equal(MessageLogged);
            expect(events.listenCalls[0][1]).to.equal(callback);
        });

        it("performs complex context manipulation across multiple withContext()/withoutContext() calls", () => {
            // PHP: LogLoggerTest::testComplexContextManipulation
            const monolog = new RecordingLogger();
            const writer = new Logger(monolog);

            writer.withContext({ user_id: 123, action: "login" });
            writer.withContext({ ip: "127.0.0.1", timestamp: "1986-10-29" });
            writer.withoutContext(["timestamp"]);

            writer.info("User action");

            const context = monolog.calls[0].context;

            expect(context.user_id).to.equal(123);
            expect(context.action).to.equal("login");
            expect(context.ip).to.equal("127.0.0.1");
            expect(context.timestamp).to.equal(undefined);
        });

        it("does not call the underlying logger when the level is not handled", () => {
            // Adapted from LogLoggerTest -- exercises writeLog()'s isHandling()
            // gate with a real Monolog logger + TestHandler, the same mechanic
            // testSkipsSerializationWhenLogLevelNotHandled exercised upstream
            // (its Arrayable-serialization half is not ported, see class
            // comment).
            const monolog = new Monolog("test");
            const handler = new TestHandler(Level.Error);
            monolog.pushHandler(handler);

            const writer = new Logger(monolog);
            writer.debug("test");

            expect(handler.hasDebugRecords()).to.equal(false);
        });

        it("calls through to the underlying logger when the level is handled", () => {
            // Adapted from LogLoggerTest -- see the previous test's comment.
            const monolog = new Monolog("test");
            const handler = new TestHandler(Level.Debug);
            monolog.pushHandler(handler);

            const writer = new Logger(monolog);
            writer.debug("test");

            expect(handler.hasDebugRecords()).to.equal(true);
        });

        it("getLogger() returns the underlying logger", () => {
            const monolog = new Monolog("test", [new NullHandler()]);
            const writer = new Logger(monolog);

            expect(writer.getLogger()).to.equal(monolog);
        });

        it("getEventDispatcher()/setEventDispatcher() round-trip", () => {
            const writer = new Logger(new RecordingLogger());

            expect(writer.getEventDispatcher()).to.equal(undefined);

            const events = new Dispatcher();
            writer.setEventDispatcher(events);

            expect(writer.getEventDispatcher()).to.equal(events);
        });
    });
};
