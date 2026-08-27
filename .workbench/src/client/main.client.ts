import { Client } from "@larablox/framework/out/Illuminate/Foundation/Runtime/Client";
import { app } from "client/bootstrap/app";

app.make<Client>(Client).boot();
