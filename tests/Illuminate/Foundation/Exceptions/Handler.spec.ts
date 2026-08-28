/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Exception, InvalidArgumentException, LogicException, RuntimeException } from 'Illuminate/Exception';
import { Container } from 'Illuminate/Container/Container';
import { Handler } from 'Illuminate/Foundation/Exceptions/Handler';
import { HttpException } from 'Illuminate/Http/Exceptions/HttpException';
import { Inject } from 'Illuminate/Container/Attributes/Inject';
import { Repository as ConfigRepository } from 'Illuminate/Config/Repository';
import { Request } from 'Illuminate/Http/Request';
import { Response } from 'Illuminate/Http/Response';
import type { LogContext, LogLevel } from 'Illuminate/Contracts/Log/Logger';
import type { LogManager } from 'Illuminate/Log/LogManager';

/**
 * PHP: `Illuminate\Tests\Foundation\FoundationExceptionsHandlerTest`.
 *
 * `Handler.ts`'s class comment lists what shapes this port: callback
 * parameter types are erased (`reportable()`/`renderable()` see every
 * exception rather than only the type-hinted one, and `map()` takes its
 * source class as an argument), and the HTML/JSON fork collapses into one
 * branch because a remote always carries a value. Everything upstream tests
 * that depends on the other side of that fork, or on a component that is not
 * ported, is dropped rather than adapted:
 *
 * - `testHandlerReportsExceptionUsingCallableClass`,
 *   `testReturnsCustomResponseFromCallableClass` -- both hand `reportable()`/
 *   `renderable()` an *invokable object* (`CustomReporter`/`CustomRenderer`,
 *   called through PHP's `__invoke` magic method); there is no `__invoke`
 *   here (see `ContainerCall.spec.ts`'s class comment for the same
 *   limitation on `Container::call()`).
 * - `testShouldReturnJson`, `testShouldReturnJsonWhen`,
 *   `testReturnsJsonWithStackTraceWhenAjaxRequestAndDebugTrue` -- all read
 *   `shouldReturnJson()`/`shouldRenderJsonWhen()`, which do not exist:
 *   "every response is data already" (`Exceptions.ts`'s class comment). The
 *   file/line/trace half of the debug-true case has no analogue either --
 *   "a caught value carries none of those... what is left is the message and
 *   the class" (`Handler.ts`, `convertExceptionToArray()`).
 * - `testShouldntRetryDefaultsToFalse`,
 *   `testShouldntRetryUsesRegisteredExceptionClass`,
 *   `testShouldntRetryUsesRegisteredCallback`,
 *   `testShouldntRetryIgnoresFalseCallbackResult` -- `shouldStopRetries()`/
 *   `dontRetry()`/`dontRetryWhen()` are queue-retry concerns; not ported.
 * - `testReturnsJsonWithoutStackTraceWhenAjaxRequestAndDebugFalseAndAccessDeniedHttpExceptionErrorIsShown`
 *   -- `AccessDeniedHttpException` is Symfony's; not ported (the plain
 *   `HttpException` case beside it is ported below).
 * - `testValidateFileMethod` -- `ValidationException`; validation is not
 *   ported.
 * - `testSuspiciousOperationReturns400WithoutReporting`,
 *   `testRecordsNotFoundReturns404WithoutReporting`,
 *   `testMultipleRecordsFoundIsReported` -- `SuspiciousOperationException` is
 *   Symfony's request-parsing exception, `RecordsNotFoundException`/
 *   `MultipleRecordsFoundException` are Eloquent's; none are ported, and
 *   `prepareException()` -- where PHP maps them -- is an empty hook here
 *   (`Handler.ts`'s class comment: "nothing maps yet").
 * - `testItReturnsSpecificErrorViewIfExists`, `...FallbackErrorViewIfExists`,
 *   `...NullIfNoErrorViewExists`,
 *   `testItDoesNotCrashIfErrorViewThrowsWhileRenderingAndDebug{False,True}`
 *   -- all render Blade error views; there are no views.
 * - `testAssertExceptionIsThrown`, `testAssertNoExceptionIsThrown` -- exercise
 *   `InteractsWithExceptionHandling`'s `assertThrows()`/`assertDoesntThrow()`
 *   test helpers, under `Foundation\Testing`, out of scope per the task brief.
 * - `testItDoesNotThrottleExceptionsWhenNullReturned`,
 *   `...WhenUnlimitedLimit`, `testItCanSampleExceptionsByClass`,
 *   `testItRescuesExceptionsWhileThrottlingAndReports`,
 *   `...IfThereIsAnIssueResolvingTheRateLimiter`,
 *   `...IfThereIsAnIssueWithTheRateLimiter`, `testItCanRateLimitExceptions`,
 *   `testRateLimitExpiresOnBoundary` -- all exercise `throttle()`/`Lottery`/
 *   `RateLimiter`; `Handler.ts`'s class comment: "throttling of reports... it
 *   wants `Lottery`, which is not ported". `testItDoesNotThrottleExceptionsByDefault`
 *   survives below since it needs none of that -- it only reports a batch and
 *   counts what came out, which is true here for the same reason (there is no
 *   throttle to begin with).
 *
 * `FakeLogger` stands in for the `Mockery`-mocked `Psr\Log\LoggerInterface`
 * upstream binds: this port's `Handler::newLogger()` always calls
 * `LogManager::log($level, ...)` (never `->error()`/`->critical()`
 * directly -- see `Handler.ts`'s class comment on `reportThrowable()`), so
 * one `log()` override is enough to observe every case. `container.instance("log", ...)`
 * substitutes for PHP's `$container->instance(LoggerInterface::class, $logger)`.
 */
