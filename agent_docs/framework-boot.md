# Загрузка приложения

Сервер и клиент — два независимых приложения со своим контейнером, конфигом и
списком провайдеров. Общий код лежит в `src/Illuminate` и реплицируется в
`ReplicatedStorage.Illuminate`.

## Последовательность

```
src/server/main.server.ts
  └─ import { app } from "server/bootstrap/app"
       └─ Application.configure().withConfig(config).create()
            ├─ withKernels()                   // singleton(Kernel), зовёт сам configure()
            ├─ withConfig()                    // конфиг передаётся заранее
            └─ new Application()
                 ├─ registerBaseBindings()          // setInstance, "app", Container
                 ├─ registerBaseServiceProviders()  // Event, Log, Context, Bus, Pipeline, Routing
                 └─ registerCoreContainerAliases()  // "app"/"config"/"events" → классы
  └─ app.make(Kernel)     → syncMiddlewareToRouter(), затем колбэк withMiddleware()
  └─ kernel.bootstrap()   → app.bootstrapWith(<список ядра>)
       ├─ LoadConfiguration   → instance("config"), detectEnvironment, resolveEnvironmentUsing
       ├─ RegisterFacades     → Facade::setFacadeApplication()
       ├─ RegisterProviders   → registerConfiguredProviders() → ProviderRepository::load()
       └─ BootProviders       → app.boot()
  └─ gateway.listen(request → kernel.handle(request))
       ├─ instance("request") → глобальные middleware → router.dispatch()
       ├─ что-то брошено      → Handler::report() + Handler::render()
       ├─ событие RequestHandled
       └─ task.defer(terminate) → Terminating, terminate() у middleware, app.terminate()
```

`Bus` и `Pipeline` в PHP лежат не среди базовых провайдеров, а в
`DefaultProviders`; здесь `DefaultProviders` ещё нет, а шина нужна каждой
отправленной джобе — поэтому они регистрируются базовыми. `Routing` базовый и в
Laravel.

`Application.configure()` возвращает `ApplicationBuilder` — идиома Laravel 11+.
`withConfig()` занимает место `configure(basePath:)`, остальные портированные
методы: `withKernels`, `withRouting`, `withMiddleware`, `withExceptions`,
`withProviders`, `withBindings`, `withSingletons`, `withScopedSingletons`,
`registered`, `booting`, `booted`, `create`.

`withKernels()` зовёт сам `configure()`, как и в PHP. Консольного ядра нет, а
контракт `Contracts\Http\Kernel` — интерфейс, то есть ключом контейнера быть не
может, поэтому биндинг остаётся один: сам класс ядра.

`withMiddleware()` и `withExceptions()` откладывают настройку до резолва —
`afterResolving` на ядро и на обработчик, как в PHP. Поэтому колбэк волен
называть middleware, которые контейнер ещё не умеет строить.

`withRouting()` принимает функцию, а не путь к файлу маршрутов: файлов нет.
Она вызывается на `booting`, а после `booted` перестраиваются таблицы имён и
действий — иначе `->name()`, который выполняется уже после добавления маршрута
в коллекцию, в них бы не попал (в PHP это делает `RouteServiceProvider`).

```ts
// src/server/bootstrap/app.ts
export const app = Application.configure()
    .withConfig(config)
    .withRouting(api)
    .withMiddleware()
    .withExceptions()
    .create();
```

Сам обработчик запросов поднимает точка входа — там, где в PHP это делает
`public/index.php`:

```ts
// src/server/main.server.ts
const kernel = app.make<Kernel>(Kernel);

kernel.bootstrap();

app.make<RemoteGateway>(RemoteGateway).listen((request: Request) => {
    const response = kernel.handle(request);

    task.defer(() => kernel.terminate(request, response));

    return response;
});
```

PHP бутстрапит на входе в первый запрос: процесс рождается вместе с этим
запросом и умирает вместе с ответом. Здесь процесс переживает запросы, а
провайдерам есть что делать до первого вызова — тому же воркеру очереди, —
поэтому `bootstrap()` зовётся на старте. И `terminate()` уезжает в `task.defer`:
PHP терминирует после `$response->send()`, а «отправить ответ» здесь означает
«вернуть его».

Вокруг каждого бутстраппера `bootstrapWith` шлёт события
`bootstrapping: <Имя>` и `bootstrapped: <Имя>` — на них вешаются
`beforeBootstrapping()` / `afterBootstrapping()`.

Список бутстрапперов держит ядро — как и в Laravel. Клиент ядра не резолвит:
запросов он не обслуживает, поэтому `main.client.ts` зовёт `bootstrapWith()`
сам.

## Конфигурация

Файловой системы нет, поэтому конфиг — обычный TS-модуль, а не директория с
файлами. Каждый ключ верхнего уровня соответствует одному файлу Laravel:

```ts
// src/server/config/app.ts
export const app = {
    name: "Larablox",
    env: RunService.IsStudio() ? "local" : "production",
    debug: RunService.IsStudio(),
    providers: [
        CacheServiceProvider,
        QueueServiceProvider,
        AppServiceProvider,
    ] as Array<Constructor<ServiceProvider>>,
};

// src/server/config/index.ts
export const config = { app, cache, logging, queue };
```

Сейчас у сервера четыре файла: `app`, `cache`, `logging`, `queue`. Ключ
`queue.failed.driver` выбирает хранилище упавших джобов (`null` или
`datastore`); необязательный `cache.limiter` задаёт стор для `RateLimiter` —
без него берётся стор по умолчанию, как и в Laravel. `app.debug` читает
обработчик исключений: с ним упавший запрос отвечает сообщением и классом
брошенного, без него — сухим `Server Error`.

