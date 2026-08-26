/// <reference types="@rbxts/testez/globals" />
import { Application } from "Illuminate/Foundation/Application";
import { LoadConfiguration } from "Illuminate/Foundation/Bootstrap/LoadConfiguration";
import { Repository as ConfigRepository } from "Illuminate/Config/Repository";

/**
 * PHP: `Illuminate\Tests\Foundation\Bootstrap\LoadConfigurationTest`.
 *
 * `LoadConfiguration.ts`'s class comment: PHP discovers `config/*.php` on
 * disk and merges a cached file over it; there is no filesystem here, so the
 * configuration is handed to the bootstrapper up front with
 * `LoadConfiguration.using()` instead. That drops the two thirds of upstream
 * that read from disk:
 *
 * - `testDontLoadBaseConfiguration` -- `dontMergeFrameworkConfiguration()`
 *   toggles whether the framework's own `config/*.php` defaults get merged
 *   in; there is no base `config/` directory to merge here at all.
 * - `testLoadsConfigurationInIsolation`,
 *   `testConfigurationArrayKeysMatchLoadedFilenames` -- both read
 *   `useConfigPath()` and a fixtures directory off disk; neither the path nor
 *   a `Filesystem` scan of it exists here.
 *
 * What is left is genuinely ported: `bootstrap()` puts a `Repository` built
 * from `LoadConfiguration.using()`'s items behind the `config` key
 * (`testLoadsBaseConfiguration`, adapted to items handed over directly rather
 * than read from `config/app.php`), and it wires `detectEnvironment()` /
 * `resolveEnvironmentUsing()` so environment matching works afterwards
 * (`testSetsEnvironmentResolver`, adapted: this port's `Container` has no
 * `environmentResolver` accessible via reflection, so the resolver's effect
 * -- `Container::currentEnvironmentIs()` answering rather than always
 * refusing -- is asserted instead of the property itself).
 */
export = (): void => {
    describe("Foundation.Bootstrap.LoadConfiguration", () => {
        it("bootstrap() puts the configured items behind the `config` key", () => {
            // PHP: LoadConfigurationTest::testLoadsBaseConfiguration
            LoadConfiguration.using({ app: { name: "Larablox" } });

            const app = new Application();
            new LoadConfiguration().bootstrap(app);

            expect(
                app.make<ConfigRepository>("config").get("app.name"),
            ).to.equal("Larablox");
        });

        it("bootstrap() wires an environment resolver (adapted -- see class comment)", () => {
            // PHP: LoadConfigurationTest::testSetsEnvironmentResolver
            LoadConfiguration.using({ app: { env: "local" } });

            const app = new Application();

            expect(app.currentEnvironmentIs("loc*")).to.equal(false);

            new LoadConfiguration().bootstrap(app);

            expect(app.currentEnvironmentIs("loc*")).to.equal(true);
            expect(app.currentEnvironmentIs("prod*")).to.equal(false);
        });
    });
};
