# План портирования

Состояние на 2026-08-23. Источник — `laravel/framework` 13.12 в
`\\wsl.localhost\Ubuntu-24.04\home\m0nclous\PhpstormProjects\laravel-base\vendor`,
документация — `C:\Users\m0nclous\laravel-docs` (ветка `13.x`).

Этот файл отвечает на два вопроса: **что уже есть и чего в нём не хватает**, и
**что брать дальше**. Как устроены принятые решения — в `laravel-parity.md`,
ограничения платформы — в `roblox-ts-constraints.md`, загрузка — в
`framework-boot.md`.

---

## Решения, на которых всё держится

Их не стоит пересматривать походя — от них зависит весь уже написанный код.

1. **Идентификатор биндинга — `string | class`.** Class-string в Luau нет, сам
   класс занимает место `Foo::class`.
2. **Зависимости объявляются декоратором `@Inject(abstract)`** на параметре
   конструктора или метода. Сигнатуры стёрты, `ReflectionParameter` неоткуда
   взять.
3. **Ассоциативные массивы PHP — это `Support/OrderedMap`.** Порядок обхода
   таблицы Luau не определён, а фреймворк на порядок опирается.
4. **Значение не может быть `nil`.** Массив Luau не хранит дыры, поэтому везде
   `Array<defined>`.
5. **Паттерны Luau вместо PCRE.** Нет альтернативы `|`, групп-квантификаторов и
   lookaround.
6. **Фасады — метатаблица вместо `__callStatic`**, список методов через
   `public static declare` с обёрткой `Forwarded<T>`.
7. **Неймспейс вендора = каталог верхнего уровня.** `Illuminate\*` →
   `src/Illuminate`, `Monolog\*` → `src/Monolog`. Новый вендор требует записи в
   `default.project.json` **и перезапуска `rojo serve`** — проектный файл
   читается только при старте.

---

## Что портировано и чего в нём не хватает

### Container — `src/Illuminate/Container`

**Портирован полностью.** Из 87 методов PHP-класса отсутствуют ровно три, и
все три невозможны в принципе (см. ниже). Сверка — построчным диффом списков
методов, а не на глаз:

```bash
grep -oE "(public|protected) (static )?function [a-zA-Z_]+" \
  vendor/laravel/framework/src/Illuminate/Container/Container.php \
  | sed 's/.*function //' | sort
```

Есть всё: биндинги, синглтоны, scoped, алиасы, теги с ленивым
`RewindableGenerator`, контекстные биндинги (включая списочные для variadic),
rebinding, extenders, коллбэки резолвинга, `call()` и method-биндинги,
атрибуты класса `Singleton`/`Scoped`/`Bind`, контекстные атрибуты
(`whenHasAttribute`, `resolveFromAttribute`, `afterResolvingAttribute`,
`fireAfterResolvingAttributeCallbacks`), атрибуты параметров `Give`, `Config`,
`Tag`, `Log`, `Context`, variadic-зависимости, методы `ArrayAccess`
(`offsetExists`/`offsetGet`/`offsetSet`/`offsetUnset`).

Невозможно на платформе — это не «потом доделать», а окончательно:

- **`bindBasedOnClosureReturnTypes`** — `bind()` с замыканием в роли abstract
  выводит связываемые типы из возвращаемого типа замыкания. Типы стёрты.
- **`__get` / `__set`** — синтаксический сахар `$app->events`. В TypeScript
  индекс и обращение к свойству — одно и то же выражение, отдельного синтаксиса
  для перехвата нет; а поставить функцию на `__index` самого горячего объекта
  фреймворка означало бы ловить ещё и каждое незаданное опциональное поле.
  Сами методы `offsetExists`/`offsetGet`/`offsetSet`/`offsetUnset` — публичный
  API PHP-класса и портированы.
- **Значения по умолчанию у параметров в середине списка.** Для хвостовых
  работают: неаннотированный параметр не получает аргумента, подставляется
  дефолт из TypeScript. Пропуск в середине невозможен — массив Luau не хранит
  `nil`; такой случай диагностируется с номером параметра и классом.

Ограничены не самим Container, а отсутствующими компонентами: атрибуты
параметров `Auth`, `Authenticated`, `CurrentUser`, `DB`, `Database`, `Storage`
появятся вместе с Auth и Database; `RouteParameter` уже приехал с Routing.
Атрибут `Cache`
(`#[Cache('redis')]` — стор по имени) написать уже можно: кэш портирован, а
руки до него не дошли. У атрибута `Log` не портирован аргумент `name` — PHP
добирается до `Monolog::withName()` через `__call`.

### Events — `src/Illuminate/Events`

**Портирован настолько, насколько позволяет платформа.** Из 41 метода
`Dispatcher` отсутствуют семь, и все семь держатся на подсистемах, которых
нет: три про broadcasting (`shouldBroadcast`, `broadcastWhen`,
`broadcastEvent`) и четыре про транзакции БД (`setTransactionManagerResolver`,
`resolveTransactionManager`, `handlerShouldBeDispatchedAfterDatabaseTransactions`,
`createCallbackForListenerRunningAfterCommits`). Сверка — тем же диффом
списков методов, что и у Container.

Есть: `Dispatcher` (listen с wildcard, dispatch, until, push/flush, subscribe,
forget, getListeners, makeListener, `defer()`, слушатели вверх по иерархии
классов вместо интерфейсов), `NullDispatcher`, `EventServiceProvider`, контракт
`Dispatcher`.

Рядом с самим `Dispatcher` не портированы:

- очереди замыканий — `QueuedClosure`, `InvokeQueuedClosure`, `queueable()`:
  замыкание не сериализуется. Слушатели-классы с `@ShouldQueue()` работают:
  `CallQueuedListener`, `queueHandler`, `propagateListenerOptions` и
  `setQueueResolver` портированы;
- контракты транзакций `ShouldDispatchAfterCommit` и
  `ShouldHandleEventsAfterCommit` — вместе с самими транзакциями;
- обнаружение событий по файловой системе — `ShouldBeDiscovered`.

