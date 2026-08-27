import { ClientAppServiceProvider } from "client/app/Providers/ClientAppServiceProvider";
import type { Constructor } from "@larablox/framework/out/Illuminate/Container/Types";
import type { ServiceProvider } from "@larablox/framework/out/Illuminate/Support/ServiceProvider";

const RunService = game.GetService("RunService");

export const app = {
    name: "Larablox",

    env: RunService.IsStudio() ? "local" : "production",

    debug: true,

    // eslint-disable-next-line
    providers: [
        ClientAppServiceProvider,
    ] as Array<Constructor<ServiceProvider>>,
};
