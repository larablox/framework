# Larablox Framework

<p align="center">
<a href="https://github.com/larablox/framework/actions/workflows/ci.yml"><img src="https://github.com/larablox/framework/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@larablox/framework"><img src="https://img.shields.io/npm/v/@larablox/framework" alt="Latest Version"></a>
<a href="https://www.npmjs.com/package/@larablox/framework"><img src="https://img.shields.io/npm/l/@larablox/framework" alt="License"></a>
</p>

> **Note:** This repository contains the core code of the Larablox framework. If
> you want to build a game using Larablox, visit the main
> [Larablox repository](https://github.com/larablox/larablox).

## About Larablox

Larablox is a roblox-ts port of [Laravel](https://github.com/laravel/framework),
as faithfully as the Roblox platform allows. Class names, method names and
argument order are reproduced literally; the port diverges only where the
platform forces it, and every divergence is written down.

It brings to a Roblox place the things Laravel brings to a web application:

- A [service container](https://laravel.com/docs/container) with contextual
  bindings, tagging, and attribute-driven injection
- [Routing](https://laravel.com/docs/routing) — over remotes rather than HTTP,
  but the same `Router`, the same verbs, the same middleware pipeline
- [Queues](https://laravel.com/docs/queues) with several backends, a worker,
  job batching, chaining and failed-job storage
- [Cache](https://laravel.com/docs/cache) with locks, rate limiting, and
  multiple stores
- [Events](https://laravel.com/docs/events), including queued listeners
- A [command bus](https://laravel.com/docs/queues#job-chaining),
  [pipelines](https://laravel.com/docs/helpers#pipeline),
  [logging](https://laravel.com/docs/logging), and
  [collections](https://laravel.com/docs/collections)

## What's included

- **Container** — `Container`, `BoundMethod`, contextual bindings, tagging,
  `RewindableGenerator`, and the `Singleton`/`Scoped`/`Bind` and
  `Give`/`Config`/`Tag`/`Log`/`Context` attributes
- **Foundation** — `Application`, `ApplicationBuilder`, the HTTP kernel, the
  bootstrappers, service providers, and the exception handler
- **Routing** — `Router`, `Route`, `RouteCollection`, route groups and
  registrars, `RouteParameterBinder` for model binding, controllers and their
  dispatchers, and middleware including `ThrottleRequests`
- **Http** — `Request`, `Response`, the `RemoteGateway` that carries requests
  over Roblox remotes, and an HTTP client (`Factory`, `PendingRequest`) behind
  the `Http` facade. One `Response` covers what PHP splits across
  `JsonResponse` and its siblings; `RedirectResponse` has nothing to redirect
  to here and is not ported
- **Queue** — `QueueManager` with sync, null, deferred, in-memory and
  MemoryStore backends; `Worker`; job middleware; batching; chaining; the
  `Tries`/`Timeout`/`Backoff`/`Queue`/`Connection`/`Delay` attributes; and
  DataStore-backed failed-job storage
- **Bus** — `Dispatcher`, `Queueable`, `Dispatchable`, `PendingDispatch`,
  `PendingChain`, and batches
- **Cache** — `Repository`, `CacheManager`, array, DataStore and MemoryStore
  stores, locks, and `RateLimiter`
- **Events** — `Dispatcher`, `NullDispatcher`, and queued listeners
- **Log** — `LogManager` and `Context`, built on
  [`@larablox/monolog`](https://github.com/larablox/monolog)
- **Pipeline** — `Pipeline` and `Hub`
- **Support** — `Collection`, `Arr`, `Str`, `Stringable`, `Serializer`,
  `Concurrency`, `Reflector`, the helper functions, the traits, and the
  `App`/`Bus`/`Cache`/`Config`/`Context`/`Event`/`Http`/`Log`/`Queue`/`RateLimiter`/`Route`
  facades

## Requirements

- TypeScript 5.x compiled with [roblox-ts](https://roblox-ts.com/) `^3.0`
- A Rojo-synced Roblox place to run the compiled output in
- [`@larablox/monolog`](https://github.com/larablox/monolog), installed for you
  as a dependency

## Submitting bugs and feature requests

Bugs and feature requests are tracked on
[GitHub](https://github.com/larablox/framework/issues).

## License

MIT, matching upstream Laravel.

## Acknowledgements

This is a TypeScript/roblox-ts port of
[Laravel](https://github.com/laravel/framework) by Taylor Otwell, adapted to
run on the Roblox platform as faithfully as it allows.