Невозможно в принципе: `listen()` с одним замыканием (событие выводится из типа
первого параметра), `Macroable` и `__call`-форвардинг в `NullDispatcher`
(вместо него `getDispatcher()`).

### Queue и Bus — `src/Illuminate/Queue`, `src/Illuminate/Bus`

**Работает целиком, включая воркер и настоящее хранилище.** Пять соединений:

| Драйвер | Что это | Аналог в Laravel |
|---|---|---|
| `sync` | исполняет в потоке вызывающего | `SyncQueue` |
| `deferred` | то же, но через `task.defer`, вне текущего кадра | `DeferredQueue` |
| `memory` | таблица в памяти сервера, воркер, ретраи, `block_for` | `DatabaseQueue` + `blpop` из `RedisQueue` |
| `memorystore` | `MemoryStoreService`, общая для всех серверов вселенной | `RedisQueue` |
| `null` | глотает | `NullQueue` |

Есть в Bus: `Dispatcher`, `Queueable`, `Batchable`, `UniqueLock`,
`BusServiceProvider`, батчи (`Batch`, `PendingBatch`, `BatchRepository`,
`ArrayBatchRepository`, `UpdatedBatchJobCounts`, четыре события),
`Foundation\Bus\{Dispatchable,PendingDispatch,PendingChain}`, фасад `Bus`,
атрибуты `Queue`, `Connection`, `Delay`.

Есть в Queue: контракты, база `Queue`, все пять драйверов и их коннекторы,
`Jobs\{Job,SyncJob,MemoryJob,MemoryStoreJob,JobName}`, `CallQueuedHandler`,
`InteractsWithQueue`, `QueueManager`, `QueueServiceProvider` (отложенный),
`Worker`/`WorkerOptions`/`WorkerStopReason`, `NullFailedJobProvider` и
`DataStoreFailedJobProvider`, пять middleware, пятнадцать событий, десять
атрибутов (`Tries`, `Timeout`, `Backoff`, `MaxExceptions`, `FailOnTimeout`,
`DeleteWhenMissingModels`, `UniqueFor`, `Queue`, `Connection`, `Delay`),
исключения `MaxAttemptsExceeded`/`TimeoutExceeded`/`InvalidPayload`, фасад
`Queue`, `config/queue.ts`. Заодно приехали `Support\Serializer`,
`Support\InteractsWithTime` и `Support\Traits\ReadsClassAttributes`.

Воркер запускается не консолью, а приложением — например из `boot()`:

```ts
task.spawn(() =>
    this.app
        .make<Worker>("queue.worker")
        .daemon("memorystore", "default", new WorkerOptions()),
);
```

Что важно знать про выбор драйвера: **`memorystore` общий на всю вселенную, и
это его цена, а не только его сила.** Джоб, положенный сервером A, может взять
воркер сервера B — и если в джобе лежал `Player`, которого на B нет, развернуть
его нечем. Для работы, привязанной к конкретному игроку, правильный драйвер —
`memory`: очередь не покидает сервер, где игрок находится, и сериализации там
нет вовсе. `memorystore` остаётся для работы, которой всё равно, какой сервер её
выполнит.

Джоб, который на этом сервере не разворачивается, умирает один раз, а не ходит
по кругу: конверт и команда сериализуются раздельно, как в PHP, поэтому
`pop()` всегда успевает создать джоб, а падает уже `CallQueuedHandler::call()`
— там, где `deleteWhenMissingModels` решает, удалить его или пометить упавшим.

Шина на месте: `Illuminate\Bus` даёт `Job.dispatch()`, `dispatchSync()`,
`dispatchIf`/`dispatchUnless`, `withChain()`, `Bus::map()` с отдельным
классом-обработчиком и цепочки, которые продолжает `CallQueuedHandler`. Джоб
пишется как `class SendWelcome extends Dispatchable` — три трейта Laravel
выстроены в одну цепочку наследования.

Упавшая джоба: `queue.failed.driver` — `null` (по умолчанию) или `datastore`.
Второй пишет в `DataStoreService` и переживает сервер; подписка на `JobFailed`
происходит при резолве `queue.worker` — там, где PHP делает это в
`WorkCommand`. Payload у `memory`/`sync` содержит живую команду, поэтому в
хранилище конверт может лечь без неё; подробности — в `laravel-parity.md`.

Чего ещё нет:

- батч на несколько серверов — счётчики `UpdateAsync` держать умеет, а
  коллбэки-замыкания через границу не поедут: их придётся задавать классами;
  `ChainedBatch` упирается в то же;
- debounce (`DebounceFor`, `DebounceLock`) — нужен debounce-лок;
  `ShouldBeUnique` и `maxExceptions` уже работают поверх Cache;
- пауза очередей и cache-сигнал рестарта воркера (`queueShouldRestart`,
  `getPausedQueues`) — флаги в кэше, ещё не подключены;
- ретрай упавшей джобы из хранилища — провайдер отдаёт запись, но собрать из
  неё джоб обратно (аналог `queue:retry`) пока некому;
- команды `queue:work`, `queue:retry`, `queue:failed` — нет консоли.

Не портируется в принципе: `CallQueuedClosure` и `QueuedClosure` (замыкание не
сериализуется ни здесь, ни в PHP без костыля) и `ShouldBeEncrypted`. Подробности
расхождений — в `laravel-parity.md`.

### Config — `src/Illuminate/Config`

Есть: `Repository` с точечной нотацией и типизированными геттерами.

Не реализовано: `float()`, `collection()`, `ArrayAccess`, `Macroable`,
кэширование конфига, `Env` и `.env`.

### Foundation — `src/Illuminate/Foundation`

Есть: `Application` (контейнер + жизненный цикл провайдеров + bootstrap),
`ProviderRepository` с отложенными провайдерами, бутстрапперы
`LoadConfiguration`, `RegisterFacades`, `RegisterProviders`, `BootProviders`,
`ApplicationBuilder`, `Http\Kernel` (+контракт `Contracts\Http\Kernel`),
`Exceptions\{Handler,ReportableHandler}` (+контракт
`Contracts\Debug\ExceptionHandler`), `Configuration\{Middleware,Exceptions}`,
события `Events\Terminating` и `Http\Events\RequestHandled`.

