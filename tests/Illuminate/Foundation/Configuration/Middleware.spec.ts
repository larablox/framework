/// <reference types="@rbxts/testez/globals" />

/**
 * PHP: `Illuminate\Tests\Foundation\Configuration\MiddlewareTest`.
 *
 * Every case upstream exercises a piece of `Configuration\Middleware` this
 * port does not have, per `Middleware.ts`'s own class comment ("Two of PHP's
 * three default stacks have nothing to fill them with... Not ported with the
 * groups: `web()`, `pages()`, the redirect helpers, `encryptCookies()`,
 * `preventRequestForgery()`, `validateCsrfTokens()`, `validateSignatures()`,
 * `trustHosts()`, `trustProxies()`, `preventRequestsDuringMaintenance()`,
 * `statefulApi()`, `throttleWithRedis()` and `authenticateSessions()`"):
 *
 * - `testConvertEmptyStringsToNull`, `testTrimStrings` -- both configure and
 *   exercise `Foundation\Http\Middleware\{ConvertEmptyStringsToNull,TrimStrings}`,
 *   which read form input off a Symfony request; not ported.
 * - `testTrustProxies`, `testTrustHeaders`, `testTrustHosts` -- proxy/host
 *   trust is a reverse-proxy concern; there is no proxy in front of a Roblox
 *   server to trust or distrust.
 * - `testEncryptCookies` -- there are no cookies (`Response`, `Request` have
 *   no cookie jar in this port).
 * - `testPreventRequestsDuringMaintenance` -- maintenance mode is not ported
 *   (`agent_docs/porting-plan.md`'s "### Foundation" list).
 * - `testPreventRequestForgery` -- CSRF is a browser-form concept; a remote
 *   call carries no forgeable form to protect.
 * - `testRedirectUsersToDoesNotOverwriteRedirectGuestsTo`,
 *   `testRedirectGuestsToNullRegistersNullCallback` -- both configure
 *   `Auth\Middleware\Authenticate`/`AuthenticateSession`/
 *   `RedirectIfAuthenticated`'s redirect-on-failure callbacks; `Auth` is not
 *   ported, and neither are those middleware.
 *
 * What upstream never exercises is what this port's `Middleware` class
 * *does* have -- `useMiddleware()`/`prepend()`/`append()`/`remove()`/
 * `replace()`/`group()`/`api()`/`alias()`/`priority()` and their
 * `getGlobalMiddleware()`/`getMiddlewareGroups()`/`getMiddlewareAliases()`/
 * `getMiddlewarePriority()` readers -- none of PHP's own test file for this
 * class touches them, so there is nothing here to port rather than invent.
 */
export = (): void => {
    describe('Foundation.Configuration.Middleware', () => {
        // See the class comment: every upstream case in `MiddlewareTest.php`
        // exercises middleware this port does not have.
    });
};
