/// <reference types="@rbxts/testez/globals" />
import { Response } from 'Illuminate/Http/Response';

/**
 * PHP: `Illuminate\Tests\Http\HttpResponseTest`.
 *
 * PHP's `Response` wraps Symfony's: content is always a string (or gets
 * JSON-encoded on the way in), headers live behind a `ParameterBag`, and
 * `RedirectResponse` layers session flashing and a magic-call surface on top.
 * None of that survives the port -- see `Response.ts`'s class comment and
 * `agent_docs/laravel-parity.md`'s "Запрос — это вызов ремоута" -- so almost
 * every upstream test targets something this class does not have.
 *
 * Not ported, and why:
 *
 * - `testJsonResponsesAreConvertedAndHeadersAreSet` -- content is any Luau
 *   value the transport can carry, not a string; nothing here JSON-encodes it
 *   or sets a `Content-Type`, which is what `Response.ts`'s class comment
 *   says makes `JsonResponse` redundant. There is no equivalent case to port:
 *   PHP's whole point is the encode-on-set behaviour, and this class's
 *   `setContent()`/`getContent()` are a plain passthrough (see
 *   `testGetOriginalContent` below, adapted instead).
 * - `testRenderablesAreRendered` -- `Illuminate\Contracts\Support\Renderable`
 *   is not ported.
 * - `testWithCookie`, `testWithCookies`, `testResponseCookiesInheritRequestSecureState` --
 *   no cookies.
 * - `testGetOriginalContentRetrievesTheFirstOriginalContent` -- PHP's
 *   `getOriginalContent()` unwraps a `Response` passed as another response's
 *   content, a Symfony behaviour `setContent()` implements via its own type
 *   check; this class has no `getOriginalContent()` at all (`content()`/
 *   `getContent()` just return whatever was stored), so there is nothing
 *   distinct to port beyond the passthrough already covered.
 * - `testSetStatusCodeAndRetrieveStatusText` -- `statusText()` (Symfony's
 *   reason-phrase table) is not ported.
 * - `testOnlyInputOnRedirect`, `testExceptInputOnRedirect`,
 *   `testFlashingErrorsOnRedirect`, `testSettersGettersOnRequest`,
 *   `testRedirectWithErrorsArrayConvertsToMessageBag`, `testMagicCall`,
 *   `testMagicCallException` -- all exercise `RedirectResponse`, which is not
 *   ported (`Response.ts`'s class comment lists it under "Not ported").
 * - `testWithHeaders`'s `ResponseHeaderBag`/`HeaderBag` cases -- `withHeaders()`
 *   here only accepts a plain `Record<string, string>` (see `Response.ts`),
 *   so only the plain-object half of the upstream test has an equivalent,
 *   ported below.
 * - `testWithoutHeader` -- `withoutHeader()` is not ported; `getHeaders()`
 *   is read-only here (see `Response.ts`'s "Not ported" list has no removal
 *   API for headers).
 */

export = (): void => {
    describe('Http.Response', () => {
        // PHP: HttpResponseTest::testHeader
        it('header() only replaces an existing value when told to', () => {
            const response = new Response();
            expect(response.getHeaders().has('foo')).to.equal(false);

            response.header('foo', 'bar');
            expect(response.getHeaders().get('foo')).to.equal('bar');

            response.header('foo', 'baz', false);
            expect(response.getHeaders().get('foo')).to.equal('bar');

            response.header('foo', 'baz');
            expect(response.getHeaders().get('foo')).to.equal('baz');
        });

        /**
         * PHP: HttpResponseTest::testGetOriginalContent (adapted).
         *
         * PHP asserts `getOriginalContent()` hands back the exact value that was
         * set; that accessor does not exist here (see the class doc comment
         * above), but `content()`/`getContent()` are the same plain passthrough,
         * so the assertion is ported against them instead.
         */
        it('content() and getContent() return whatever was set, unchanged', () => {
            const arr = { foo: 'bar' };
            const response = new Response();
            response.setContent(arr);

            expect(response.getContent()).to.equal(arr);
            expect(response.content()).to.equal(arr);
        });

        // PHP: HttpResponseTest::testSetAndRetrieveStatusCode
        it('setStatusCode() and getStatusCode()/status() round-trip', () => {
            const response = new Response('foo');
            response.setStatusCode(404);

            expect(response.getStatusCode()).to.equal(404);
            expect(response.status()).to.equal(404);
        });

        /**
         * PHP: HttpResponseTest::testWithHeaders (plain-object half only; see the
         * class doc comment for why the `ResponseHeaderBag`/`HeaderBag` cases are
         * not ported).
         */
        it('withHeaders() merges a plain object of headers in, later values winning', () => {
            const response = new Response(undefined, 200, { foo: 'bar' });
            expect(response.getHeaders().get('foo')).to.equal('bar');

            response.withHeaders({ foo: 'BAR', bar: 'baz' });
            expect(response.getHeaders().get('foo')).to.equal('BAR');
            expect(response.getHeaders().get('bar')).to.equal('baz');
        });

        /**
         * PHP: `Illuminate\Http\Response\ResponseTrait::withException()`/
         * `exception()`, exercised in `HttpExceptionTest` and equivalents upstream
         * rather than in `HttpResponseTest` itself -- ported here as the direct
         * counterpart to `$exception` (`responseException` here, see
         * `agent_docs/laravel-parity.md`'s renaming table) since it is central
         * enough to the port to leave untested otherwise.
         */
        it('withException()/exception() attach the exception a response answers a failed request with', () => {
            const response = new Response();
            expect(response.exception()).to.equal(undefined);

            const thrown = 'boom';
            response.withException(thrown);
            expect(response.exception()).to.equal(thrown);
        });
    });
};