**Ядро** — этап 5 из `routing-design.md`. Оно держит список бутстрапперов,
глобальные middleware, алиасы, группы и приоритет, гоняет запрос через
глобальный пайплайн в роутер, ловит всё, что оттуда прилетело, и отдаёт его
обработчику исключений — `handle()` отвечает, а не бросает. `terminate()`
зовёт `terminate()` у middleware, у которых он есть, и `Application::terminate()`.
Точка входа (`main.server.ts` — это `public/index.php`) резолвит ядро, зовёт
`bootstrap()` один раз на старте и отдаёт шлюзу `handle()`, а `terminate()`
уезжает в `task.defer`: PHP терминирует после `$response->send()`, а здесь
отправка — это возврат из обработчика.

**Обработчик исключений** отчитывается в лог и рендерит ответ. Две вещи в нём не
как в PHP, и обе — стирание типов: колбэки `reportable()`/`renderable()` не
фильтруются по тайп-хинту первого параметра (их зовут на каждое исключение, и
они разбираются сами), а `map()` берёт класс-источник аргументом. Ветка HTML
(`shouldReturnJson`, `prepareResponse`, вьюхи ошибок) схлопнулась в одну: по
ремоуту едет значение. Контекст лога по умолчанию — `UserId` игрока, туда, где
PHP пишет `Auth::id()`.

Не реализовано:

- **все пути** (`basePath`, `configPath`, `storagePath`, `langPath`, …) и
  `.env`;
- `runningInConsole`, `runningUnitTests`, `runningConsoleCommand`,
  `hasDebugModeEnabled`;
- maintenance mode, `abort()`, `getNamespace()`, Laravel Cloud;
- локали: `getLocale`, `setLocale`, `getFallbackLocale`, `isLocale`;
- Console kernel, `handleCommand()`;
- кэши конфига, маршрутов, событий и `PackageManifest` (обнаружение пакетов);
- `AliasLoader` и real-time-фасады (`provideFacades`);
- `Macroable`;
- `detectEnvironment` упрощён — без `EnvironmentDetector` и ключа `--env`;
- `registerConfiguredProviders` не разделяет провайдеры Illuminate и
  приложения, манифест провайдеров считается каждый boot;
- `ApplicationBuilder`: нет `withEvents`, `withBroadcasting`, `withCommands`,
  `withSchedule`, `prefersJsonResponses`;
- бутстрапперы `LoadEnvironmentVariables`, `HandleExceptions`,
  `SetRequestForConsole`;
- у ядра — `Foundation\Http\Middleware\*` (`TrimStrings`,
  `ConvertEmptyStringsToNull`, `InvokeDeferredCallbacks`, …), поэтому список
  глобальных middleware по умолчанию пуст;
- у обработчика — троттлинг отчётов (`throttle()`, `throttleUsing()`: нужен
  `Lottery`), `dontFlash()`, `unauthenticated()` и ветка `ValidationException`,
  маркер `ShouldntReport` (интерфейс — рантайм-следа нет), `renderForConsole()`,
  файл/строка/стек в теле ответа при `app.debug` (брошенное значение их не
  несёт).

### Cache — `src/Illuminate/Cache`

Есть: `Repository`, `CacheManager`, `CacheServiceProvider`, сторы `array`,
`memorystore`, `datastore` и `null`, локи (`Lock`, `ArrayLock`,
`MemoryStoreLock`, `DataStoreLock`, `NoLock`), девять событий, контракты,
фасады `Cache` и `CacheStores`, `config/cache.ts`.

`memorystore` — порт `RedisStore` поверх `MemoryStoreHashMap`, общий на всю
вселенную, и его локи атомарны между серверами (`UpdateAsync` как
compare-and-set). `datastore` — порт `DatabaseStore` поверх
`DataStoreService`: единственное хранилище, которое переживает сервер, с
ключом до 50 символов и записью в один ключ примерно раз в шесть секунд.
Поэтому он для того, что читают часто и пишут редко, а счётчики и локи
остаются на `memorystore`. Подробности расхождений — в `laravel-parity.md`.

Кэш сразу закрыл два долга: **`ShouldBeUnique`** (маркер-декоратор +
`Bus\UniqueLock`, лок берётся в `PendingDispatch` и снимается в
`CallQueuedHandler`) и **`maxExceptions`** в воркере — счётчик исключений живёт
в кэше по uuid джоба, поэтому переживает release и другой сервер.

Поверх кэша работает ограничение частоты: `RateLimiter`,
`RateLimiting\{Limit,GlobalLimit,Unlimited}`, фасад `RateLimiter` и пять
middleware джобов — `RateLimited`, `WithoutOverlapping`, `ThrottlesExceptions`,
`Skip`, `SkipIfBatchCancelled`. Лимитер над `memorystore` считает на всю
вселенную, над `array` — на одном сервере; стор выбирается ключом
`cache.limiter`.

Чего нет: теги (`TaggedCache`, `TagSet`) — ни один здешний стор их не умеет;
`flexible()`, `funnel()`, `MemoizedStore`, `FailoverStore`; пауза очередей и
cache-сигнал рестарта воркера; debounce (`DebounceFor`, `DebounceLock`);
`FailOnException` — ждёт обработчик исключений.

### Pipeline — `src/Illuminate/Pipeline`

Портирован целиком: `Pipeline`, `Hub`, `PipelineServiceProvider`, контракты.
Пайп может быть замыканием, экземпляром, классом, строкой-ключом с параметрами
или **классом со списком аргументов рядом** — `[ThrottleRequests, "60", "1"]`.
Последняя форма появилась вместе с middleware роутинга: PHP пишет
`"Class:60,1"`, потому что класс там и есть строка, а здесь суффикс приклеить не
к чему. Список пайпов и пайп-список по типу неотличимы, поэтому в
`middleware()`/`through()` такой пайп кладут вложенным —
`middleware([[ThrottleRequests, "60", "1"]])`. Не портирован
`withinTransaction()` — он про транзакцию БД.

