import { ServerAppServiceProvider } from "server/app/Providers/ServerAppServiceProvider";
import type { Constructor } from "@larablox/framework/out/Illuminate/Container/Types";
import type { ServiceProvider } from "@larablox/framework/out/Illuminate/Support/ServiceProvider";

const RunService = game.GetService("RunService");

export const app = {
    name: "Workbench",

    env: RunService.IsStudio() ? "local" : "production",

    debug: true,

    // eslint-disable-next-line
    providers: [
        ServerAppServiceProvider,
    ] as Array<Constructor<ServiceProvider>>,
};
