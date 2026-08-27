# Загрузка приложения

Сервер и клиент — два независимых приложения со своим контейнером, конфигом и
списком провайдеров. Общий код лежит в `src/Illuminate` и реплицируется в
`ReplicatedStorage.Illuminate`.

## Последовательность

```
src/server/main.server.ts
  └─ import { app } from "server/bootstrap/app"
       └─ Application.configure().withConfig(config).create()
            ├─ withKernels()                   // Kernel, RemoteGateway, Server, Worker, Client
            ├─ withConfig()                    // конфиг передаётся заранее
            └─ new Application()
                 ├─ registerBaseBindings()          // setInstance, "app", Container
                 ├─ registerBaseServiceProviders()  // Event, Log, Context, Bus, Pipeline, Routing
                 └─ registerCoreContainerAliases()  // "app"/"config"/"events" → классы
  └─ server.boot()
       ├─ worker.boot()
       │    ├─ app.make(Kernel)  → syncMiddlewareToRouter(), затем колбэк withMiddleware()
       │    ├─ kernel.bootstrap()→ app.bootstrapWith(<список ядра>)
       │    │    ├─ LoadConfiguration   → instance("config"), detectEnvironment, resolveEnvironmentUsing
       │    │    ├─ RegisterFacades     → Facade::setFacadeApplication()
       │    │    ├─ RegisterProviders   → registerConfiguredProviders() → ProviderRepository::load()
       │    │    └─ BootProviders       → app.boot()
       │    ├─ warm()            → резолв тяжёлых синглтонов до первого запроса
       │    └─ событие WorkerStarting
       └─ gateway.listen(request → worker.handle(request))
            └─ worker.handle(request)
                 ├─ sandbox = app.sandbox()   // копия контейнера на запрос
                 ├─ событие RequestReceived
                 ├─ kernel.handle(request, sandbox)   // ядро о запросе ничего не хранит
                 │    ├─ sandbox.instance("request") → глобальные middleware
                 │    ├─ router.dispatch(request, sandbox)
                 │    ├─ что-то брошено      → Handler::report() + Handler::render()
                 │    └─ событие RequestHandled
                 └─ task.defer:
                      ├─ kernel.terminate(request, response, sandbox)
                      │    → Terminating, terminate() у middleware,
                      │      sandbox.terminate()  ← не корневой app
                      ├─ событие RequestTerminated
                      └─ sandbox.flush(), Str.flushCache()
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
app.make<Server>(Server).boot();
```

Три точки входа лежат в `Foundation/Runtime`:

| Класс | Роль | Откуда |
|---|---|---|
| `Server` | владеет транспортом: поднимает воркер и цепляет шлюз | Octane: сервер (Swoole/RoadRunner) держит сокет |
| `Worker` | обслуживает один запрос на песочнице | `Laravel\Octane\Worker` |
| `Client` | точка входа второго рантайма | прецедента нет, платформа вынуждает |

Разделение `Server`/`Worker` — октейновское: там сервер владеет сокетом и
передаёт пришедшее воркеру, который отвечает. Шов был здесь и раньше, просто
безымянный — докблок `RemoteGateway` сам про себя говорит «это сокет, та часть,
которую PHP оставляет веб-серверу».

`RemoteGateway` тоже забинжен синглтоном, и по резкой причине: его флаг
`listening` живёт на инстансе, поэтому два резолва небинженного шлюза
подписались бы оба и каждый запрос обслужился бы дважды.

PHP бутстрапит на входе в первый запрос: процесс рождается вместе с этим
запросом и умирает вместе с ответом. Здесь процесс переживает запросы, а
провайдерам есть что делать до первого вызова — тому же воркеру очереди, —
поэтому `bootstrap()` зовётся на старте. И `terminate()` уезжает в `task.defer`:
PHP терминирует после `$response->send()`, а «отправить ответ» здесь означает
«вернуть его».

## Воркер и песочница

Приложение, которое живёт всегда, — это ровно то, во что Octane превращает
PHP-процесс, поэтому `Illuminate/Foundation/Runtime/Worker` портирован не с
`public/index.php`, а с `Laravel\Octane\Worker`.

