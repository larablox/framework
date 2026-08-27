import { ServiceProvider } from "@larablox/framework/out/Illuminate/Support/ServiceProvider";
import { Log } from "@larablox/framework/out/Illuminate/Support/Facades/Log";

export class ServerAppServiceProvider extends ServiceProvider {
    public register(): void {
        Log.info("ServerAppServiceProvider::register");
    }

    public boot(): void {
        Log.info("ServerAppServiceProvider::boot");
    }
}
