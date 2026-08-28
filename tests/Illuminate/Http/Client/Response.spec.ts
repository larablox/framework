/// <reference types="@rbxts/testez/globals" />
import { RequestException } from "Illuminate/Http/Client/RequestException";
import { Response } from "Illuminate/Http/Client/Response";
import type { ResponseEnvelope } from "Illuminate/Http/Remote";

/**
 * PHP: `Illuminate\Tests\Http\HttpClientTest` (the parts about
 * `Illuminate\Http\Client\Response`, `RequestException` and the status-code
 * shorthands `DeterminesStatusCode` provides).
 *
 * Upstream builds every response by faking a Guzzle handler through
 * `Http::fake()` and driving it with `Factory`/`PendingRequest::get()`/
 * `post()` against a URL. Neither exists here: there is no `fake()`
 * (`agent_docs/laravel-parity.md`, `Http\Client\{Factory,PendingRequest,Response}`
 * row) and no URL to route by, only a path over a fixed remote. What every one
 * of those tests actually checks is a method on the resulting `Response`
 * object, so this file builds that object directly --
 * `new Response({ status, data, headers })`, a `ResponseEnvelope`, is the
 * closest thing to `new Response(new Psr7Response(...))` upstream -- and skips
 * the network round trip entirely. This is the "adapt through a transport
 * extension point" case CLAUDE.md calls for; there is no extension point on
 * the transport itself, so the adaptation sits one level up.
 *
 * Not ported, and why:
 *
 * - Everything about faking itself: `testStubbedResponsesAreReturnedAfterFaking`,
 *   `testCreatedRequest` and every other `Http::fake([...])`-driven request
 *   test (`testAcceptedRequest`, `testMovedPermanentlyRequest`,
 *   `testNoContentRequest`, `testFoundRequest`, `testNotModifiedRequest`,
 *   `testBadRequestRequest`, `testPaymentRequiredRequest`,
 *   `testRequestTimeoutRequest`, `testConflictResponseRequest`,
 *   `testUnprocessableContentRequest`, `testUnprocessableEntityRequest`,
 *   `testTooManyRequestsRequest`, `testUnauthorizedRequest`,
 *   `testForbiddenRequest`, `testNotFoundResponse`) -- ported below by
 *   constructing the `Response` the fake would have handed back.
 * - `testFakeResponseHeaderValuesAreSerialized`,
 *   `testFakeResponseHeaderValuesNormalizeNonFiniteFloats`,
 *   `testInvalidFakeResponseHeaderValuesAreRejected`,
 *   `testFakeResponseSupportsPsr7StreamBody`, `testFakeResponseSupportsResourceBody`,
 *   `testFakeResponseRejectsUnsupportedBody` -- all about
 *   `Factory::response()`'s fake-body/-header coercion, which has no
 *   counterpart; the envelope's `data`/`headers` here are already plain Luau
 *   values.
 * - `testBodyShorthands`, `testResponseBodyCasting` -- PHP encodes the fake
 *   body to a JSON string and `body()`/`json()` decode it back; here
 *   `envelope.data` already *is* the value (`Response.ts`'s class comment),
 *   so `body()` and `json()` answer the same thing by construction and there
 *   is no encode/decode round trip to assert on.
 * - `testResponseObjectAsArray`, `testResponseObjectAsObject`,
 *   `testResponseCanBeReturnedAsResource` -- `object()`/`resource()` are not
 *   ported (no JSON decoding to steer, no PHP resource type).
 * - `testResponseObjectIsTappable` -- `tap()` (`Conditionable`) is ported and
 *   generic; nothing Client-specific to add by re-testing it here.
 * - `testResponseObjectIsMacroable` -- no `Macroable`.
 * - `testResponseCanBeReturnedAsFluent` -- `Fluent` is not ported.
 * - The `testRequestException*Summary*`/`testRequestExceptionEmptyBody`/
 *   `testReportingExceptionTwiceDoesNotIncludeSummaryTwice`/
 *   `testStreamingResponseExceptionMessageIsNotSummarizedWhenBodyIsNotSeekable`
 *   family -- `RequestException` here has no body summary or truncation at
 *   all (`RequestException.ts`'s class comment: the message stops at the
 *   status code), so there is no summarizing behaviour to port; the plain
 *   message format is covered below instead.
 * - Every `Http::fake()`/`PendingRequest`-level throw test
 *   (`testRequestExceptionIsThrownIfThePendingRequestIsSetToThrowOnFailure`
 *   and its many siblings, the `...InPool` variants, `testAsyncRequestExceptionsRespectRequestTruncation`,
 *   the retry-family `testRequestException...Retries...`) -- `PendingRequest`
 *   here has no transport it can fake (`send()`/`get()`/`post()` reach a real
 *   remote), so its `throw()`/`throwIf()`/`retry()` builder cannot be
 *   exercised without a live server; only the `Response`-level `throw()`/
 *   `throwIf()`/`throwIfStatus()`/`throwUnlessStatus()`/`throwIfClientError()`/
 *   `throwIfServerError()` these ultimately call are ported, below.
 * - `throwUnless()` -- not ported on `Response` (only `throw`, `throwIf`,
 *   `throwIfStatus`, `throwUnlessStatus`, `throwIfClientError`,
 *   `throwIfServerError`; see `Response.ts`).
 * - `testSinkToFile`, `testSinkToResource`, `testSinkWhenStubbedByPath` --
 *   `sink()` (file/resource downloads) not ported.
 * - `testCanDump`, `testResponseCanDump*` -- `dump`/`dd` not ported
 *   (`Response.ts`'s "Not ported" list).
 */