Корневое приложение бутстрапится один раз и больше не трогается. Отдавать его
запросу нельзя: всё, что запрос зарезолвил, перебиндил или забыл, осталось бы
следующему. Поэтому каждый запрос получает `app.sandbox()` — копию контейнера
(`clone $this->app` в Octane). Копия делит с корнем уже созданные синглтоны, но
владеет самими картами, так что `flush()` по ней корень не задевает.

Из этого следует то, ради чего всё затевалось: `Kernel::terminate()` остаётся
дословным ларавеловским — с `$this->app->terminate()` на конце. Просто
`$this->app` в этот момент песочница, а не корень: терминируется и флашится
копия, `Kernel.ts` при этом не изменился ни на строку.

Три расхождения с Octane, все вынужденные:

- **`CurrentApplication::set()` портирован наполовину.** Octane переключает на
  песочницу и глобальный контейнер, и корень фасадов — обе величины
  процессные. Обработчик ремоута — корутина, и любой yield внутри маршрута
  (`DataStore`, `task.wait()`) пускает следующий запрос до того, как закончился
  текущий; переключение отдало бы одному запросу песочницу другого. Поэтому
  `Container::setInstance()` и `Facade::setFacadeApplication()` навсегда смотрят
  на корень, а песочница перебинживает только ключи `"app"` и `Container`
  внутри себя. Фасад резолвит из корня — верно для синглтонов, ради которых он
  и нужен, и неверно для чего угодно request-scoped: `App::make("request")` не
  использовать.
- **Ядро одно, но песочницу оно не одалживает.** Octane переключает ядро на
  песочницу и обратно (`GiveNewApplicationInstanceToHttpKernel`); здесь так
  нельзя — запросы чередуются, и следующий увёл бы ядро из-под текущего.
  Поэтому ядро не хранит о запросе **ничего**: песочница передаётся ему
  вызовом (`Kernel::handle(request, app)`, `Kernel::terminate(request,
  response, app)`), и он передаёт её дальше роутеру. Время старта запроса
  лежит там же — в песочнице, под приватным ключом, а не полем на ядре.
  Замерено: без этого отложенная терминация терминирует чужую песочницу или
  корень, а обработчики `whenRequestLifecycleIsLongerThan` для части запросов
  не срабатывают вовсе.
- **`FlushStrCache` переехал.** Octane вешает его на `RequestReceived`, то есть
  на начало следующего запроса; здесь он на выходе, чтобы запрос, стартовавший
  посреди другого, не выдёргивал кэш из-под него.

Из листенеров Octane перенесено по смыслу только это: остальные 47 — про БД,
сессии, auth, cookies, Vite, Livewire, Inertia, Scout, Socialite. Не перенесён и
`CreateConfigurationSandbox`: PHP клонирует `config` по значению вглубь, а
поверхностная копия делила бы вложенные таблицы — то есть `Config::set()` на
вложенном ключе всё равно протёк бы. Пока `Config::set()` внутри запроса
трогает общий репозиторий.

`warm()` резолвит тяжёлые синглтоны до первого запроса. Список берётся из
`app.warm`, а при его отсутствии — из `Worker.defaultServicesToWarm()`
(`events`, `config`, `log`, `router`, `queue`); в PHP это `octane.warm` из
конфига, который публикует пакет, а публиковать здесь некуда.

События жизненного цикла — `WorkerStarting`, `WorkerStopping`,
`WorkerErrorOccurred`, `RequestReceived`, `RequestTerminated` — лежат в
`Illuminate/Foundation/Events` и повторяют одноимённые события Octane. На них
вешается всё, что игре нужно сбрасывать между запросами.

## Маршрутизация: ничего per-request на общих объектах

Обработчик ремоута — корутина. Любой yield внутри маршрута пускает следующий
запрос до того, как закончился текущий. Значит per-request состояние не может
лежать ни на одном объекте, переживающем запрос, — а `Router` синглтон, и
`Route` в коллекции живёт всё место.

