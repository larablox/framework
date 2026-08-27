import { Server } from "@larablox/framework/out/Illuminate/Foundation/Runtime/Server";
import { app } from "server/bootstrap/app";

app.make<Server>(Server).boot();
