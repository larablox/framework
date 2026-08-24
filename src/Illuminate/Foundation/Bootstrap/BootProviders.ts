import type { Application } from "Illuminate/Contracts/Foundation/Application";
import type { Bootstrapper } from "Illuminate/Contracts/Foundation/Application";

export class BootProviders implements Bootstrapper {
    /** Bootstrap the given application. */
    public bootstrap(app: Application): void {
        app.boot();
    }
}