**Маршрут копируется на запрос.** `AbstractRouteCollection::handleMatchedRoute()`
в PHP биндит сам маршрут коллекции: там объект живёт ровно один запрос. Здесь он
шаблон, и матчинг отдаёт копию — `Route::forRequest()`. На копии живут
`parameterValues`, `originalParameterValues`, `controller` и контейнер; шаблон
держит то, что дорого и неизменно: скомпилированный паттерн и имена параметров
(их специально прогревают до копирования). `computedMiddleware` намеренно **не**
прогревается: его сбор инстанцирует контроллер, а контроллер — ровно то, что
копия и разводит. Побочно это делает Octane's `flushController()` ненужным.

Без этого два запроса по одному маршруту молча меняются параметрами: первый
уходит в `DataStore`, второй перебиндивает `{id}`, первый просыпается и читает
чужой id.

**Контейнер приезжает с запросом.** `Router` — синглтон, построенный на корневом
приложении, и держит его. Поэтому `dispatch()` принимает вторым аргументом
контейнер (по умолчанию — свой), ядро передаёт туда песочницу, `findRoute()`
кладёт её на копию маршрута, а `runRouteWithinStack()` берёт контейнер уже с
маршрута. Дальше из песочницы резолвятся контроллер, диспетчеры и весь
middleware-конвейер — включая `instance("request")`, который ядро туда и
положило. Это `GiveNewApplicationInstanceToRouter` из Octane, только копией, а
не мутацией общего роутера.

**`Router::current()` — по корутине.** `$currentRoute` и `$currentRequest` в
PHP два поля, и это точно: на процесс приходится один запрос. Здесь роутер
синглтон, и yield внутри маршрута давал следующему запросу перезаписать оба —
первый просыпался и читал про второго. Ядру и маршруту per-request состояние
отдали в песочницу, а этим нельзя: весь их смысл в том, что они доступны, **не
получая ничего на вход**. Значит различать нечем, кроме корутины, — запрос это
одна корутина от шлюза и вниз.

Ключи слабые: запись уходит со сборкой корутины. Чистить на выходе нельзя —
PHP их после ответа не чистит, а terminable middleware работает уже после.

Два следствия. Вложенный диспетч на одном потоке этим не разводится
(лечится save/restore, а не ключом по потоку). И в отложенной терминации
`current()` вернёт `nil`, потому что `task.defer` — другой поток; раньше вернул
бы что-то, возможно чужое.

`Request::route()` корректен и был корректен всегда — он идёт через
`setRouteResolver()` и указывает на копию своего запроса.

Вокруг каждого бутстраппера `bootstrapWith` шлёт события
`bootstrapping: <Имя>` и `bootstrapped: <Имя>` — на них вешаются
`beforeBootstrapping()` / `afterBootstrapping()`.

Список бутстрапперов держит ядро — как и в Laravel. Клиент ядра не резолвит:
запросов он не обслуживает. Его точка входа — `Foundation/Runtime/Client`:

```ts
// src/client/main.client.ts
app.make<Client>(Client).boot();
```

`Client` — клиенту то же, чем `Worker` является серверу: держит список
бутстрапперов этой точки входа и прогревает то, чем этот рантайм пользуется
(`events`, `config`, `log` — без роутера и очереди). Ядром он **не** является:
диспетчить нечего, входящее на клиенте — вещание, а не маршруты (решение 6 в
`routing-design.md`). Дописать туда `handle()` — значит переоткрыть уже принятое
решение.

То, что список бутстрапперов держит фреймворковый класс, а не игра, — это
laravel'овская форма, а не отход от неё: в PHP список консоли лежит в
`Illuminate\Foundation\Console\Kernel`, а приложение его наследует. И списки у
двух точек входа разные — потому что нужды разные.

Имя: `Illuminate\Http\Client` — это **исходящий** HTTP-клиент, совсем другая
вещь, но пересекаются они только на словах. Символа `Client` то пространство
имён не экспортирует вовсе (там `Factory`, `PendingRequest`, `Response`), так
что алиасить ничего не приходится. Настоящая пара одноимённых классов в порте
уже есть, и она из PHP: `Http\Response` и `Http\Client\Response`.

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
