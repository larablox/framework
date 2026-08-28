/// <reference types="@rbxts/testez/globals" />

/**
 * PHP: `Illuminate\Tests\Support\SupportServiceProviderTest` -- has no
 * portable test in it, so this file intentionally carries none either, per
 * the same "document rather than silently omit" rule `Reflector.spec.ts`
 * follows.
 *
 * `ServiceProvider.ts`'s class comment: asset publishing, Artisan command
 * registration, migration/view/translation loading and the `optimize` hooks
 * are not ported -- they address a filesystem and a console that do not
 * exist here. Every test in `SupportServiceProviderTest` exercises exactly
 * that surface:
 *
 * - `testPublishableServiceProviders`, `testPublishableGroups`,
 *   `testSimpleAssetsArePublishedCorrectly`, `testMultipleAssetsArePublishedCorrectly`,
 *   `testSimpleTaggedAssetsArePublishedCorrectly`, `testMultipleTaggedAssetsArePublishedCorrectly`,
 *   `testMultipleTaggedAssetsAreMergedCorrectly` -- `publishes()`,
 *   `publishableProviders()`, `publishableGroups()`, `pathsToPublish()`; none
 *   of `$publishes`/`$publishGroups`/`pathsToPublish` exist on this port's
 *   `ServiceProvider`.
 * - `testPublishesMigrations` -- `publishesMigrations()`,
 *   `publishableMigrationPaths()`; not ported.
 * - `testLoadTranslationsFromWithoutNamespace`,
 *   `testLoadTranslationsFromWithNamespace` -- `loadTranslationsFrom()`; not
 *   ported (no `Translator`/filesystem here), and both rely on Mockery to
 *   stand in for `Illuminate\Translation\Translator`.
 * - `test_can_remove_provider` -- `removeProviderFromBootstrapFile()`, which
 *   rewrites a `bootstrap/providers.php` file; there is no bootstrap file, no
 *   filesystem, and no `App\Providers\*` namespace here.
 *
 * `ServiceProvider.ts`'s own surface -- `register()`, `booting()`/`booted()`
 * and their callback runners, `provides()`/`isDeferred()`, `callAfterResolving()`
 * -- has no counterpart test in `SupportServiceProviderTest` to port from;
 * inventing new cases for it would violate the "don't invent cases absent
 * from the PHP reference" rule, so this file stays empty of `it()`s.
 */
export = (): void => {
    describe('ServiceProvider', () => {
        // Intentionally no it() blocks -- see the file-level comment above.
    });
};
