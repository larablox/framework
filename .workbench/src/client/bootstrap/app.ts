import { Application } from "@larablox/framework/out/Illuminate/Foundation/Application";
import { config } from "client/config";

// eslint-disable-next-line
export const app = Application.configure(config)
    .withExceptions()
    .create();
