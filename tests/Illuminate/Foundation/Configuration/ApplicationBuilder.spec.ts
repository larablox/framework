/// <reference types="@rbxts/testez/globals" />

/**
 * PHP: `Illuminate\Tests\Foundation\FoundationApplicationBuilderTest`.
 *
 * Every case in this file is about paths, `.env`, or `prefersJsonResponses()`
 * -- and `ApplicationBuilder.ts`'s own class comment says plainly that none
 * of it crossed over:
 *
 * - `testBaseDirectoryWithArg`, `testBaseDirectoryWithEnv`,
 *   `testBaseDirectoryWithComposer`, `testStoragePathWithGlobalEnvVariable`,
 *   `testStoragePathWithGlobalServerVariable`, `testStoragePathPrefersEnvVariable`,
 *   `testStoragePathBasedOnBasePath`, `testStoragePathCanBeCustomized` -- all
 *   read `basePath()`/`storagePath()`/`$_ENV`/`$_SERVER`; `Application.ts`'s
 *   class comment says a place has none of the filesystem, so there is no
 *   base path or storage path to resolve, with an env var or otherwise.
 * - `testPrefersJsonResponsesIsFluent`,
 *   `testPrefersJsonResponsesRegistersMiddlewareWhenEnabled`,
 *   `testPrefersJsonResponsesDefaultsToDisabled`,
 *   `testPrefersJsonResponsesIsIdempotentWhenCalledMultipleTimes`,
 *   `testPrefersJsonResponsesFalseDoesNotRegisterMiddleware` -- all exercise
 *   `prefersJsonResponses()` and `Http\Middleware\PrefersJsonResponses`;
 *   `ApplicationBuilder.ts`'s class comment lists `prefersJsonResponses` among
 *   what has "no counterpart here", and the middleware itself is not ported
 *   either.
 *
 * What upstream's own test file never exercises is what this port's
 * `ApplicationBuilder` *does* have -- `withConfig()`, `withRouting()`,
 * `withKernels()`, `withMiddleware()`, `withExceptions()`, `withProviders()`,
 * `withBindings()`, `withSingletons()`, `withScopedSingletons()`,
 * `registered()`/`booting()`/`booted()` and `create()` -- so there is nothing
 * ported-and-tested-upstream to carry over here rather than invent.
 */
export = (): void => {
    describe('Foundation.Configuration.ApplicationBuilder', () => {
        // See the class comment: every upstream case in
        // `FoundationApplicationBuilderTest.php` exercises paths, `.env`, or
        // `prefersJsonResponses()`, none of which this port has.
    });
};
