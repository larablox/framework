import { ServiceProvider } from "@larablox/framework/out/Illuminate/Support/ServiceProvider";
import { Log } from "@larablox/framework/out/Illuminate/Support/Facades/Log";

export class ClientAppServiceProvider extends ServiceProvider {
    public register(): void {
        Log.info("AppServiceProvider::register");
    }

    public boot(): void {
        Log.info("AppServiceProvider::boot");
    }
}
