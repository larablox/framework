/// <reference types="@rbxts/testez/globals" />
import { Application } from "Illuminate/Foundation/Application";
import { DeferrableProvider } from "Illuminate/Contracts/Support/DeferrableProvider";
import { ProviderRepository } from "Illuminate/Foundation/ProviderRepository";
import { ServiceProvider } from "Illuminate/Support/ServiceProvider";
import type { Abstract } from "Illuminate/Container/Types";

/**
 * PHP: `Illuminate\Tests\Foundation\FoundationProviderRepositoryTest`.
 *
 * Every case upstream exercises manifest *caching to disk*:
 * `loadManifest()`/`writeManifest()`/`shouldRecompile()` read and write
 * `bootstrap/cache/services.php` through a `Filesystem`, and
 * `testServicesAreRegisteredWhenManifestIsNotRecompiled` /
 * `testManifestIsProperlyRecompiled` mock those three methods directly to
 * observe `load()`'s branching between them. `ProviderRepository.ts`'s class
 * comment is explicit that none of this survived the crossing: "The manifest
 * is compiled on every boot instead of being cached to disk... there is no
 * writable filesystem" -- `load()` here always calls `compileManifest()`
 * itself, and there is no `Filesystem`, `loadManifest()`, `writeManifest()` or
 * `shouldRecompile()` to mock. So:
 *
 * - `testShouldRecompileReturnsCorrectValue`, `testLoadManifestReturnsParsedJSON`,
 *   `testWriteManifestStoresToProperLocation`,
 *   `testWriteManifestThrowsExceptionIfManifestDirDoesntExist` -- no analogue
 *   at all; the methods they call do not exist here.
 * - `testServicesAreRegisteredWhenManifestIsNotRecompiled` /
 *   `testManifestIsProperlyRecompiled` -- adapted below into one test of what
 *   both were really pinning down through their mocks: `load()` registers
 *   eager providers immediately, and defers the ones that declare
 *   `provides()`, handing the deferred map to
 *   `Application::addDeferredServices()`. Real fixture providers stand in for
 *   the string-keyed `'foo'`/`'bar'` stubs Mockery built (a real
 *   `ProviderRepository::createProvider()` instantiates the class it is
 *   given, unlike PHP's mocked one, which never actually construct
 *   anything).
 */
export = (): void => {
    describe("Foundation.ProviderRepository", () => {
        class EagerProviderStub extends ServiceProvider {
            public static registered = false;

            public register(): void {
                EagerProviderStub.registered = true;
            }
        }

        @DeferrableProvider()
        class DeferredProviderStub extends ServiceProvider {
            public provides(): Array<Abstract> {
                return ["foo.provides1", "foo.provides2"];
            }
        }

        it("load() registers eager providers immediately and defers the rest (adapted -- see class comment)", () => {
            // PHP: FoundationProviderRepositoryTest::testServicesAreRegisteredWhenManifestIsNotRecompiled / testManifestIsProperlyRecompiled
            EagerProviderStub.registered = false;

            const app = new Application();
            const repo = new ProviderRepository(app);

            repo.load([DeferredProviderStub, EagerProviderStub]);

            expect(EagerProviderStub.registered).to.equal(true);
            expect(app.providerIsLoaded(EagerProviderStub)).to.equal(true);

            expect(app.isDeferredService("foo.provides1")).to.equal(true);
            expect(app.isDeferredService("foo.provides2")).to.equal(true);
            expect(app.providerIsLoaded(DeferredProviderStub)).to.equal(false);

            const deferred = app.getDeferredServices();
            expect(deferred.get("foo.provides1")).to.equal(DeferredProviderStub);
            expect(deferred.get("foo.provides2")).to.equal(DeferredProviderStub);
        });
    });
};