/** Build a Client\Response the way a handled remote call would answer it. */
function response(envelope: ResponseEnvelope): Response {
    return new Response(envelope);
}

export = (): void => {
    describe("Http.Client.Response", () => {
        // PHP: HttpClientTest::testCreatedRequest
        it("created()", () => {
            expect(response({ status: 201 }).created()).to.equal(true);
            expect(response({ status: 200 }).created()).to.equal(false);
        });

        // PHP: HttpClientTest::testStatusCodeShorthand, testNoContentRequest
        it("noContent()", () => {
            expect(response({ status: 204 }).noContent()).to.equal(true);
            expect(response({ status: 200 }).noContent()).to.equal(false);
        });

        // PHP: HttpClientTest::testAcceptedRequest
        it("accepted()", () => {
            expect(response({ status: 202 }).accepted()).to.equal(true);
            expect(response({ status: 200 }).accepted()).to.equal(false);
        });

        // PHP: HttpClientTest::testMovedPermanentlyRequest
        it("movedPermanently()", () => {
            expect(response({ status: 301 }).movedPermanently()).to.equal(true);
            expect(response({ status: 200 }).movedPermanently()).to.equal(false);
        });

        // PHP: HttpClientTest::testFoundRequest
        it("found()", () => {
            expect(response({ status: 302 }).found()).to.equal(true);
            expect(response({ status: 200 }).found()).to.equal(false);
        });

        // PHP: HttpClientTest::testNotModifiedRequest
        it("notModified()", () => {
            expect(response({ status: 304 }).notModified()).to.equal(true);
            expect(response({ status: 200 }).notModified()).to.equal(false);
        });

        // PHP: HttpClientTest::testBadRequestRequest
        it("badRequest()", () => {
            expect(response({ status: 400 }).badRequest()).to.equal(true);
            expect(response({ status: 200 }).badRequest()).to.equal(false);
        });

        // PHP: HttpClientTest::testPaymentRequiredRequest
        it("paymentRequired()", () => {
            expect(response({ status: 402 }).paymentRequired()).to.equal(true);
            expect(response({ status: 200 }).paymentRequired()).to.equal(false);
        });

        // PHP: HttpClientTest::testRequestTimeoutRequest
        it("requestTimeout()", () => {
            expect(response({ status: 408 }).requestTimeout()).to.equal(true);
            expect(response({ status: 200 }).requestTimeout()).to.equal(false);
        });

        // PHP: HttpClientTest::testConflictResponseRequest
        it("conflict()", () => {
            expect(response({ status: 409 }).conflict()).to.equal(true);
            expect(response({ status: 200 }).conflict()).to.equal(false);
        });

        // PHP: HttpClientTest::testUnprocessableContentRequest
        it("unprocessableContent()", () => {
            expect(response({ status: 422 }).unprocessableContent()).to.equal(true);
            expect(response({ status: 200 }).unprocessableContent()).to.equal(false);
        });

        // PHP: HttpClientTest::testUnprocessableEntityRequest
        it("unprocessableEntity() is an alias for unprocessableContent()", () => {
            expect(response({ status: 422 }).unprocessableEntity()).to.equal(true);
            expect(response({ status: 200 }).unprocessableEntity()).to.equal(false);
        });

        // PHP: HttpClientTest::testTooManyRequestsRequest
        it("tooManyRequests()", () => {
            expect(response({ status: 429 }).tooManyRequests()).to.equal(true);
            expect(response({ status: 200 }).tooManyRequests()).to.equal(false);
        });

        // PHP: HttpClientTest::testUnauthorizedRequest
        it("unauthorized()", () => {
            expect(response({ status: 401 }).unauthorized()).to.equal(true);
        });

        // PHP: HttpClientTest::testForbiddenRequest
        it("forbidden()", () => {
            expect(response({ status: 403 }).forbidden()).to.equal(true);
        });

        // PHP: HttpClientTest::testNotFoundResponse
        it("notFound()", () => {
            expect(response({ status: 404 }).notFound()).to.equal(true);
        });

        // PHP: HttpClientTest::testExceptionAccessorOnSuccess
        it("toException() answers undefined for a successful response", () => {
            expect(response({ status: 200 }).toException()).to.equal(undefined);
        });

        // PHP: HttpClientTest::testExceptionAccessorOnFailure
        it("toException() answers a RequestException for a failed response", () => {
            const failed = response({
                status: 403,
                data: {
                    error: {
                        code: 403,
                        message: "The Request can not be completed",
                    },
                },
            });

            expect(failed.toException() !== undefined).to.equal(true);
            expect(failed.toException() instanceof RequestException).to.equal(true);
        });

        /**
         * PHP: no direct upstream test -- `RequestException`'s message is folded
         * into the (unported) body-summary tests above. Ported anyway as the
         * message format's only remaining coverage: `RequestException.ts`'s class
         * comment says the message stops at the status code once the truncated
         * body summary is dropped.
         */
        it("RequestException's message stops at the status code", () => {
            const exception = new RequestException(response({ status: 403 }));

            expect(exception.getMessage()).to.equal("HTTP request returned status code 403");
        });

        // PHP: HttpClientTest::testOnErrorDoesntCallClosureOnInformational
        it("onError() does not call the closure on an informational response", () => {
            let status = 0;
            response({ status: 101 }).onError((r) => {
                status = r.status();
            });

            expect(status).to.equal(0);
        });

        // PHP: HttpClientTest::testOnErrorDoesntCallClosureOnSuccess
        it("onError() does not call the closure on a successful response", () => {
            let status = 0;
            response({ status: 201 }).onError((r) => {
                status = r.status();
            });

            expect(status).to.equal(0);
        });

        // PHP: HttpClientTest::testOnErrorDoesntCallClosureOnRedirection
        it("onError() does not call the closure on a redirection response", () => {
            let status = 0;
            response({ status: 301 }).onError((r) => {
                status = r.status();
            });

            expect(status).to.equal(0);
        });

        // PHP: HttpClientTest::testOnErrorCallsClosureOnClientError
        it("onError() calls the closure on a client error", () => {
            let status = 0;
            response({ status: 401 }).onError((r) => {
                status = r.status();
            });

            expect(status).to.equal(401);
        });

        // PHP: HttpClientTest::testOnErrorCallsClosureOnServerError
        it("onError() calls the closure on a server error", () => {
            let status = 0;
            response({ status: 501 }).onError((r) => {
                status = r.status();
            });

            expect(status).to.equal(501);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownIfTheRequestFails
        it("throw() raises RequestException when the response failed", () => {
            let thrown: unknown;

            try {
                response({ status: 400 }).throw();
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
            expect(thrown instanceof RequestException).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownWithCallbackIfTheRequestFails
        it("throw() runs the callback before raising", () => {
            let flag = false;
            let thrown: unknown;

            try {
                response({ status: 400 }).throw(() => {
                    flag = true;
                });
            } catch (exception) {
                thrown = exception;
            }

            expect(flag).to.equal(true);
            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsNotThrownIfTheRequestDoesNotFail
        it("throw() is a no-op for a successful response", () => {
            const successful = response({
                status: 200,
                data: { result: { foo: "bar" } },
            });

            expect(successful.throw().body()).to.equal(successful.body());
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrowIfConditionIsSatisfied
        it("throwIf() raises when the boolean condition is true", () => {
            let thrown: unknown;

            try {
                response({ status: 400 }).throwIf(true);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsNotThrownIfConditionIsNotSatisfied
        it("throwIf() does nothing when the boolean condition is false", () => {
            const failed = response({
                status: 400,
                data: { result: { foo: "bar" } },
            });

            expect(failed.throwIf(false).body()).to.equal(failed.body());
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrowIfConditionClosureIsSatisfied
        it("throwIf() raises when the closure condition returns true, and runs the callback", () => {
            let thrown: unknown;
            let hitThrowCallback = false;

            try {
                response({ status: 400 }).throwIf(
                    (r) => r.status() === 400,
                    (r, e) => {
                        expect(r.status()).to.equal(400);
                        expect(e instanceof RequestException).to.equal(true);
                        hitThrowCallback = true;
                    },
                );
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
            expect(hitThrowCallback).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsNotThrownIfConditionClosureIsNotSatisfied
        it("throwIf() does not raise when the closure condition returns false", () => {
            let hitThrowCallback = false;
            const failed = response({
                status: 400,
                data: { result: { foo: "bar" } },
            });

            const result = failed.throwIf(
                (r) => {
                    expect(r.status()).to.equal(400);

                    return false;
                },
                () => {
                    hitThrowCallback = true;
                },
            );

            expect(result.body()).to.equal(failed.body());
            expect(hitThrowCallback).to.equal(false);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownIfStatusCodeIsSatisfied
        it("throwIfStatus() raises when the status matches the given code", () => {
            let thrown: unknown;

            try {
                response({ status: 400 }).throwIfStatus(400);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownIfStatusCodeIsSatisfiedWithClosure
        it("throwIfStatus() raises when the closure matches the status", () => {
            let thrown: unknown;

            try {
                response({ status: 400 }).throwIfStatus((status) => status === 400);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsNotThrownIfStatusCodeIsNotSatisfied
        it("throwIfStatus() does nothing when the status does not match", () => {
            let thrown: unknown;

            try {
                response({ status: 400 }).throwIfStatus(500);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown).to.equal(undefined);
        });

        // PHP: HttpClientTest::testThrowIfStatusWorksWithNonErrorStatusCodes
        it("throwIfStatus() also matches a non-error status code", () => {
            let thrown: unknown;

            try {
                response({ status: 201 }).throwIfStatus(201);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownUnlessStatusCodeIsSatisfied
        it("throwUnlessStatus() raises when the status does not match the given code", () => {
            let thrown: unknown;

            try {
                response({ status: 400 }).throwUnlessStatus(500);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testThrowUnlessStatusWorksWithNonErrorStatusCodes
        it("throwUnlessStatus() also matches a non-error status code", () => {
            let thrown: unknown;

            try {
                response({ status: 201 }).throwUnlessStatus(201);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown).to.equal(undefined);

            thrown = undefined;

            try {
                response({ status: 201 }).throwUnlessStatus((status) => status === 200);
            } catch (exception) {
                thrown = exception;
            }

            expect(thrown !== undefined).to.equal(true);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownIfIsClientError
        it("throwIfClientError() only raises for a 4xx response", () => {
            expect(
                (() => {
                    try {
                        response({ status: 400 }).throwIfClientError();

                        return false;
                    } catch {
                        return true;
                    }
                })(),
            ).to.equal(true);

            expect(
                (() => {
                    try {
                        response({ status: 408 }).throwIfClientError();

                        return false;
                    } catch {
                        return true;
                    }
                })(),
            ).to.equal(true);

            expect(
                (() => {
                    try {
                        response({ status: 500 }).throwIfClientError();

                        return false;
                    } catch {
                        return true;
                    }
                })(),
            ).to.equal(false);
        });

        // PHP: HttpClientTest::testRequestExceptionIsThrownIfIsServerError
        it("throwIfServerError() only raises for a 5xx response", () => {
            expect(
                (() => {
                    try {
                        response({ status: 500 }).throwIfServerError();

                        return false;
                    } catch {
                        return true;
                    }
                })(),
            ).to.equal(true);

            expect(
                (() => {
                    try {
                        response({ status: 400 }).throwIfServerError();

                        return false;
                    } catch {
                        return true;
                    }
                })(),
            ).to.equal(false);
        });
    });
};