## Фасады

`RegisterFacades` отдаёт фасадам приложение; дальше `App`, `Config`, `Event`,
`Log`, `Context`, `Queue`, `Bus`, `Cache` (и `CacheStores`) и `RateLimiter`
работают как в Laravel, но импортируются явно — глобальных алиасов
(`AliasLoader`) в TypeScript нет:

```ts
import { Config } from "Illuminate/Support/Facades/Config";

Config.get("app.name");
```

Новый фасад — это `getFacadeAccessor()`, декоратор `Forwards` и список
пробрасываемых методов через `public static declare` (см. laravel-parity.md).

## Логирование

`LogServiceProvider` регистрируется базово, как и в Laravel, поэтому `log`
доступен ещё до `RegisterProviders`. Каналы описываются в `config/logging.ts`:

```ts
export const logging = {
    default: "stack",
    channels: {
        stack: { driver: "stack", channels: ["console"] },
        console: { driver: "console", level: "debug" },
        null: { driver: "null" },
    },
};
```

`console` пишет в вывод Roblox и заменяет файловые драйверы PHP. Свой драйвер
регистрируется через `Log.extend("name", (app, config) => logger)` или каналом
с `driver: "custom"` и фабрикой в `via`. Под каналами лежит Monolog из
`src/Monolog` — стек хендлеров и процессоров, как в Laravel.

Канал можно донастроить через `tap`: класс достаётся из контейнера, получает
логгер и аргументы из строки после двоеточия.

```ts
console: {
    driver: "console",
    level: "debug",
    tap: ["App/Logging/CustomiseFormatter:brief"],
},
```

Класс tap объявляет метод `__invoke(logger, ...args)` — в PHP это магический
`__invoke`, здесь обычный метод.

## Контекст логов

`ContextServiceProvider` регистрируется базово и биндит `Context\Repository` как
scoped. Всё, что в него положено, попадает в `extra` каждой записи через
`ContextLogProcessor`:

```ts
Context.add("place", "lobby");
Log.info("player joined");   // ... {"place":"lobby"}
```

`Context.dehydrate()` отдаёт снапшот, `hydrate()` его восстанавливает — так
контекст переносится в другую корутину или через ремоут.

`LoadConfiguration.using(config)` вызывается до `new Application()`. Дальше
`config("app.name")` доступен как `app.make<Repository>("config").get("app.name")`
с точечной нотацией через `Support/Arr`.

`app.env` попадает в биндинг `"env"` и питает `Application::environment()`,
`isLocal()`, `isProduction()`, а также резолвер окружения контейнера — тот, что
использует атрибут `Bind` для биндингов «только на сервере / только в студии».

## Провайдеры

```ts
export class MatchmakingServiceProvider extends ServiceProvider {
    public register(): void {
        this.app.singleton(Matchmaker);
    }

    public boot(@Inject(Dispatcher) events: Dispatcher): void {
        events.listen(PlayerJoined, [Matchmaker, "onPlayerJoined"]);
    }
}
```

- `register()` — только биндинги. На этом этапе другие сервисы ещё не
  зарегистрированы.
- `boot()` вызывается через `Container::call()`, поэтому его параметры
  инжектируются по `@Inject`. Метода может не быть вовсе.
- Порядок: все `register()` в порядке из `config.app.providers`, затем все
  `boot()` в том же порядке (`OrderedMap` гарантирует это в Luau).
- Свойства `bindings` / `singletons` на провайдере регистрируются сразу после
  `register()`.

### Отложенные провайдеры

Провайдер считается отложенным, если объявил собственный `provides()`
(в PHP это интерфейс `DeferrableProvider`, а интерфейсы стёрты):

```ts
export class MailProvider extends ServiceProvider {
    public register(): void {
        this.app.singleton(Mailer);
    }

    public provides(): Array<Abstract> {
        return [Mailer];
    }
}
```

Такой провайдер не регистрируется на старте: `ProviderRepository` кладёт его
сервисы в `deferredServices`, а `Application::make()` регистрирует и бутит его
при первом обращении к сервису. `when()` возвращает список событий, по которым
провайдер регистрируется досрочно.

## Воркер очереди

Консоли нет, поэтому `php artisan queue:work` заменяет `boot()` провайдера
приложения: воркер резолвится из контейнера и крутится в своей корутине.

```ts
const worker = this.app.make<Worker>("queue.worker");

task.spawn(() => worker.daemon("memory", "default", new WorkerOptions()));

game.BindToClose(() => worker.shutdown());
```

`shutdown()` только ставит флаг: воркер выходит из цикла, доработав джоб,
который держит в руках. В момент резолва `queue.worker` провайдер подписывается
на `JobFailed` и пишет упавшие джобы туда, куда указывает
`queue.failed.driver` — то, что PHP делает в `WorkCommand`.

## Точки расширения

- `app.registered(cb)` — после регистрации всех провайдеров.
- `app.booting(cb)` / `app.booted(cb)` — вокруг `boot()`; `booted()` вызывает
  колбэк немедленно, если приложение уже загружено.
- `provider.booting(cb)` / `provider.booted(cb)` — вокруг `boot()` конкретного
  провайдера.
- `app.terminating(cb)` + `app.terminate()` — завершение; в Roblox уместно
  вызывать из `game:BindToClose()`.