Две ловушки платформы, обе описаны в `roblox-ts-constraints.md`: имя `next`
занято компилятором (второй параметр middleware приходится звать иначе), а
`Util.isArray()` не отличает пустой массив от объекта, поэтому `through([])`
разбирается по наличию метатаблицы.

### Http — `src/Illuminate/Http`

Транспорт запроса — этап 1 из `routing-design.md`; решения и причины там, здесь
только состояние.

Есть: `Request` (input-API целиком, плюс `player()` — идентичность вызывающего,
которую подставляет движок, `transport()` — ремоут, на который пришёл запрос, и
резолвер маршрута), `Response` (контент, статус, заголовки, коды `HTTP_*`),
`Remote` (поиск ремоутов `Call`/`Send`/`Stream`/`Push` в
`ReplicatedStorage.Larablox`, тип конверта, лимиты шлюза), `RemoteGateway`
(серверный конец: разбор конверта, лимиты, 503 до бута; всё, что прилетело из
ядра, — 500 с записью в лог вместо утечки текста ошибки клиенту),
`Exceptions\{HttpException,NotFoundHttpException,
MethodNotAllowedHttpException,TooManyRequestsHttpException,
ThrottleRequestsException,HttpResponseException}`,
`Client\{Factory,PendingRequest,Response}` с трейтом `DeterminesStatusCode` и
исключениями `HttpClientException`/`RequestException`/`ConnectionException`,
фасад `Http`, `Foundation\Providers\FoundationServiceProvider` (регистрирует
клиента синглтоном — как в PHP, через свойство `singletons`).

Ремоуты объявлены в `default.project.json`, а не создаются в рантайме: тогда они
есть до первого скрипта и клиенту не нужно гонки ждать. **Поэтому после
обновления проектного файла `rojo serve` нужно перезапустить и нажать Connect.**

Статус исключения превращает в ответ обработчик
(`Foundation\Exceptions\Handler`), а не шлюз: 404 от роутера доезжает до клиента
404-м, потому что так решил обработчик, и с телом `{message, exception}`, когда
включён `app.debug`.

Чего нет: `ResponseFactory` и хелпера `response()`, `JsonResponse` (избыточен —
контент и так значение), `timeout()` у клиента (зависший `InvokeServer` отменить
нечем), `Http::fake()` и пулов, заголовков/кук/файлов/сессии у запроса, `user()`
(ждёт `Auth`).

Лимиты шлюза (`RemoteLimits`) стоят на глаз и ждут замера — это записанный
открытый вопрос дизайна, а не забытая константа.

### Routing — `src/Illuminate/Routing`

**Маршруты, сопоставление и диспетчеризация работают** — этапы 2 и 3 из
`routing-design.md`, проверено сквозным прогоном в Studio.

Есть: `Route`, `RouteCollection` (+`AbstractRouteCollection`), `Router`,
`RouteRegistrar` (`Route.prefix(...).group(...)`), `RouteGroup`, `RouteUri`,
`RouteAction`, `RouteParameterBinder`, `CompiledRoute`,
`Matching\{UriValidator,MethodValidator,TransportValidator}`,
`CallableDispatcher`, `ControllerDispatcher`, `ResolvesRouteDependencies`,
`Controller`, `MiddlewareNameResolver`, `SortedMiddleware`, `Pipeline`,
`Middleware\{ThrottleRequests,SubstituteBindings}`, четыре события,
`RoutingServiceProvider` (базовый провайдер, как и в Laravel), фасад `Route`,
`ApplicationBuilder::withRouting`, атрибут `Container\Attributes\RouteParameter`.

`ThrottleRequests` стоит на портированном `RateLimiter` и ключуется `UserId`
игрока: PHP берёт аутентифицированного пользователя, а без него IP, и хэширует
результат — здесь движок называет игрока на каждом вызове, и `UserId` не тайна.
Это не украшение: клиент может звать `InvokeServer` в цикле, и между этим циклом
и сервером нет ничего, кроме лимитера.

`SubstituteBindings` подставляет то, что вернул биндер `Route::bind()` — скажем,
`Player` вместо `UserId`. Неявный биндинг моделей ждёт базы; биндер, кинувший
`NotFoundHttpException`, отвечает клиенту 404, как и неявный в Laravel.

Три вещи здесь устроены не как в PHP, и все три — платформа, а не вкус:

- **сопоставление посегментное**, а не одним регулярным выражением: параметр
  занимает сегмент целиком, необязательные — только в конце, `where` проверяет
  один сегмент. Исключение — последний параметр: он забирает весь остаток пути,
  а паттерн судит остаток целиком, и на этом стоит `Route::fallback()`, как и в
  PHP;
- **порядок аргументов экшена**: сначала аннотированные (`Inject`,
  `RouteParameter`), потом параметры маршрута; замыкание получает запрос
  первым аргументом — тайп-хинтов, из которых PHP это выводит, здесь нет;
- **вторая ось — транспорт**: обычный маршрут отвечает на `call` и `send`,
  `Route::stream()` — только на unreliable-ремоуте (и отвечает POST),
  `->reliable()` сужает до `call`. Это порт `httpsOnly()` и `SchemeValidator`.

Алиасы, группы и приоритет держит ядро и синхронизирует их в роутер
(`syncMiddlewareToRouter`), как в PHP; приложение говорит своё слово через
`withMiddleware()` в `bootstrap/app.ts`. По умолчанию есть алиас `throttle`,
группа `api` (в ней `SubstituteBindings`) и приоритет
`[ThrottleRequests, SubstituteBindings]` — то же, что у PHP, за вычетом
непортированного. Порядок задаётся классами: интерфейсы рантайм-следа не
оставляют, поэтому `SortedMiddleware` ходит только по цепочке классов.

`Routing\Pipeline` — тот же пайплайн, но исключение из пайпа он отдаёт
обработчику и возвращает наружу ответ. Это видно снаружи: 404 из биндера
приезжает с заголовками `X-RateLimit-*`, потому что `ThrottleRequests` дописал
их на обратном пути, а не был пропущен вылетающим исключением.