export = (): void => {
    describe('Foundation.Exceptions.Handler', () => {
        interface LogRecord
        {
            level: LogLevel;
            message: string;
            context: LogContext;
        }

        class FakeLogger
        {
            public records = new Array<LogRecord>();

            public log(level: LogLevel, message: unknown, context?: LogContext): void
            {
                this.records.push({
                    level: level,
                    message: message as string,
                    context: context ?? {},
                });
            }
        }

        abstract class ReportingService
        {
            public abstract send(message: string): void;
        }

        class SpyingReporter extends ReportingService
        {
            public sent = new Array<string>();

            public send(message: string): void
            {
                this.sent.push(message);
            }
        }

        class CustomException extends Exception
        {}

        class ResponsableException extends Exception
        {
            public toResponse(): Response
            {
                return new Response({
                    response: 'My responsable exception response',
                });
            }
        }

        class ReportableException extends Exception
        {
            public report(@Inject(ReportingService) service: ReportingService): void
            {
                service.send(this.getMessage());
            }
        }

        class UnReportableException extends Exception
        {
            public report(): boolean
            {
                return false;
            }
        }

        class RenderableException extends Exception
        {
            public render(): Response
            {
                return new Response({
                    response: 'My renderable exception response',
                });
            }
        }

        class ContextProvidingException extends Exception
        {
            public context(): LogContext
            {
                return { foo: 'bar' };
            }
        }

        /**
         * Upstream levels `OutOfRangeException` at `'custom'` beside
         * `InvalidArgumentException` at `LogLevel::CRITICAL`; `OutOfRangeException`
         * is not ported, so a local fixture class takes its place -- the only
         * thing the test needs from it is a class distinct from
         * `RuntimeException`, which is exercised unlevelled in the same case.
         */
        class CustomLevelException extends LogicException
        {}

        function handlerWithFakeLogger(): [Handler, FakeLogger]
        {
            const container = new Container();
            container.instance('config', new ConfigRepository({}));

            const logger = new FakeLogger();
            container.instance('log', logger as unknown as LogManager);

            return [new Handler(container), logger];
        }

        it("report() logs the exception's message under an `exception` context key", () => {
            // PHP: FoundationExceptionsHandlerTest::testHandlerReportsExceptionAsContext
            const [handler, logger] = handlerWithFakeLogger();
            const e = new RuntimeException('Exception message');

            handler.report(e);

            expect(logger.records.size()).to.equal(1);
            expect(logger.records[0].level).to.equal('error');
            expect(logger.records[0].message).to.equal('Exception message');
            expect(logger.records[0].context.exception).to.equal(e);
        });

        it("report() merges the exception's own context() into the log context", () => {
            // PHP: FoundationExceptionsHandlerTest::testHandlerCallsContextMethodIfPresent
            const [handler, logger] = handlerWithFakeLogger();

            handler.report(new ContextProvidingException('Exception message'));

            expect(logger.records[0].context.foo).to.equal('bar');
        });

        it("report() still logs when the exception's own report() returns false", () => {
            // PHP: FoundationExceptionsHandlerTest::testHandlerReportsExceptionWhenUnReportable
            const [handler, logger] = handlerWithFakeLogger();

            handler.report(new UnReportableException('Exception message'));

            expect(logger.records.size()).to.equal(1);
            expect(logger.records[0].message).to.equal('Exception message');
        });

        it('level() maps an exception type to a custom log level (adapted -- see class comment)', () => {
            // PHP: FoundationExceptionsHandlerTest::testHandlerReportsExceptionWithCustomLogLevel
            const [handler, logger] = handlerWithFakeLogger();

            handler.level(InvalidArgumentException, 'critical');
            handler.level(CustomLevelException, 'custom' as LogLevel);

            handler.report(new InvalidArgumentException('Critical message'));
            handler.report(new RuntimeException('Error message'));
            handler.report(new CustomLevelException('Custom message'));

            expect(logger.records[0].level).to.equal('critical');
            expect(logger.records[1].level).to.equal('error');
            expect(logger.records[2].level).to.equal('custom');
        });

        it('ignore() stops an exception type from being reported', () => {
            // PHP: FoundationExceptionsHandlerTest::testHandlerIgnoresNotReportableExceptions
            const [handler, logger] = handlerWithFakeLogger();

            handler.ignore(RuntimeException);
            handler.report(new RuntimeException('Exception message'));

            expect(logger.records.size()).to.equal(0);
        });

        it("report() calls the exception's own report() through the container, and does not log", () => {
            // PHP: FoundationExceptionsHandlerTest::testHandlerCallsReportMethodWithDependencies
            const container = new Container();
            container.instance('config', new ConfigRepository({}));
            const logger = new FakeLogger();
            container.instance('log', logger as unknown as LogManager);
            const reporter = new SpyingReporter();
            container.instance(ReportingService, reporter);

            const handler = new Handler(container);
            handler.report(new ReportableException('Exception message'));

            expectDeepEqual(reporter.sent, ['Exception message']);
            expect(logger.records.size()).to.equal(0);
        });

        it('renderable() offers every exception to the callback, and its response wins', () => {
            // PHP: FoundationExceptionsHandlerTest::testReturnsCustomResponseFromRenderableCallback
            const [handler] = handlerWithFakeLogger();
            const request = new Request({} as Player, 'GET', '/');

            handler.renderable((e: unknown, r: Request) => {
                expect(r).to.equal(request);

                if (e instanceof CustomException) {
                    return new Response({
                        response: 'My custom exception response',
                    });
                }

                return undefined;
            });

            const response = handler.render(request, new CustomException());

            expectDeepEqual(response.getContent(), {
                response: 'My custom exception response',
            });
        });

        it("render() prefers an exception's own render() method", () => {
            // PHP: FoundationExceptionsHandlerTest::testReturnsResponseFromRenderableException
            const [handler] = handlerWithFakeLogger();
            const request = new Request({} as Player, 'GET', '/');

            const response = handler.render(request, new RenderableException());

            expectDeepEqual(response.getContent(), {
                response: 'My renderable exception response',
            });
        });

        it('map() rewrites the exception before render() sees it', () => {
            // PHP: FoundationExceptionsHandlerTest::testReturnsResponseFromMappedRenderableException
            const [handler] = handlerWithFakeLogger();
            const request = new Request({} as Player, 'GET', '/');

            handler.map(RuntimeException, RenderableException);

            const response = handler.render(request, new RuntimeException());

            expectDeepEqual(response.getContent(), {
                response: 'My renderable exception response',
            });
        });

        it('render() answers a Responsable exception with its own toResponse()', () => {
            // PHP: FoundationExceptionsHandlerTest::testReturnsCustomResponseWhenExceptionImplementsResponsable
            const [handler] = handlerWithFakeLogger();
            const request = new Request({} as Player, 'GET', '/');

            const response = handler.render(request, new ResponsableException());

            expectDeepEqual(response.getContent(), {
                response: 'My responsable exception response',
            });
        });

        it("render() masks a generic exception's message when debug is off (adapted -- see class comment)", () => {
            // PHP: FoundationExceptionsHandlerTest::testReturnsJsonWithoutStackTraceWhenAjaxRequestAndDebugFalseAndExceptionMessageIsMasked
            const container = new Container();
            container.instance('config', new ConfigRepository({ app: { debug: false } }));
            container.instance('log', new FakeLogger() as unknown as LogManager);

            const handler = new Handler(container);
            const request = new Request({} as Player, 'GET', '/');

            const response = handler.render(request, new Exception('This error message should not be visible'));

            expectDeepEqual(response.getContent(), { message: 'Server Error' });
        });

        it("render() still shows an HttpException's own message when debug is off (adapted -- see class comment)", () => {
            // PHP: FoundationExceptionsHandlerTest::testReturnsJsonWithoutStackTraceWhenAjaxRequestAndDebugFalseAndHttpExceptionErrorIsShown
            const container = new Container();
            container.instance('config', new ConfigRepository({ app: { debug: false } }));
            container.instance('log', new FakeLogger() as unknown as LogManager);

            const handler = new Handler(container);
            const request = new Request({} as Player, 'GET', '/');

            const response = handler.render(request, new HttpException(403, 'My custom error message'));

            expectDeepEqual(response.getContent(), {
                message: 'My custom error message',
            });
        });

        it('report() offers a reportable() callback the same exception instance every time it is reported', () => {
            // PHP: FoundationExceptionsHandlerTest::testItReportsDuplicateExceptions
            const [handler] = handlerWithFakeLogger();
            const reported = new Array<unknown>();

            handler.reportable((e: unknown) => {
                reported[reported.size()] = e;

                return false;
            });

            const one = new RuntimeException('foo');
            handler.report(one);
            handler.report(one);
            const two = new RuntimeException('foo');
            handler.report(two);

            expectDeepEqual(reported, [one, one, two]);
        });

        it('dontReportDuplicates() reports the same exception instance only once', () => {
            // PHP: FoundationExceptionsHandlerTest::testItCanDedupeExceptions
            const [handler] = handlerWithFakeLogger();
            const reported = new Array<unknown>();

            handler.reportable((e: unknown) => {
                reported[reported.size()] = e;

                return false;
            });
            handler.dontReportDuplicates();

            const one = new RuntimeException('foo');
            handler.report(one);
            handler.report(one);
            const two = new RuntimeException('foo');
            handler.report(two);

            expectDeepEqual(reported, [one, two]);
        });

        it('dontReportWhen() skips reporting exceptions the callback rejects', () => {
            // PHP: FoundationExceptionsHandlerTest::testItCanSkipExceptionReportingUsingCallback
            const [handler] = handlerWithFakeLogger();
            const reported = new Array<unknown>();
            const e1 = new RuntimeException('foo');
            const e2 = new RuntimeException('bar');

            handler.reportable((e: unknown) => {
                reported[reported.size()] = e;

                return false;
            });

            handler.dontReportWhen((e: unknown) => e instanceof RuntimeException && e.getMessage() === 'foo');

            handler.report(e1);
            handler.report(e2);
            handler.report(e1);

            expectDeepEqual(reported, [e2]);
        });

        it('report() does not throttle by default (adapted -- see class comment)', () => {
            // PHP: FoundationExceptionsHandlerTest::testItDoesNotThrottleExceptionsByDefault
            const [handler] = handlerWithFakeLogger();
            const reported = new Array<unknown>();

            handler.reportable((e: unknown) => {
                reported[reported.size()] = e;

                return false;
            });

            for (let i = 0; i < 100; i++) {
                handler.report(new RuntimeException(`Exception ${i}`));
            }

            expect(reported.size()).to.equal(100);
        });
    });
};
