/// <reference types="@rbxts/testez/globals" />
import { Application } from "Illuminate/Foundation/Application";
import { Container } from "Illuminate/Container/Container";
import { Hub } from "Illuminate/Pipeline/Hub";
import { HubContract } from "Illuminate/Contracts/Pipeline/Hub";
import { Pipeline } from "Illuminate/Pipeline/Pipeline";

/**
 * No upstream twin: pins the provider's bindings, and with them the
 * `Contract` token piloted here -- the hub is keyed by `HubContract`, the
 * way PHP keys it by the interface name. The provider itself is one of
 * `Application`'s base providers, so a fresh application already carries it.
 */
export = (): void => {
    describe("PipelineServiceProvider", () => {
        it("binds the hub as a singleton against its contract", () => {
            const app = new Application();

            const hub = app.make(HubContract);

            expect(hub instanceof Hub).to.equal(true);
            expect(app.make(HubContract)).to.equal(hub);
        });

        it("binds pipeline transiently", () => {
            const app = new Application();

            const pipeline = app.make("pipeline");

            expect(pipeline instanceof Pipeline).to.equal(true);
            expect(app.make("pipeline")).never.to.equal(pipeline);
        });

        it("resolving an unbound contract fails naming the contract", () => {
            const container = new Container();

            const [ok, err] = pcall(() => container.make(HubContract));

            expect(ok).to.equal(false);
            expect(tostring(err).find("Illuminate\\Contracts\\Pipeline\\Hub", 1, true)[0] !== undefined).to.equal(true);
        });
    });
};