Чего нет: неявного биндинга моделей (ждёт БД), `ResourceRegistrar`
(`Route::resource` — сахар, по уговору после ядра),
`UrlGenerator`/`Redirector`/`ViewController`, `Route::can`, `missing()`,
scoped-биндингов и `Route::controller(...)` группы (ей нужна строковая форма
экшена).

### Support — `src/Illuminate/Support`

Есть: `ServiceProvider`, `Str`, `Stringable`, `Arr`, `Collection` (ядро),
`Pluralizer`, `Reflector`, `OrderedMap`, `InteractsWithTime`, `Serializer`,
`Helpers`,
трейты `Conditionable`, `Tappable`, `ForwardsCalls`, `ReadsClassAttributes`,
`InteractsWithData` (плюс `Traits\Trait` — механизм миксинов под ними), фасады
`Facade`/`Forwards` и одиннадцать фасадов компонентов: `App`, `Config`,
`Event`, `Log`, `Context`, `Queue`, `Bus`, `Cache` (+`CacheStores`),
`RateLimiter`, `Http`, `Route`.

`InteractsWithData` — retrieval-половина запроса (`has`, `filled`, `boolean`,
`only`, `collect`, …), которую PHP делит между `Request`, `Fluent`,
`ValidatedInput` и `ComponentAttributeBag`; здесь её пока использует только
`Http\Request`. Не портированы `float` (в Luau одно число), `clamp` (ждёт
`Number`), `date`/`interval` (ждут Carbon), `enum`/`enums` (backed enum'ов нет).
Это единственный файл под `Support`, импортирующий `Helpers`, — подробности в
его шапке.

`Helpers` — 21 глобальная функция PHP: `value`, `_with`, `tap`, `transform`,
`optional`, `when`, `blank`, `filled`, `throw_if`, `throw_unless`, `retry`,
`class_basename`, `str`, `head`, `last` и всё семейство `data_*` (`data_get` с
`*`, `{first}`, `{last}` и экранированием). `retry` спит через `task.wait`
вместо `Support\Sleep` (фейкать в тестах нечего). Не портированы `e`, `env`,
`once`, `literal`, `object_get`, `preg_replace_array`, `windows_os`,
`append_config`, `class_uses_recursive`, `trait_uses_recursive`; `fluent()`
ждёт своего класса, `collect()` лежит рядом с `Collection`, у `str()` нет
формы без аргумента (в PHP это анонимный объект с `__call`).

Трейты: не портируемы `Macroable` целиком и формы без коллбэка у `when`,
`unless`, `tap` (`HigherOrderWhenProxy`, `HigherOrderTapProxy`).

`ServiceProvider` — не реализовано: `publishes`, `publishesMigrations`,
`pathsToPublish`, `commands`, `optimizes`, `reloads`, `loadViewsFrom`,
`loadTranslationsFrom`, `loadJsonTranslationsFrom`, `loadMigrationsFrom`,
`loadRoutesFrom`, `mergeConfigFrom`, `replaceConfigRecursivelyFrom`,
`defaultProviders`, `addProviderToBootstrapFile`,
`removeProviderFromBootstrapFile`.

`Facade` — не реализовано: хелперы Mockery (`spy`, `partialMock`,
`shouldReceive`, `expects`, `isFake`), `defaultAliases`, `AliasLoader`,
real-time-фасады. Фасад есть у каждого портированного компонента; под
остальные их ещё нет.

`Collection` — **~70 методов из ~190**. Нет: `toJson`/`jsonSerialize`, `dd`,
`macro`, `median`, `mode`, `duplicates`, `crossJoin`, `diff*`, `intersect*`,
`union`, `combine`, `replace*`, `nth`, `sliding`, `split`, `splitIn`,
`chunkWhile`, `splice`, `zip`, `pad`, `dot`, `undot`, `flip`, `getOrPut`,
`multiply`, `select`, `mapToDictionary`, `mapToGroups`, `mapInto`, `mapSpread`,
`eachSpread`, `reduceSpread`, `reduceWithKeys`, `pipeThrough`, `pipeInto`,
`ensure`, `percentage`, `whereBetween`, `whereNotBetween`, строгих вариантов
(`whereStrict`, `containsStrict`, …), `before`/`after`, `skipUntil`/`skipWhile`,
`takeUntil`/`takeWhile`, `sortKeysUsing`, `lazy`. Принципиально не переносимы
`HigherOrderCollectionProxy`, `Macroable`, `LazyCollection`, контракт
`Enumerable`.

`Str` — **~95 методов из ~110**. Нет: `markdown`, `inlineMarkdown`,
`transliterate`, `uuid7`, тестовых фабрик
(`createUuidsUsing`, `createUuidsUsingSequence`, `freezeUuids`,
`createRandomStringsUsing`, `createUlidsUsing`, `resetFactoryState`).
Упрощены: `convertCase` (три режима вместо констант `MB_CASE_*`), `isUrl`
(схема + хост, без списка протоколов), `limit` с `preserveWords` (без
`strip_tags`), `excerpt` (позиционные аргументы вместо массива опций),
`wordCount` и `substrCount` (без дополнительных аргументов), `studly`/`pascal`
(без `normalize`), `replace`/`remove` (без `caseSensitive`), `swap` (массив пар
вместо ассоциативного массива), `plural` (без `prependCount` — нужен `Number`),
`apa` (только английские служебные слова), `trim` (не снимает невидимые
Unicode-символы), `ascii` (сокращённая таблица), `Pluralizer` (сокращённый
набор правил вместо Doctrine), `orderedUuid`/`ulid` (приближения).

`Stringable` — **~100 методов из ~137**, объявлен в `Support/Str.ts`
(`Support/Stringable.ts` только реэкспортирует: `Str::of()` и `Stringable`
нужны друг другу, а циклический импорт значения убивает модуль). Нет:
`markdown`, `inlineMarkdown`, `transliterate`, `stripTags`, `scan`, `hash`,
`encrypt`/`decrypt`, `toDate`, `toUri`, `toHtmlString`, `dump`,
`basename`/`dirname`, `classBasename`, методов `ArrayAccess`, `__get`,
`Macroable`. Сигнатуры сокращены там же, где у `Str`. Своя логика — только у
`explode()` (все три смысла `$limit`) и `split()` (число дробит на куски,
строка идёт паттерном; флаги `preg_split` не портированы); `toInteger()`
строже PHP — `tonumber` хочет число целиком.

`Arr` — **~55 методов из ~60**. Нет: `query`, `toCssClasses`, `toCssStyles`,
`float`, `arrayable`. `pluck` без ключа (ключевой вариант — у `Collection`),
`sortRecursive` без флагов `SORT_*`, `random` без `preserveKeys`.

### Log — `src/Illuminate/Log` и `src/Monolog`

Есть: `LogManager` (драйверы `console`, `stack`, `monolog`, `null`, `custom`,
`tap`, `extend`, `action_level`, `ignore_exceptions`), `Logger`,
`LogServiceProvider`, `MessageLogged`, весь `Log\Context`, фасады `Log` и
`Context`. Под ними — слой Monolog: `Logger`, `Level`, `LogRecord`, иерархия
хендлеров, `ConsoleHandler`, `NullHandler`, `GroupHandler`,
`WhatFailureGroupHandler`, `FingersCrossedHandler`, `LineFormatter`,
`PsrLogMessageProcessor`.

Не реализовано:

- хендлеры Monolog для файлов, сокетов, почты, БД и внешних сервисов — вместе с
  драйверами `single`, `daily`, `slack`, `syslog`, `errorlog`;
- `Illuminate\Log\Formatters\JsonFormatter`, `NormalizerFormatter` и остальные
  форматтеры Monolog;
- процессоры Monolog кроме `PsrLogMessageProcessor`;
- `__call`-форвардинг на `Logger` и `LogManager`;
- `Monolog\Registry`, `ErrorHandler`, `SignalHandler`, `ResettableInterface`;
- очередные хуки `ContextServiceProvider::boot()` (dehydrate в payload задачи);
- `Repository`: `SerializesModels`, `Macroable`, `Conditionable`,
  `handleUnserializeExceptionsUsing`.

---

## Чего нет вовсе

Порядок — предлагаемый, от того, на чём стоит игровая логика, к тому, что
можно отложить.

### 1. Support-фундамент, который тянут остальные компоненты

Мелкие, но их требует почти всё остальное. Сделано:

- ~~трейты `Conditionable`, `Tappable`, `ForwardsCalls`~~ — миксинами;
  `Macroable` непереносим;
- ~~хелперы `value`, `tap`, `with`, `optional`, `data_get`, `data_set`,
  `blank`, `filled`, `throw_if`, `throw_unless`~~ — в `Support/Helpers.ts`;
- ~~контракты `Arrayable`, `Jsonable`, `JsonSerializable`, `Renderable`~~ — в
  `Contracts/Support/`, с duck-проверками вместо `instanceof`.

- ~~`Illuminate\Support\Stringable`~~ — в `Support/Str.ts`, оттуда же `Str::of()`,
  хелпер `str()` и ветка `Stringable` в `blank()`/`filled()`.

Осталось:

- `Illuminate\Support\Number` (нужен `Str::plural` с `prependCount`);
- `Illuminate\Support\Fluent`, `MessageBag`, `ViewErrorBag` — `Fluent` заодно
  даст хелпер `fluent()` и станет первым `Arrayable`, который не `Collection`
  (тогда же имеет смысл научить `Collection::getArrayableItems()` принимать
  `Arrayable` через `isArrayable`);
- работа со временем: `Date`/Carbon аналога нет, в Roblox это `os.time`,
  `os.clock`, `DateTime`. Оттуда же приедут `InteractsWithData::date()` и
  `interval()`; хелпер `retry` уже портирован — ему хватило `task.wait`.

### 2. Routing поверх ремоутов — работает, осталась отделка

Все решения — в `routing-design.md`, там же этапы и то, что осталось замерить.
Коротко: шлюз из трёх ремоутов вместо ремоута на маршрут, HTTP-глаголы плюс ось
транспорта, `Request` с `player()` вместо `ip()`/сессии, клиентская сторона —
`Illuminate\Http\Client` с фасадом `Http`, а «сервер → клиент» — не маршруты, а
`Broadcasting`.

Этапы 1–5 написаны и проверены прогоном — см. разделы `Http`, `Routing` и
`Foundation` выше. Осталось: `Route::resource` и `ResourceRegistrar` (этап 6, по
уговору после ядра), замер `RemoteLimits`, `Broadcasting` для «сервер → клиент».

`Validation` идёт следом за роутингом: проверять надо то, что пришло с клиента,
а приходит оно через маршрут.

### 3. Тестовый фреймворк — прогон в настоящей Studio

Сейчас каждая проверка одноразовая: пишутся временные леса, гоняются в Play,
удаляются (см. «Как проверять» в конце файла). Ничего не остаётся — регрессию
ловить нечем, а половина работы над новым компонентом уходит на ручной ритуал.
Тесты в репозитории закроют уже портированное и дадут писать новое от теста.

**Первым делом — поискать готовое, а не писать своё.** Раннер (обнаружение,
ассерты, отчёт) — это инструмент, а не часть порта Laravel, и в экосистеме
Roblox он, скорее всего, уже написан. Кандидаты, которые надо посмотреть:
`jest-lua` (`@rbxts/jest` — порт Jest на Luau, живой), `TestEZ` (раннер самого
Roblox, `describe`/`it`, к нему есть TestEZ Companion для запуска из Studio),
и что найдётся рядом. Критерии выбора ровно те, из-за которых тесты вообще
понадобились:

- гоняется **внутри сессии Studio**, а не во внешнем процессе;
- дружит с roblox-ts (типы, компиляция, пути);
- обнаруживает тесты обходом дерева инстансов;
- даёт хуки на каждый тест — под сброс статического состояния;
- переживает уступающий поток (`task.wait`, ожидание ответа по ремоуту);
- поддерживается и читаемо падает.

**`jest-lua` пощупан руками (2026-08-24) и отсеян.** `@rbxts/jest` +
`@rbxts/jest-globals` ставятся через npm; сама реализация лежит не в
`@rbxts`, а в соседнем `node_modules/@rbxts-js` (`@rbxts/jest` — только
реэкспорт и типы), это монтирование в `default.project.json` нужно добавлять
отдельно. `runCLI(rootInstance, argv, projects)` действительно обходит
Instance-дерево и находит `.spec`-модули сам, без `run-in-roblox` — первому
критерию удовлетворяет, конфиг можно передать инлайн через `argv.config`
(JSON-строкой), не заводя `jest.config.lua` в дереве.

Но дальше — стена: `JestRuntime.requireModule` читает `Source` найденного
`.spec`-модуля и либо зовёт `debug.loadmodule` (работает только за FFlag
`EnableLoadModule`, который нигде не включён и остаётся открытым issue в
самом jest-lua — jsdotlua/jest-lua#2, #3), либо падает на `loadstring`.
Обычный `Script` в `ServerScriptService`, запущенный обычным Play, до этого
даже не доходит: он не может прочитать чужой `Source` вовсе — `lacking
capability PluginOrOpenCloud`. С правами повыше (прогнано через
`execute_luau`, что ближе к командной строке Studio, чем к рантайм-скрипту)
до `Source` дотянуться удаётся, но `loadstring` в реальном Roblox-рантайме
отключён насовсем — `loadstring() is not available`.

Значит без принудительного локального FFlag (`ClientAppSettings.json` —
машинная настройка Studio, не файл репозитория, и её пришлось бы включать
каждому, кто запускает тесты) jest-lua не проходит собственный первый
критерий: не гоняется как обычный код внутри обычной Play-сессии. `TestEZ`
этой стены не имеет — он требует `ModuleScript` обычным `require`, без
динамической компиляции текста в рантайме, и вероятно этим и обязан
`TestEZ Companion`.

**`TestEZ` пощупан тем же способом (2026-08-24) и прошёл.** Пакет —
`@rbxts/testez` (форк `roblox-ts/testez` с типами), ставится без
дополнительных монтирований в `default.project.json`. `TestBootstrap:getModules`
обходит `root:GetDescendants()` и берёт `ModuleScript` с именем на `.spec` —
обычным `require(current)`, без чтения `Source` и без `loadstring`.
Обычный `Script` в `ServerScriptService` под обычным Play прогнал спек-файл
целиком, включая тест с `task.wait(0.2)` внутри `it()` — переживает
уступающий поток без «done»-колбэков и без Promise. `describe`/`it`/`expect`
объявлены в `globals.d.ts` пакета, но не подключаются автоматически через
`typeRoots` (в `package.json` пакета `"types": "src/index.d.ts"`, а не
`globals.d.ts`) — каждому спек-файлу нужен
`/// <reference types="@rbxts/testez/globals" />` в начале, либо это можно
вынести в один общий `.d.ts` на весь `tests/`. `beforeEach`/`afterEach`
задокументированы, но не проверялись отдельно — TestEZ upstream ими
пользуется годами, это не то, что стоит перепроверять.

TestEZ проходит все шесть критериев с самого начала (файл выбора кандидата,
выше) и остаётся действующим раннером в самом Roblox. Проверка снята,
спайк-файлы удалены; пакет `@rbxts/testez` пока установлен в
`devDependencies` — оформление `tests/` (пункты 1–7 ниже) как отдельная
работа.

Чужой раннер меняет стиль тестов (`describe`/`it`/`expect` вместо
`TestCase`/`assert*`), и с этим стоит смириться: **`PHPUnit` здесь референс для
`Illuminate\Testing`, а не для раннера**. `TestResponse` с
`assertStatus`/`assertJson`, `Foundation\Testing\TestCase` с
`createApplication()` — это части фреймворка, они портируются как всё
остальное и ложатся поверх любого раннера. Своё писать — только если ни один
кандидат не проходит по критериям; тогда это минимальный xUnit: `TestCase`,
`setUp`/`tearDown`, `assert*`, `expectException`.

Устройство — общее для любого варианта:

- каталог **`tests/`** в корне, как в Laravel (`tests/Unit`, `tests/Feature`);
- он **монтируется в `default.project.json`**, и тесты едут в место обычными
  `ModuleScript` — то есть исполняются в настоящей студии, где настоящие
  ремоуты, игроки, `DataStoreService` и `MemoryStoreService`. Ровно этого не
  даст никакой внешний процесс, и ровно это здесь нужно проверять.

Что придётся решить до первого теста. Готовый раннер снимает первые три пункта
и половину седьмого; четвёртый, пятый и шестой — наши в любом случае:

1. **Как находить тесты.** PHPUnit сканирует файлы по маске `*Test.php`.
   Файловой системы нет: раннер обходит дерево смонтированной папки и требует
   каждый `ModuleScript`, чьё имя кончается на `Test`. Имя инстанса и есть имя
   файла — маска сохраняется.
2. **Как находить методы.** PHPUnit берёт рефлексией публичные методы на
   `test*`. Рефлексии нет: методы класса — ключи таблицы, перебрать их можно, но
   порядок будет недетерминированным, а в PHPUnit он — порядок объявления.
   Значит либо декоратор `@Test()` (реестр атрибутов уже есть —
   `ReadsClassAttributes`), либо явный список на классе.
3. **Чем запускать.** Консоли нет, `phpunit --filter` заменить нечем. Либо
   точка входа, которая стартует с Play, гоняет набор и печатает отчёт в
   формате PHPUnit (точки, `F`, сводка, время), либо функция, которую дёргают
   из `execute_luau`. Фильтр — аргумент или ключ конфига, не флаг.
4. **Изоляция.** PHPUnit даёт каждому тесту свежий экземпляр, Laravel — ещё и
   свежее приложение. `require` кэширует модули, а у порта есть статическое
   состояние, которое потечёт из теста в тест: `Container.setInstance`,
   `Facade::clearResolvedInstances()`, `LoadConfiguration.using()`,
   `RegisterProviders.merge()`, кэш инстансов в `Remote`, реестры декораторов.
   Список надо составить целиком и закрыть в `TestCase::tearDown()`.
5. **Сервер и клиент — два приложения.** `Http\Client` и ремоуты осмысленны
   только на клиенте, шлюз и очередь — только на сервере. Значит две точки
   входа, вероятно два монтирования, и способ дождаться обеих сторон, прежде чем
   печатать сводку.
6. **Сборка.** `rbxtsc` компилирует `rootDir: "src"` в `out`. Тесты вне `src`
   потребуют либо отдельного конфига со своим `outDir`, либо `rootDir: "."`,
   который перетряхнёт все пути в `out`. Решать до того, как писать первый тест.
   В игровую сборку тесты попадать не должны: монтирование делается `optional`,
   как `out/shared`, и вырезается для продакшена.
7. **Ожидание.** Часть проверок ждёт: `task.wait`, воркер очереди, ответ по
   ремоуту. У PHPUnit такого нет вовсе — нужны `waitFor`-хелперы с таймаутом и
   внятным падением, иначе повисший тест повесит весь прогон.

Не в первую очередь: моки (`Mockery` держится на `__call` и не переносится,
хотя у `jest-lua` они свои и работают), покрытие, snapshot-тесты, `@depends`.

Зависимость добавляется только с ведома — это решение, а не деталь реализации:
раннер попадёт в каждый тест, который будет написан после.

Что это закрывает: `Container`, `Collection`, `Str`, `Arr`, `Pipeline`,
`Routing` проверялись прогонами, которые тут же удалялись. Тесты сделают эти
проверки постоянными и снимут с «Как проверять» половину ручной работы —
останется `lint`, `analyze` и запуск набора.

### 4. Validation

`Illuminate\Validation` — большой, но самодостаточный компонент. Нужен для
проверки данных, приходящих с клиента, то есть сразу после роутинга.

### 5. «База данных»

Первый слой поверх `DataStoreService` уже есть: стор кэша `datastore`
(`DatabaseStore`), его лок и `DataStoreFailedJobProvider` для упавших джобов —
то есть хранилище, которое переживает сервер, из фреймворка уже доступно.

Осталось то, что PHP называет `Illuminate\Database`. Eloquent целиком
нереалистичен: `DataStoreService` — это ключ-значение, без запросов, join-ов и
сортировок; `ListKeysAsync` перебирает ключи и стоит `5 + игроки × 2` вызова в
минуту. Разумно либо взять `Illuminate\Database\Capsule`-подобный слой доступа,
либо свой репозиторий поверх DataStore — и решать это отдельной задачей.
Оттуда же приедет durable-вариант батч-репозитория.

### 6. Auth

`Illuminate\Auth` вокруг `Player` вместо сессий и guard-ов на куках.

### 7. Concurrency поверх акторов

`Illuminate\Concurrency` (`Driver`, `SyncDriver`, плюс свой `ActorDriver`) —
это, а не очередь, честное место для Parallel Luau. Замерено в Studio: каждый
актор получает **свой** экземпляр каждого `ModuleScript` (три разных `require`
одного модуля дали три разных состояния), замыкание через границу приезжает
неработающим (`Attempt to load a function from a different Lua VM`), у таблицы
срезается метатаблица, а смешанная таблица теряет строковые ключи; по ссылке
проходят только `Instance` и `SharedTable` (`Instance` внутрь `SharedTable`
класть нельзя).

Значит, контейнер и объектный граф фреймворка через актор не передать, а задача
задаётся именем зарегистрированного модуля плюс плоскими данными — ровно как
`ProcessDriver`/`ForkDriver` в Laravel гоняют сериализованное замыкание в чужой
процесс. Пригодится для чистого счёта: генерация карт, pathfinding, тяжёлые
переборы.

### 8. Отложить надолго

`Console`/`Artisan` (нет консоли), `Mail`, `Notifications`, `Broadcasting`,
`Filesystem`, `Session`, `View`/`Blade`, `Testing`.

---

## Как проверять

Компилятор проверяет только типы TypeScript. Обязательный минимум перед тем,
как считать компонент готовым:

```bash
npm run lint
npm run analyze
```

`analyze` — единственное, что читает сгенерированный Luau как код; `rbxtsc`
умеет выдать невалидный Luau и отрапортовать об успехе.

Рантайм-проверки идут через Studio. Схема, которой пользовался всю дорогу —
и которую должен заменить тестовый фреймворк из пункта 3, потому что она
одноразовая по построению:

1. Написать `src/shared/__smoke.ts`, экспортирующий `runSmoke(): string` —
   строки вида `ok  имя` / `FAIL имя`.
2. `npm run build` (или watch), Rojo синхронизирует — **в Edit-датамодель**.
3. Перезапустить Play: он снимает копию дерева на старте, поэтому запущенная
   сессия свежую сборку не видит.
4. Выполнить в Studio скрипт, который **подменяет дерево клонами** — иначе
   `require` вернёт закэшированные модули (Rojo правит `Source` на месте):
   переименовать `Illuminate`, `Monolog`, `TS` в `__X_orig`, склонировать под
   исходными именами, выполнить, уничтожить клоны, вернуть имена. Восстановление
   обязательно делать через `pcall`, иначе ошибка оставит дерево переименованным.
5. Удалить `__smoke.ts` после проверки — в репозитории тестов нет.

Что проверяется только сквозным прогоном (смоук до этого не добирается) —
воркер, падение джобы, запись в хранилище: тогда джоб и провайдер пишутся
временно, приложение поднимается обычным Play, а результат читается из
`DataStoreService`/`MemoryStoreService` отдельным скриптом. Тестовые леса после
этого удаляются, а тестовые ключи — вычищаются.

Если менялся `default.project.json`, `rojo serve` надо перезапустить, и после
этого нажать Connect в плагине. `npm run clean` удаляет `include/`, на который
проект ссылается, и роняет запущенный `rojo serve` — сначала сборка, потом
`rojo serve`.
