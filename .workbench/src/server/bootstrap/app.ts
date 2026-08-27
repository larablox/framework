import { Application } from "@larablox/framework/out/Illuminate/Foundation/Application";
import { api } from "server/routes/api";
import { config } from "server/config";

export const app = Application.configure(config)
    .withRouting(api)
    .withMiddleware()
    .withExceptions()
    .create();
