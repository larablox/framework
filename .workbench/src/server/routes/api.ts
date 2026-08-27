import { Response } from "@larablox/framework/out/Illuminate/Http/Response";
import type { Router } from "@larablox/framework/out/Illuminate/Routing/Router";

export function api(route: Router): void {
    route.get("ping", () => new Response({ pong: true }));
}
