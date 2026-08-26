# Соответствие Laravel 13.x

Исходники сверялись с `laravel/framework` 13.12 в
`\\wsl.localhost\Ubuntu-24.04\home\m0nclous\PhpstormProjects\laravel-base\vendor`.
Документация — `C:\Users\m0nclous\laravel-docs` (ветка `13.x`).

Пространства имён отображаются один в один:
`Illuminate\Container\Container` → `src/Illuminate/Container/Container.ts`.

## Портировано

| Laravel | Файл | Примечание |
|---|---|---|
| `Illuminate\Container\Container` | `Container/Container.ts` | полностью; нет только невозможных `__get`/`__set`/`bindBasedOnClosureReturnTypes` |
| `Illuminate\Container\BoundMethod` | `Container/BoundMethod.ts` | зависимости из `Inject` вместо рефлексии |
| `Illuminate\Container\ContextualBindingBuilder` | `Container/ContextualBindingBuilder.ts` | |
| `Illuminate\Container\Util` | `Container/Util.ts` | без рефлексивных методов |
| `Illuminate\Container\RewindableGenerator` | `Container/RewindableGenerator.ts` | ленивый; `toArray()` вместо `iterator_to_array` |
| `Illuminate\Container\EntryNotFoundException` | `Container/EntryNotFoundException.ts` | |
| SPL-исключения PHP (`LogicException`, `InvalidArgumentException`, `RuntimeException`, `TypeError`) | `Illuminate/Exception.ts` | глобального `Error` в Luau нет; здесь же `ItemNotFoundException` и `MultipleItemsFoundException` |
| `Illuminate\Contracts\Foundation\Application` | `Contracts/Foundation/Application.ts` | |
| `Illuminate\Contracts\Support\DeferrableProvider` | `Contracts/Support/DeferrableProvider.ts` | интерфейс стёрт: важен собственный `provides()` |
| `Illuminate\Container\Attributes\{Singleton,Scoped,Bind}` | `Container/Attributes/*.ts` | декораторы + реестр |
| `Illuminate\Container\Attributes\{Give,Config,Tag,Log,Context}` | `Container/Attributes/*.ts` | контекстные атрибуты параметров |
| `Illuminate\Contracts\Container\ContextualAttribute` | `Contracts/Container/ContextualAttribute.ts` | хуки на экземпляре вместо статики |
| `Illuminate\Contracts\Container\*` | `Contracts/Container/*.ts` | |
| `Illuminate\Events\Dispatcher` | `Events/Dispatcher.ts` | с очередными слушателями; без broadcast и транзакций |
| `Illuminate\Events\NullDispatcher` | `Events/NullDispatcher.ts` | вместо `__call` — `getDispatcher()` |
| `Illuminate\Events\EventServiceProvider` | `Events/EventServiceProvider.ts` | |
| `Illuminate\Pipeline\{Pipeline,Hub,PipelineServiceProvider}` | `Pipeline/*.ts` | без `withinTransaction` |
| `Illuminate\Contracts\Pipeline\{Pipeline,Hub}` | `Contracts/Pipeline/*.ts` | |
| `Illuminate\Events\CallQueuedListener` | `Events/CallQueuedListener.ts` | без уникальности |
| `Illuminate\Bus\Dispatcher` | `Bus/Dispatcher.ts` | с батчами; без `dispatchAfterResponse` |
| `Illuminate\Bus\Queueable` | `Bus/Queueable.ts` | трейт → класс; `$delay` → `delaySeconds` |
| `Illuminate\Bus\BusServiceProvider` | `Bus/BusServiceProvider.ts` | `bus.batches` — всегда `ArrayBatchRepository` |
| `Illuminate\Foundation\Bus\Dispatchable` | `Foundation/Bus/Dispatchable.ts` | трейт → базовый класс со статикой |
| `Illuminate\Foundation\Bus\{PendingDispatch,PendingChain}` | `Foundation/Bus/*.ts` | `task.defer` вместо `__destruct` |
| `Illuminate\Contracts\Bus\{Dispatcher,QueueingDispatcher}` | `Contracts/Bus/Dispatcher.ts` | |
| `Illuminate\Queue\Attributes\{Queue,Connection,Delay}` | `Queue/Attributes/*.ts` | |
| `Illuminate\Queue\Queue` | `Queue/Queue.ts` | payload — таблица, строкой становится в хранилище |
| `Illuminate\Queue\{SyncQueue,NullQueue}` | `Queue/*.ts` | без ветки `db.transactions` |
| `Illuminate\Queue\DeferredQueue` | `Queue/DeferredQueue.ts` | `task.defer` вместо `Support\defer()` |
| `Illuminate\Queue\DatabaseQueue` | `Queue/MemoryQueue.ts` | та же механика, таблица в памяти |
| `Illuminate\Queue\RedisQueue` | `Queue/MemoryStoreQueue.ts` | `MemoryStoreService`: очередь + отложенные в sorted map |
| `Illuminate\Queue\Jobs\{DatabaseJob,RedisJob}` | `Queue/Jobs/{MemoryJob,MemoryStoreJob}.ts` | |
| `Illuminate\Queue\Worker` | `Queue/Worker.ts` | корутина вместо процесса; без сигналов |
| `Illuminate\Queue\{WorkerOptions,WorkerStopReason}` | `Queue/*.ts` | `memory` и `timeout` по умолчанию выключены |
| `Illuminate\Queue\{MaxAttemptsExceededException,TimeoutExceededException,InvalidPayloadException}` | `Queue/*.ts` | |
| `Illuminate\Queue\QueueManager` | `Queue/QueueManager.ts` | вместо `__call` — явные делегаты |
| `Illuminate\Queue\QueueServiceProvider` | `Queue/QueueServiceProvider.ts` | воркер и фейлер есть; без `queue:listen` и routes |
| `Illuminate\Queue\CallQueuedHandler` | `Queue/CallQueuedHandler.ts` | middleware, цепочки, уникальность и батчи работают |
| `Illuminate\Queue\InteractsWithQueue` | `Queue/InteractsWithQueue.ts` | трейт стал базовым классом |
| `Illuminate\Queue\Jobs\{Job,SyncJob,JobName}` | `Queue/Jobs/*.ts` | |
| `Illuminate\Queue\Connectors\*` | `Queue/Connectors/*.ts` | sync, null, deferred, memory, memorystore |
| `Illuminate\Queue\Attributes\DeleteWhenMissingModels` | `Queue/Attributes/*.ts` | «модель» — это `Instance` |
| `Illuminate\Queue\Failed\{FailedJobProviderInterface,NullFailedJobProvider}` | `Queue/Failed/*.ts` | остальные пишут в БД или файл |
| `Illuminate\Queue\Failed\DatabaseFailedJobProvider` | `Queue/Failed/DataStoreFailedJobProvider.ts` | `DataStoreService`; порядок по `failed_at`, ничью решает `id` |
| `Illuminate\Queue\Events\*` | `Queue/Events/*.ts` | пятнадцать событий: очередь, джоб, воркер |
| `Illuminate\Queue\Attributes\{Tries,Timeout,Backoff,MaxExceptions,FailOnTimeout}` | `Queue/Attributes/*.ts` | декораторы + реестр |
| `Illuminate\Contracts\Queue\{Queue,Job,Factory,Monitor,ShouldQueue}` | `Contracts/Queue/*.ts` | `ShouldQueue` — декоратор-маркер |
| `Illuminate\Support\InteractsWithTime` | `Support/InteractsWithTime.ts` | трейт → статический класс; без Carbon |
| `serialize()` / `unserialize()` (сам PHP) | `Support/Serializer.ts` | реестр классов вместо автолоадера |
| `Illuminate\Queue\SerializesModels` | внутри `Support/Serializer.ts` | `Instance` едет идентификатором, как модель |
| `Illuminate\Support\Traits\ReadsClassAttributes` | `Support/Traits/ReadsClassAttributes.ts` | читает реестр декораторов |
| `Illuminate\Cache\Repository` | `Cache/Repository.ts` | без тегов, `flexible`, `funnel` и PSR-16 |
| `Illuminate\Cache\{ArrayStore,ArrayLock}` | `Cache/*.ts` | без `serializesValues` |
| `Illuminate\Cache\RedisStore` | `Cache/MemoryStoreStore.ts` | `MemoryStoreHashMap`; общий на вселенную |
| `Illuminate\Cache\RedisLock` | `Cache/MemoryStoreLock.ts` | `UpdateAsync` как compare-and-set |
| `Illuminate\Cache\DatabaseStore` | `Cache/DataStoreStore.ts` | `DataStoreService`; срок жизни лежит рядом со значением |
| `Illuminate\Cache\DatabaseLock` | `Cache/DataStoreLock.ts` | `UpdateAsync` как compare-and-set |
| `Illuminate\Cache\{Lock,NoLock,NullStore}` | `Cache/*.ts` | |
| `Illuminate\Cache\{CacheManager,CacheServiceProvider}` | `Cache/*.ts` | драйверы array, memorystore, datastore, null |
| `Illuminate\Cache\Events\*` | `Cache/Events/*.ts` | девять событий |
| `Illuminate\Contracts\Cache\*` | `Contracts/Cache/*.ts` | |
| `Illuminate\Cache\RateLimiter` | `Cache/RateLimiter.ts` | ключ не чистится от HTML-сущностей |
| `Illuminate\Cache\RateLimiting\{Limit,GlobalLimit,Unlimited}` | `Cache/RateLimiting/*.ts` | без `response()` |
| `Illuminate\Queue\Middleware\{RateLimited,WithoutOverlapping,Skip,ThrottlesExceptions,SkipIfBatchCancelled}` | `Queue/Middleware/*.ts` | ключи не хэшируются |
| `Illuminate\Bus\{Batch,PendingBatch,BatchRepository,UpdatedBatchJobCounts}` | `Bus/*.ts` | без `toArray`/`jsonSerialize` |
| `Illuminate\Bus\DatabaseBatchRepository` | `Bus/ArrayBatchRepository.ts` | те же счётчики, таблица в памяти |
| `Illuminate\Bus\Batchable` | `Bus/Batchable.ts` | трейт → звено цепочки наследования |
| `Illuminate\Bus\Events\{BatchDispatched,BatchStarted,BatchFinished,BatchCanceled}` | `Bus/Events/*.ts` | |
| `Illuminate\Bus\UniqueLock` | `Bus/UniqueLock.ts` | без `uniqueVia`; имя не хэшируется |
| `Illuminate\Contracts\Queue\ShouldBeUnique` | `Contracts/Queue/ShouldBeUnique.ts` | декоратор-маркер |
| `Illuminate\Queue\Attributes\UniqueFor` | `Queue/Attributes/UniqueFor.ts` | |
| `Illuminate\Config\Repository` | `Config/Repository.ts` | |
| `Illuminate\Log\{LogManager,Logger,LogServiceProvider}` | `Log/*.ts` | |
| `Illuminate\Log\Events\MessageLogged` | `Log/Events/MessageLogged.ts` | |
| `Illuminate\Log\Context\*` | `Log/Context/*.ts` | без очередей |
| `Illuminate\Contracts\Log\ContextLogProcessor` | `Contracts/Log/ContextLogProcessor.ts` | абстрактный класс: нужен как ключ биндинга |
| `Psr\Log\{LoggerInterface,NullLogger}` | `Contracts/Log/Logger.ts`, `Log/NullLogger.ts` | PSR отсутствует |
| `Illuminate\Support\ServiceProvider` | `Support/ServiceProvider.ts` | без publish/commands |
| `Illuminate\Support\Str` | `Support/Str.ts` | ~95 методов из ~110 |
| `Illuminate\Support\Stringable` | `Support/Str.ts`, реэкспорт в `Support/Stringable.ts` | ~100 методов из ~137; класс лежит в `Str.ts` — иначе циклический импорт |
| `Illuminate\Support\Arr` | `Support/Arr.ts` | ~55 методов из ~60 |
| `Illuminate\Support\Pluralizer` | `Support/Pluralizer.ts` | свой английский инфлектор вместо Doctrine |
| `Illuminate\Support\Collection` | `Support/Collection.ts` | ядро, ~70 методов из ~190 |
| глобальные хелперы (`Support/helpers.php`, `Collections/helpers.php`) | `Support/Helpers.ts` | 20 функций; имена PHP сохранены, `with` → `_with` |
| `Illuminate\Support\Traits\{Conditionable,Tappable,ForwardsCalls}` | `Support/Traits/*.ts` | трейт → миксин; механизм в `Support/Traits/Trait.ts` |
| `Illuminate\Contracts\Support\{Arrayable,Jsonable,Renderable}` и PHP-шный `JsonSerializable` | `Contracts/Support/*.ts` | интерфейсы стёрты: рядом с каждым лежит duck-проверка (`isArrayable` и т.д.) |
| SPL `BadFunctionCallException`, `BadMethodCallException` | `Illuminate/Exception.ts` | |
| `Illuminate\Foundation\Application` | `Foundation/Application.ts` | без путей, HTTP и консоли |
| `Illuminate\Foundation\ProviderRepository` | `Foundation/ProviderRepository.ts` | манифест считается каждый boot |
| `Illuminate\Foundation\Bootstrap\{LoadConfiguration,RegisterFacades,RegisterProviders,BootProviders}` | `Foundation/Bootstrap/*.ts` | |
| `Illuminate\Foundation\Configuration\ApplicationBuilder` | `Foundation/Configuration/ApplicationBuilder.ts` | только портируемые `with*` |
| `Illuminate\Foundation\Http\Kernel` | `Foundation/Http/Kernel.ts` | `bootstrap()` на старте, `terminate()` через `task.defer` |
| `Illuminate\Contracts\Http\Kernel` | `Contracts/Http/Kernel.ts` | ключ контейнера — сам класс ядра: интерфейс им быть не может |
| `Illuminate\Foundation\Exceptions\{Handler,ReportableHandler}` | `Foundation/Exceptions/*.ts` | без троттлинга отчётов; `handles()` нечем реализовать |
| `Illuminate\Contracts\Debug\ExceptionHandler` | `Contracts/Debug/ExceptionHandler.ts` | без `renderForConsole()` |
| `Illuminate\Foundation\Configuration\{Middleware,Exceptions}` | `Foundation/Configuration/*.ts` | объекты для `withMiddleware()` / `withExceptions()` |
| `Illuminate\Foundation\Http\Events\RequestHandled`, `Illuminate\Foundation\Events\Terminating` | `Foundation/Http/Events/*.ts`, `Foundation/Events/*.ts` | |
| `Illuminate\Foundation\Providers\FoundationServiceProvider` | `Foundation/Providers/FoundationServiceProvider.ts` | из всего провайдера — только клиент `Http` |
| `Illuminate\Http\Request` | `Http/Request.ts` | input-API целиком; `player()` и `transport()` вместо `ip()`/схемы |
| `Illuminate\Http\Response` | `Http/Response.ts` | контент — значение, а не строка; `JsonResponse` не нужен |
| — (веб-сервер, у PHP его нет) | `Http/{Remote,RemoteGateway}.ts` | четыре ремоута, конверт `(method, path, data)`, лимиты, 503 до бута |
| `Symfony\...\Exception\{HttpException,NotFoundHttpException,MethodNotAllowedHttpException,TooManyRequestsHttpException}` | `Http/Exceptions/HttpException.ts` | Symfony не портируется, а статус нужен здесь |
| `Illuminate\Http\Exceptions\{HttpResponseException,ThrottleRequestsException}` | `Http/Exceptions/*.ts` | |
| `Illuminate\Http\Client\{Factory,PendingRequest,Response}` | `Http/Client/*.ts` | без `fake`, пулов и `timeout()`; `withoutWaiting()`/`unreliable()` выбирают ремоут |
| `Illuminate\Http\Client\Concerns\DeterminesStatusCode` | `Http/Client/Concerns/DeterminesStatusCode.ts` | трейт → миксин |
| `Illuminate\Http\Client\{RequestException,ConnectionException,HttpClientException}` | `Http/Client/*.ts` | без усечения тела |
| `Illuminate\Routing\Route` | `Routing/Route.ts` | |
| `Illuminate\Routing\{RouteCollection,AbstractRouteCollection}` | `Routing/*.ts` | без `CompiledRouteCollection` и `RouteCollectionInterface` |
| `Illuminate\Routing\Router` | `Routing/Router.ts` | без `resource`/`redirect`/`view` |
| `Illuminate\Routing\{RouteRegistrar,RouteGroup,RouteUri,RouteAction,RouteParameterBinder}` | `Routing/*.ts` | |
| `Symfony\Component\Routing\CompiledRoute` | `Routing/CompiledRoute.ts` | посегментный разбор вместо одной регулярки |
| `Illuminate\Routing\Matching\{ValidatorInterface,UriValidator,MethodValidator,SchemeValidator}` | `Routing/Matching/*.ts` | `TransportValidator` на месте схемы; `HostValidator` — хостов нет |
| `Illuminate\Routing\{CallableDispatcher,ControllerDispatcher,ResolvesRouteDependencies,Controller}` | `Routing/*.ts` | + контракты в `Routing/Contracts/*.ts` |
| `Illuminate\Routing\{MiddlewareNameResolver,SortedMiddleware,Pipeline}` | `Routing/*.ts` | приоритет — по классам, не по строкам |
| `Illuminate\Routing\Middleware\{ThrottleRequests,SubstituteBindings}` | `Routing/Middleware/*.ts` | ключ лимитера — `UserId`; неявный биндинг ждёт моделей |
| `Illuminate\Routing\Events\{Routing,RouteMatched,PreparingResponse,ResponsePrepared}` | `Routing/Events/*.ts` | |
| `Illuminate\Routing\RoutingServiceProvider` | `Routing/RoutingServiceProvider.ts` | без URL-генератора, редиректора и PSR-моста |
| `Illuminate\Container\Attributes\RouteParameter` | `Container/Attributes/RouteParameter.ts` | |
| `Illuminate\Contracts\Support\Responsable` | `Contracts/Support/Responsable.ts` | рядом duck-проверка `isResponsable` |
| `Illuminate\Support\Traits\InteractsWithData` | `Support/Traits/InteractsWithData.ts` | без `float`, `clamp`, `date`, `interval`, `enum` |
| `Illuminate\Support\Facades\Facade` | `Support/Facades/Facade.ts` | `__callStatic` заменён метатаблицей |
| `Illuminate\Support\Facades\{App,Config,Event,Log,Context,Queue,Bus,Cache,RateLimiter,Route,Http}` | `Support/Facades/*.ts` | `CacheStores` — вторая половина `Cache`: менеджер и его сторы |

## Monolog

Лежит в `src/Monolog/` — отдельный неймспейс, как и в vendor. Портировано:

| Monolog | Файл |
|---|---|
| `Monolog\Logger` | `Logger.ts` |
| `Monolog\Level` | `Level.ts` (+ `Levels` для статики) |
| `Monolog\LogRecord` | `LogRecord.ts` |
| `Monolog\Handler\{HandlerInterface,Handler,AbstractHandler,AbstractProcessingHandler}` | `Handler/*.ts` |
| `Monolog\Handler\{NullHandler,GroupHandler,WhatFailureGroupHandler,FingersCrossedHandler}` | `Handler/*.ts` |
| `Monolog\Formatter\{FormatterInterface,LineFormatter}` | `Formatter/*.ts` |
| `Monolog\Processor\{ProcessorInterface,PsrLogMessageProcessor}` | `Processor/*.ts` |

`ConsoleHandler` — единственное добавление: пишет в вывод Roblox и занимает
место `StreamHandler`/`ErrorLogHandler`. Хендлеры для файлов, сокетов, почты,
БД и внешних сервисов не переносятся.

Расхождения внутри Monolog: `datetime` в записи — Unix-время, а не
`DateTimeImmutable`; таймзоны и микросекунды отсутствуют; детекция циклов
логирования построена на Fiber и не портируется; `ArrayAccess` у `LogRecord`,
`__destruct` и сериализация у `Handler` — тоже. `Level` — enum TypeScript, у
которого не бывает статических методов, поэтому `Level::fromName()` и
`getName()` живут на классе `Levels` рядом.

## Вынужденные расхождения

Всё, что нельзя выразить на платформе, и как это заменено.

### Идентификаторы биндингов

В PHP `$abstract` всегда строка (`'config'` или `Foo::class`). В Luau нет
class-string, поэтому идентификатором служит либо строка, либо **сам класс**:

```ts
app.bind("config", ...);
app.singleton(Dispatcher);
app.make(Dispatcher); // типизировано как Dispatcher
```

Тип — `Abstract = string | AbstractClass` (`Container/Types.ts`).

### Автоворинг: `Inject` вместо type hint

Сигнатуры конструкторов и методов не переживают компиляцию, `ReflectionParameter`
неоткуда взять. Зависимость объявляется декоратором параметра:

```ts
constructor(
    @Inject("app") app: Application,
    @Inject(Dispatcher) events: Dispatcher,
) {}
```

Из этого следует:

- variadic объявляется декоратором `@Variadic(abstract)`: сигнатура о нём
  ничего не говорит, а `ReflectionParameter::isVariadic()` неоткуда взять;
- значение по умолчанию работает у хвостового параметра — без аннотации он не
  получает аргумента, и дефолт подставляет сам скомпилированный конструктор;
  пропуск в середине невозможен и диагностируется явно;
- контекстный примитив объявляется как `@Inject("$name")` и разрешается через
  `when(X).needs("$name").give(...)`, как в PHP;
- подкласс без своего `@Inject` наследует зависимости родительского конструктора
  (свой конструктор от унаследованного в рантайме неотличим); чтобы их изменить,
  нужно проаннотировать свой конструктор;
- переопределённый **метод** без `@Inject` вызывается без аргументов — как и
  говорит его собственная сигнатура.

### Фасады: `__callStatic` через метатаблицу

В PHP фасад — это `__callStatic`, перенаправляющий вызов на разрешённый из
контейнера объект, а список методов существует только в докблоках
`@method static`. В Luau нет `__callStatic`, но таблица класса — обычная
таблица: декоратор `Forwards` подменяет `__index` в её метатаблице функцией,
которая перехватывает ровно те обращения, что PHP отдал бы в `__callStatic`.

Список методов объявляется через `public static declare`, который не эмитит
кода — прямой аналог докблоков:

```ts
@Forwards()
export class Config extends Facade {
    public static declare get: Forwarded<Repository["get"]>;

    protected static getFacadeAccessor(): Abstract {
        return "config";
    }
}
```

Обёртка `Forwarded<T>` обязательна: объявление вида `Repository["get"]`
сохраняет за типом природу метода, и roblox-ts компилирует вызов с двоеточием,
подсовывая форвардеру сам класс фасада первым аргументом.

### Трейты: миксины, а не цепочка наследования

Трейт — функция, принимающая базовый класс и возвращающая его расширенным, а
`use Conditionable, Tappable;` — `extends Tappable(Conditionable())`. Механика и
её цена (анонимные промежуточные классы, бессмысленный `instanceof` по трейту,
`Constructor` на `any`) описаны в `roblox-ts-constraints.md`.

Это отменяет прежний приём из Bus, где три трейта выстроены в жёсткую цепочку
`Dispatchable → Queueable → InteractsWithQueue`: миксины складываются в любом
порядке и в любой комбинации. Уже написанное на цепочке работает и не трогалось,
но новые трейты пишутся миксинами.

Из портированных трейтов выпали формы, которым нужен `__get` / `__call`:
`when()` и `unless()` без коллбэка (`HigherOrderWhenProxy`, захватывающий
условие и применяющий к нему следующий вызов) и `tap()` без коллбэка
(`HigherOrderTapProxy`). Коллбэк везде обязателен. `Macroable` непереносим
целиком.

`ForwardsCalls::forwardCallTo()` в PHP вызывает метод и разбирает сообщение
движка, чтобы отличить «метода нет» от ошибки внутри вызова. Индексация таблицы
ничего не бросает, поэтому проверка идёт до вызова, а разбор сообщения не нужен.
`throwBadMethodCallException()` — свободная функция, а не `protected static`:
`static::class` внутри миксина указывал бы на анонимный класс.

### Хелперы: модуль вместо глобального пространства

`Support/Helpers.ts` — это `Illuminate/Support/helpers.php` плюс `data_*` из
`Illuminate/Collections/helpers.php`. Глобальных функций нет, поэтому это
обычные экспорты модуля; имена PHP сохранены как есть, вместе со `snake_case` —
это функции, а не методы, и в исходниках они зовутся именно так.

| PHP | Порт | |
|---|---|---|
| `with()` | `_with()` | `with` зарезервировано в TypeScript; подчёркивание — та же конвенция, что у `_next` |
| `head()`, `last()` | отвечают `undefined` | PHP отдаёт `false` на пустом массиве; `T \| false` отравил бы каждый вызов, а `Arr::first()` и так отвечает `undefined` |
| `optional($v)`, `tap($v)` без коллбэка | нет | `Optional` и `HigherOrderTapProxy` живут на `__get`/`__call` |
| `throw_if($c, 'RuntimeException')` | класс вместо строки-имени | class-string нет; строка всегда считается сообщением |
| `data_get($t, '*.x')` | промахи выбрасываются | PHP собирает в результат и `null`; дыра обрубила бы массив Luau |
| `data_set(&$t, ...)` | цель обязана быть таблицей | передачи по ссылке нет, скаляр подменить нечем — вместо тихой подмены бросается `InvalidArgumentException` |
| `data_forget($list, '1')` | список переиндексируется | `unset($list[1])` оставляет дыру, а в массиве Luau дыр не бывает |
| числовой сегмент (`items.0.name`) | пробуется числом только там, где числовой ключ может лежать | в списке, `Collection` или `OrderedMap` — да; в обычной таблице ключи пришли из объектного литерала и остаются строками |

`blank()` не умеет ветку `Stringable`: roblox-ts кладёт `toString()` в
метаметод `__tostring`, который есть у каждого скомпилированного класса, — по
нему ничего не отличить. Ветка `Countable` работает через `Collection` и
`OrderedMap`, а объект, как и в PHP, не бывает пустым (отличается от таблицы
через `Reflector.isInstance`).

PHP-истинность (`if ($value)`: `0`, `""`, `"0"` — ложь) вынесена в
`Util.truthy`; `Collection.truthy` делегирует туда же. Пустой массив в PHP
ложен, а здесь неотличим от объекта и считается истиной — тот же компромисс,
что и у `Util.isArray`.

Модуль стоит на вершине графа импортов Support и импортирует классы, которые
обслуживает, — значит, ничто внутри `Illuminate/Support` не смеет импортировать
его обратно. Поэтому `Tappable` не зовёт `tap()`, а повторяет две его строки.

### Collection: ключи и объём

`Collection<TKey, TValue>` держит элементы в `OrderedMap`, а не в массиве:
PHP-массив — упорядоченная карта, и `keyBy`, `groupBy`, `mapWithKeys`, `pluck`
возвращают коллекции со строковыми ключами. Значение обязано быть `defined` —
массив Luau не хранит `nil`.

`all()` отдаёт значения по порядку, а не сам массив ключ => значение: массив
Luau не умеет носить строковые ключи. Пары доступны через `entries()`.
Конструирование из объектного литерала (`collect({a: 1})`) допустимо ради
паритета с `['a' => 1]`, но порядок ключей не сохраняется — `pairs` его не
определяет.

Портировано ядро (~70 методов). Не портируемо в принципе:
`HigherOrderCollectionProxy` (`$c->map->name` требует `__get`), `Macroable`,
`dd` (нечего прерывать — нет ни ответа, ни процесса), `LazyCollection`.
Остальные методы PHP-класса просто ещё не написаны.

`dump()` есть и повторяет PHP (`dump($this->all(), ...$args)`): сначала
элементы, потом каждый лишний аргумент. Идёт он через `Support/VarDumper` —
обрезанный порт symfony'евского: ни клонера, ни кастеров, значение уходит в
`print`. Портирован там ровно шов `setHandler()`, потому что без него дамп
можно только исполнить ради побочного эффекта — а тест на него (upstream'овский
`testDump` делает именно так) подменяет обработчик, читает надампленное и
возвращает умолчание на место.

Тип, описывающий «из чего строится коллекция» (`Arrayable|iterable|null` в
докблоке PHP), зовётся `ArrayableItems` — по методу `getArrayableItems()`,
который его потребляет. Раньше он звался `Arrayable`, но это имя занял
настоящий контракт `Contracts\Support\Arrayable`, и путать их нельзя: первый —
вход конструктора, второй — интерфейс с `toArray()`.

### Str: паттерны вместо регулярок

Методы, которым паттерн передаёт вызывающий — `match`, `isMatch`, `matchAll`,
`replaceMatches` — принимают **паттерн Luau**, а не PCRE. Ограничения синтаксиса
описаны в roblox-ts-constraints.md.

`lower()`/`upper()` и всё, что на них построено (`title`, `camel`, `snake`,
`headline`, …), сворачивают только ASCII. `length()`, `substr()`, `charAt()`,
`reverse()` работают по кодпоинтам через `utf8`.

`ascii()` несёт сокращённую таблицу транслитерации (Latin-1 и кириллица) вместо
таблиц voku/portable-ascii; всё остальное `slug()` выбрасывает, а не
транслитерирует. `plural()`/`singular()` идут через собственный
`Pluralizer` — компактный набор правил вместо Doctrine Inflector.

`uuid()` берёт `HttpService:GenerateGUID`, `orderedUuid()` заменяет старшие
байты миллисекундной меткой (сортируется так же, но это не COMB-кодек),
`ulid()` собирается вручную в Crockford base32. `toBase64`/`fromBase64`
реализованы через `bit32`.

Не портировано: `markdown`, `inlineMarkdown` (нет CommonMark), `transliterate`
(нет intl), фабрики для тестов (`createUuidsUsing`, `freezeUuids`,
`createRandomStringsUsing` и подобные).

### Stringable: один модуль на два класса

`Str::of()` создаёт `Stringable`, а каждый метод `Stringable` зовёт `Str`
обратно. В PHP круг замыкает автолоадер, в Luau замкнуть его нечем:
циклический импорт **значения** убивает модуль целиком. Поэтому оба класса
объявлены в `Support/Str.ts`, а `Support/Stringable.ts` только реэкспортирует
класс — чтобы путь импорта совпадал с PHP-шным `Illuminate\Support\Stringable`.

Порт делегирует в `Str` и наследует его ограничения: паттерны Luau вместо
PCRE (`match`, `isMatch`, `matchAll`, `replaceMatches`, `test`), ASCII-регистр,
сокращённые сигнатуры там, где сокращён `Str` (`ascii()` без языка, `slug()`
без языка, `plural()` без `prependCount`, `studly()`/`pascal()` без
`normalize`, `replace()`/`remove()` без `caseSensitive`, `isUuid()` без версии,
`substrCount()` и `wordCount()` без диапазона, `excerpt()` позиционными
аргументами, `convertCase()` тремя режимами, `swap()` массивом пар).

Своя логика — не делегаты — только у `explode()` и `split()`: `explode()`
воспроизводит все три смысла PHP-шного `$limit` (положительный оставляет
остаток в последнем куске, отрицательный отрезает куски с конца, ноль
считается единицей), `split()` повторяет развилку PHP — число дробит на куски
по N кодпоинтов, строка идёт как паттерн; флаги `preg_split` не портированы,
пустой кусок сохраняется всегда. `toInteger()` строже PHP: `tonumber` хочет
число целиком, поэтому `"12abc"` — это `0`, а не `12`.

Не портировано: `markdown`, `inlineMarkdown`, `transliterate`, `stripTags`
(нет HTML), `scan` (нет `sscanf`), `hash`, `encrypt`/`decrypt`, `toDate`
(нет `Date`), `toUri`, `toHtmlString`, `dump`, `basename`/`dirname` (нет
файловой системы), `classBasename` (имя скомпилированного класса не несёт
неймспейса, а `class_basename` лежит в `Helpers`, который импортирует `Str`),
методы `ArrayAccess` и `__get` (нет перегрузки операторов), `Macroable`.

Хелпер `str($string)` есть; форма без аргумента, отдающая в PHP анонимный
объект с `__call`, — нет. Заодно у `blank()`/`filled()` появилась ветка
`Stringable`: PHP проверяет интерфейс с `__toString`, а здесь `toString()`
компилируется в метаметод `__tostring`, который есть у каждого класса, поэтому
проверяется сам класс.

### Arr: список и карта — разные вещи

PHP-массив одновременно список и упорядоченная карта. В порте методы,
адресующие ключи (`get`/`set`/`has`/`forget`/`only`/`except`/`dot`/`undot`,
типизированные геттеры), принимают и возвращают таблицу; методы, обходящие
последовательность (`first`/`where`/`map`/`sort`/`flatten`/`pluck` и прочие) —
массив. Там, где в PHP это один метод, порт оставляет ту сторону, ради которой
им обычно пользуются: `Arr::pluck` с ключом и `Arr::keyBy` дают карту, всё
остальное — список. Нужны упорядоченные ключи — это `Collection`.

Не портировано: `query` (нет HTTP), `toCssClasses`/`toCssStyles` (нет HTML),
`float` (в Luau один числовой тип), `arrayable` (интерфейсы стёрты).

### Log: драйверы и taps

Драйверы, писавшие в файл, сокет или syslog (`single`, `daily`, `slack`,
`syslog`, `errorlog`), аналога не имеют; их место занимает **`console`** —
`ConsoleHandler`, пишущий в вывод Roblox: `warning` и выше через `warn`,
остальное через `print`. `stack`, `monolog`, `null` и `custom` портированы как
есть, вместе с `action_level` (через `FingersCrossedHandler`) и
`ignore_exceptions` (через `WhatFailureGroupHandler`).

`tap` работает: канал перечисляет `"Класс:аргумент,аргумент"`, класс достаётся
из контейнера и вызывается. В PHP это `__invoke` объекта; `__call`/`__invoke` в
Luau нет, поэтому tap объявляет метод `__invoke`, а получатель передаётся явно
— обращение через свойство функционального типа компилируется в точечный вызов
и `self` бы потерялся. Плюс к этому tap может быть просто колбэком.

Не портировано: `__call`-форвардинг на `Logger` и `LogManager`.

### Context: снапшот вместо очереди

`Repository` перенесён целиком: `data` и `hidden`, стеки (`push`/`pop`/
`stackContains`), `scope`, `increment`/`decrement`, `remember`, `only`/`except`.
`ContextLogProcessor` подмешивает `all()` в `extra` записи — то есть контекст
попадает в каждую строку лога.

`dehydrate()`/`hydrate()` в PHP сериализуют репозиторий в payload задачи и
восстанавливают в воркере. Очередей здесь нет, поэтому они отдают и принимают
обычный снапшот — его можно передать в `task.spawn` или через ремоут — и шлют
те же события `ContextDehydrating`/`ContextHydrated`. `SerializesModels`,
`Macroable` и `Conditionable` не портированы, как и очередные хуки
`ContextServiceProvider::boot()`.

### Контекстные атрибуты параметров

PHP пишет их перед параметром и читает через
`ReflectionParameter::getAttributes()`; разрешает каждый **статический**
`resolve(self $attribute, Container $container)` на классе атрибута.

Здесь атрибут — это декоратор параметра, который кладёт свой экземпляр в тот же
реестр, что и `Inject`. Роль «класса атрибута» играет сама фабрика-декоратор:
по ней ключуются `whenHasAttribute()` и `afterResolvingAttribute()`. Хуки
`resolve` и `after` живут **на экземпляре**, а не в статике — до статического
метода через экземпляр в Luau не добраться. Вызываются с явной передачей
экземпляра, иначе точечный вызов через свойство потерял бы получателя.

```ts
class Matchmaker {
    public constructor(
        @Config("game.max_players") private readonly maxPlayers: number,
        @Give(RankedQueue) private readonly queue: Queue,
        @Context("place") private readonly place: string,
    ) {}
}
```

Свой атрибут — это фабрика, возвращающая декоратор параметра, плюс
`addParameterAttribute(owner, propertyKey, index, Фабрика, экземпляр)`.

Портированы `Give`, `Config`, `Tag`, `Log`, `Context`. Остальные ждут своих
компонентов: `Auth`, `Authenticated`, `CurrentUser`, `DB`, `Database`,
`Storage`, `RouteParameter`; `Cache` ждать уже нечего — кэш есть, атрибута ещё
нет. У `Log` не портирован аргумент `name` — PHP добирается до
`Monolog::withName()` через `__call`.

### Значения по умолчанию у параметров

`ReflectionParameter::isDefaultValueAvailable()` не воспроизводится, но и не
нужен для хвостовых параметров: неаннотированный параметр просто не получает
аргумента, а скомпилированный конструктор сам подставляет дефолт.

```ts
constructor(@Inject(Reporter) reporter: Reporter, times = 7) {}
```

Пропуск в середине так не работает: массив Luau не хранит `nil`, и список
аргументов молча укоротился бы. Такой случай диагностируется явно — с указанием
номера параметра и класса.

Variadic-параметры портированы: `@Variadic(abstract)` заменяет
`ReflectionParameter::isVariadic()`, работают и списочные контекстные биндинги
(`giveTagged`, массив в `give`), и «ничего не привязано → пустой массив».

### Events: слушатели вверх по иерархии

PHP рассылает событие ещё и слушателям его **интерфейсов**
(`addInterfaceListeners` через `class_implements`). Интерфейсы стёрты, поэтому
порт обходит цепочку классов — единственное отношение, которое доживает до
рантайма. Слушатель, повешенный на базовый класс события, срабатывает и на
подклассах; в Laravel того же добиваются интерфейсом.

Шаблон-подстановка тоже работает для событий-классов: у скомпилированного
класса нет неймспейса, поэтому шаблон сверяется с голым именем
(`"Order*"` поймает `OrderShipped`).

`defer()` портирован полностью — это чистая буферизация в памяти, включая
вложенность, выборочный список событий и восстановление состояния при
исключении.

### Сериализация: реестр вместо автолоадера

`serialize()` и `unserialize()` — это сам язык PHP, а очередь на них стоит:
джоб уезжает в хранилище строкой и возвращается объектом. Замены нет, поэтому
есть `Support/Serializer.ts`, и он стоит двух вещей.

**Реестр классов.** PHP пишет полное имя класса и доверяет автолоадеру найти
его снова; class-string в Luau нет, поэтому класс регистрируется под именем.
`serialize()` регистрирует всё, что встретил, — этого хватает на круг внутри
одного сервера. Джоб, прочитанный на **другом** сервере, требует, чтобы его
класс был зарегистрирован и там: это и есть `Serializer.register()`.
`QueueServiceProvider` регистрирует `CallQueuedHandler`, потому что его имя
стоит в каждом payload.

**Ни замыканий, ни `Instance`.** Функция в payload не попадёт — в PHP тоже, для
того и существует `laravel/serializable-closure`. А `Instance` хранится ровно
так, как `SerializesModels` хранит модель Eloquent: идентификатором, который
разворачивается обратно на выходе. `Player` — по `UserId`, остальное — по пути
в дереве. Не развернулось — `InstanceNotFoundException`, и `CallQueuedHandler`
ловит его там же, где PHP ловит `ModelNotFoundException`, с тем же
`deleteWhenMissingModels`.

Что теряется против формата PHP: тождество объектов и циклы (в JSON нет
обратных ссылок — цикл сообщается ошибкой, а не молча обрезается). Класс как
значение (`payload.job`) едет ссылкой по имени — это ровно class-string PHP.
Поддержаны `Vector3`, `Vector2`, `CFrame`, `Color3`, `UDim`, `UDim2`,
`DateTime` и `EnumItem`.

### Queue: payload — таблица, строкой становится в хранилище

`Queue::createPayload()` в PHP всегда делает `json_encode`, потому что payload
в любом случае едет через хранилище в другой процесс. Очереди, которая не
покидает сервер, ехать некуда, поэтому payload остаётся таблицей, а
`data.command` — самим объектом джоба. `CallQueuedHandler::getCommand()`
принимает оба вида.

Драйвер-хранилище кладёт строку — и **двумя слоями, как PHP**: команда
сериализуется отдельно в `createObjectPayload()` и едет строкой внутри
конверта, конверт сериализуется целиком. Это не деталь хранения, а выбор места
падения. Развернуть конверт обязано получиться, иначе джоб не существует и его
некому обработать; развернуть команду обязано падать внутри
`CallQueuedHandler::call()`, где `InstanceNotFoundException` разбирается по
`deleteWhenMissingModels`. Если разворачивать всё разом в конструкторе джоба,
исключение ловит `pcall` в `Worker::getNextJob`, предмет остаётся в хранилище
прочитанным, но не удалённым — и всплывает снова каждые `retry_after` до
истечения `expiration`.

`CallQueuedHandler::failed()` терпим к нечитаемой команде: PHP получает там
`__PHP_Incomplete_Class` и выходит, здесь — ошибку сериализатора и тоже выходит,
потому что уведомлять нечего.

Не портированы `jobShouldBeEncrypted()` и `ShouldBeEncrypted` — нет шифровальщика.
`getRawBody()` и `payload()` возвращают одно и то же: оба публичны, оба оставлены.

Поле `job` в payload — не строка `'Illuminate\Queue\CallQueuedHandler@call'`, а
пара `[класс, метод]`: class-string нет. `JobName.parse()` принимает оба
написания плюс голый класс, поэтому строковые джобы (`"SendMail@deliver"`)
работают как в PHP.

### Worker: корутина вместо процесса

- **Уступает кадру.** PHP-воркер крутится в своём процессе сколько хочет; здесь
  цикл делит поток с игрой и уступает, если проработал дольше
  `Worker.frameBudget` (4 мс). Без этого полная очередь держала бы кадр.
- **Таймауты приблизительны.** `pcntl_alarm` нет: джоб исполняется в своей
  корутине, и `task.cancel` достаёт его только пока тот уступил. Всё, что ждёт
  DataStore, MemoryStore или ремоут, снимается; чистый CPU-цикл — нет. Поэтому
  `timeout` по умолчанию выключен.
- **Сигналов и рестарта нет.** `SIGTERM`, `SIGUSR2` и кэш-сигнал рестарта ушли
  вместе с процессом: `shutdown()` ставит флаг, звать его — из `BindToClose`.
  `queueShouldRestart()` и `getPausedQueues()` — флаги в кэше, они ещё не
  подключены; `markJobAsFailedIfWillExceedMaxExceptions()` работает: провайдер
  отдаёт воркеру `cache.store`, если он забинден.
- **Память — всего сервера.** `memory_get_usage()` считает один процесс;
  ближайшее здесь — `Stats:GetTotalMemoryUsageMb()`, поэтому лимит по умолчанию
  выключен, а не 128 МБ.
- Вместо `ExceptionHandler` воркеру передаётся коллбэк-репортёр; провайдер
  отдаёт тот, что пишет в лог.

### Cache: MemoryStore как Redis, и что из этого следует

`array` — порт `ArrayStore`, живёт в памяти сервера. `memorystore` — порт
`RedisStore` поверх `MemoryStoreHashMap`, общий на всю вселенную; ради него всё
и затевалось, потому что **лок имеет смысл только тогда, когда один сервер может
сказать другому «занято»**.

Три вещи от платформы:

- **Ничто не живёт вечно.** `forever()` кладёт на 45 дней — это потолок
  MemoryStore. `ArrayStore` хранит бессрочно, но умирает вместе с сервером.
- **`flush()` у `memorystore` отвечает `false`**: удалить всё разом MemoryStore
  не умеет, и притворяться тут хуже, чем сказать правду.
- **Значения сериализуются**, как и в `RedisStore`, и по той же причине —
  класс обязан вернуться классом. Числа лежат сырыми, иначе `increment()` не
  сработает.

Локи стоят на `UpdateAsync`: он отменяет запись, если преобразование вернуло
ничего, и это ровно compare-and-set, которого требует «занять, если свободно».
Проверено: два независимых экземпляра стора не могут взять один лок
одновременно. А вот `release()` не атомарен — Redis сравнивает владельца и
удаляет одним Lua-скриптом, у MemoryStore delete-if нет, поэтому владелец
читается, а потом ключ удаляется. Держите время жизни лока с запасом
относительно работы, которую он охраняет; тот же совет даёт и PHP.

### DataStore как база данных: дорогая память, которая переживает сервер

`datastore` — порт `DatabaseStore` поверх `DataStoreService`. Своего срока
жизни у DataStore нет, поэтому срок лежит рядом со значением (`{v, e}`) и
проверяется на чтении — ровно то, что делает колонка `expiration` в PHP.
Числа хранятся сырыми ради `increment()`, остальное — через `Serializer`.

Что диктует платформа:

- **Ключ — не длиннее 50 символов** вместе с префиксом. Длинный ключ отвергается
  `InvalidArgumentException`: обрезать его — значит однажды получить коллизию.
- **Значение — не больше 4 МБ.** Чтения и записи делят бюджет
  `60 + игроки × 40` в минуту, а `ListKeysAsync`, на котором стоит `flush()`, —
  `5 + игроки × 2`.
- **Запись в один ключ throttling'уется** примерно раз в шесть секунд. Отсюда
  правило: DataStore — для того, что читают часто, а пишут редко; счётчики и
  локи живут на `memorystore`. `DataStoreLock` есть, потому что он есть в
  Laravel, а не потому, что им стоит пользоваться.
- **`flush()` перебирает ключи и удаляет по одному** — PHP делает `TRUNCATE`.

Две вещи проверены в Studio и стоят того, чтобы их знать:

- удалённый ключ **остаётся в листинге**, пока не попросить `excludeDeleted`;
  и `flush()`, и `all()` просят, иначе каждый повторный проход тратил бы чтение
  на каждую могилу;
- `GetAsync` по удалённому или никогда не существовавшему ключу возвращает
  **ноль значений**, а не `nil`-значение; `local held = store:GetAsync(key)`
  видит `nil`, а `tostring(store:GetAsync(key))` — падает.

### Упавшие джобы: `queue.failed.driver`

`null` (по умолчанию) выбрасывает упавшую джобу; `datastore` кладёт её в
`DataStoreService` — это единственное здешнее хранилище, которое переживает
сервер, и упавшая джоба — ровно тот случай, ради которого его стоит тратить.

PHP пишет упавшее из `WorkCommand::listenForEvents()`, потому что джоба падает
там, где работает воркер. Консоли тут нет, поэтому на `JobFailed` подписывается
`QueueServiceProvider::listenForFailedJobs()` — в момент резолва
`queue.worker`, то есть в тот же момент, только сказанный иначе.

**Про payload.** В PHP `getRawBody()` — уже JSON-строка, её и пишут. Здесь сырое
тело — таблица, и драйверы, которые держат джобы внутри сервера (`memory`,
`sync`), кладут в неё живую команду; к моменту падения команда ссылается на
`Job`, тот — на очередь и контейнер, и сериализовать это нельзя. Провайдер
сначала пробует сохранить конверт целиком, а если не вышло — сохраняет его без
команды: что упало, когда и почему — читается, повторить из хранилища — нет. У
`memorystore` команда уже строка, и конверт ложится целиком.

Порядок тоже отличается: PHP сортирует по `id desc`, а `Str.orderedUuid()`
упорядочен только внутри одного сервера (он считает от `os.clock()`), поэтому
`all()` сортирует по `failed_at`. Исключение хранится текстом — Luau-ошибку
сериализовать нечем.

### Батчи: счётчики в памяти, коллбэки замыканиями

`Bus::batch([...])->then(...)->dispatch()` работает целиком: счётчики,
`progress`/`then`/`catch`/`finally`, `allowFailures()`, `cancel()`, `add()` на
ходу, `SkipIfBatchCancelled`, четыре события.

Хранилище — `ArrayBatchRepository`, порт `DatabaseBatchRepository` с таблицей в
памяти. То, что PHP покупает транзакцией и `lockForUpdate()` — атомарное
чтение-изменение-запись счётчиков, — внутри одного Luau VM бесплатно: корутина
прерывается только там, где уступает, а в репозитории уступать негде. Поэтому
`transaction()` просто зовёт коллбэк, а `rollBack()` нечего откатывать.

**Коллбэки остаются замыканиями.** PHP гонит их через
`laravel/serializable-closure`, чтобы они пережили запись в БД; здесь они лежат
в репозитории как есть — это работает ровно потому, что репозиторий не покидает
сервер. Кросс-серверный `MemoryStoreBatchRepository` упрётся именно в это:
счётчики держать есть где (`UpdateAsync` атомарен), а замыкание не сериализуется,
и коллбэк придётся задавать зарегистрированным классом.

Отсюда же и границы: батч принадлежит серверу, который его начал, и не переживёт
его закрытие.

### Ограничение частоты: без хэшей

`RateLimiter` считает попытки в кэше, поэтому лимитер над `memorystore` считает
**на всю вселенную**, а над `array` — только на этом сервере. Выбор стора для
лимитера задаётся ключом `cache.limiter` в конфиге, как в Laravel.

Где PHP хэширует, порт этого не делает: `md5` в `RateLimited`, `xxh128` в
`WithoutOverlapping` и `ThrottlesExceptions` — хэш-функции в стандартной
библиотеке Luau нет. Ключи получаются длиннее и остаются такими же уникальными;
единственное последствие — их видно целиком в кэше.

`cleanRateLimiterKey()` в PHP снимает HTML-сущности; HTML тут нет, и ключ идёт
как есть.

**`backoff()` у `ThrottlesExceptions` принимает минуты** — не секунды, как
`backoff()` у джоба. Несогласованность единиц пришла из Laravel и сохранена
намеренно: расхождение с оригиналом было бы неожиданнее.

Middleware получает **команду** — тот объект джоба, который написало
приложение, — а не очередной `Job`, который его несёт. До очереди она достаёт
через `InteractsWithQueue` (`release()`, `delete()`, `fail()`), ровно как в PHP.

### Pipeline: параметр не может называться `next`

`Illuminate\Pipeline` переносится почти дословно — пайп может быть замыканием,
экземпляром, классом или строкой-ключом с параметрами (`"throttle:10,1"`). Две
вещи о нём стоит знать.

**Имя `next` занято компилятором.** Сигнатура middleware в Laravel —
`handle($passable, $next)`, но `next` в roblox-ts зарезервирован. Конвенция
проекта — **`_next`**: ближе всего к оригиналу, компилируется как есть и не
глушит проверку на неиспользованный параметр. Это касается всего кода, который
пишет middleware, не только фреймворка.

```ts
public handle(job: object, _next: Next): unknown {
    return _next(job);
}
```

**Пустой список пайпов.** `Util.isArray()` отвечает только про непустой список,
поэтому `through([])` нельзя разбирать им: пустая таблица уехала бы в список
пайпов одним значением, и контейнер попытался бы её инстанцировать. Признак
другой — у обычной таблицы нет метатаблицы, а у класса и экземпляра она есть.

**Класс с аргументами рядом.** У PHP параметры middleware приклеены к имени
класса, потому что класс там и есть строка: `"Class:60,1"`. Здесь алиас
указывает на сам класс, приклеивать не к чему, поэтому появилась пятая форма
пайпа — список, где класс первый, а дальше его аргументы. `parsePipeString()`
читает её так же, как строку.

Список пайпов и пайп-список неотличимы по типу, поэтому вкладывать обязательно:
аргумент `middleware()` всегда разбирается как список пайпов.

```ts
route.middleware([[ThrottleRequests, "60", "1"]]);  // = middleware("throttle:60,1")
route.middleware([ThrottleRequests, "60", "1"]);    // три middleware, из них два мусорных
```

Ловушка, которую эта форма создала внутри фреймворка: `Router::flatten()`
разворачивал в список пайпов всё похожее на массив, и `"60"` уезжал в пайплайн
отдельным middleware. Разворачивается только то, что действительно является
именем группы.

`withinTransaction()` не портирован: он оборачивает прогон в транзакцию БД.

### Очередные слушатели событий

Слушатель, помеченный `@ShouldQueue()`, не вызывается, а кладётся в очередь
джобом `CallQueuedListener` — как в Laravel. Опции слушателя (`tries`,
`backoff`, `timeout`, `middleware`, `viaConnection`, `viaQueue`, `withDelay`)
переносятся на джоб, а `shouldQueue($event)` позволяет решать по каждому
событию.

Одно расхождение по необходимости: PHP строит слушателя через
`newInstanceWithoutConstructor()` — он нужен только чтобы спросить про опции.
Дефолты свойств PHP при этом сохраняет, а roblox-ts компилирует их **внутрь
конструктора**, поэтому объект без конструктора не знал бы про `tries = 5`.
Слушатель строится контейнером, как и парой строк выше в
`handlerWantsToBeQueued()`.

Уникальность самого `CallQueuedListener` (`shouldBeUnique`, `uniqueId`,
`uniqueFor`, `uniqueVia`) не портирована — не из-за платформы: лок для неё есть
(`Bus\UniqueLock` поверх кэша, тот же, которым пользуется `ShouldBeUnique` у
джобов), просто руки не дошли.

`queueable()`, `QueuedClosure` и `InvokeQueuedClosure` не портируются: они
кладут в очередь замыкание.

### Bus: три трейта стали одной цепочкой наследования

Джоб в Laravel собирается из трейтов: `Dispatchable`, `InteractsWithQueue`,
`Queueable`, `SerializesModels`. Множественного наследования в TypeScript нет,
поэтому они выстроены в цепочку `Dispatchable → Queueable →
InteractsWithQueue`, а сериализация делается сама. Джоб пишется как
`class SendWelcome extends Dispatchable`, и `dispatch()` достаётся ему статикой
через метатаблицу класса — `self.new(...)` в скомпилированном коде строит
именно подкласс, как `new static(...)` в PHP.

Аргументы конструктора проверяются: `dispatch()` объявлен с параметром `this`,
несущим конструктор подкласса, — это то же самое, что PHP делает динамически.

### `PendingDispatch` без деструктора

`Job::dispatch()` возвращает `PendingDispatch`, чтобы вызов можно было
дописать: `->onQueue('high')->delay(30)`. Отправляет джоб PHP из `__destruct()`
— когда выражение закончилось и настроить его больше некому.

Деструкторов здесь нет, а ближайшее к «когда выражение закончилось» —
`task.defer`: джоб уходит на шину в конце текущего цикла возобновления, после
всех дописанных вызовов. Где важна точность, есть `send()` — отправляет сразу и
безопасен при повторном вызове. Практическое следствие: сразу после
`Job.dispatch()` очередь ещё пуста, джоб появится в ней кадром позже.

`afterResponse()` не портирован — отвечать не на что; ближайшее по смыслу —
драйвер `deferred`.

### `block_for` в очереди в памяти

У Redis-драйвера `pop()` не отвечает «пусто» сразу, а ждёт в `blpop` на списке
`:notify` — воркер спит, а не опрашивает, и берёт джоб в момент его появления.
Внутри одного VM ждать не на чем, поэтому `MemoryQueue.pop()` паркует свою
корутину, а `push` будит запаркованных напрямую. Отложенный джоб приходит по
часам, а не по push, поэтому ему заводится собственное пробуждение через
`task.delay`.

Смысл конфига тот же, что у Redis: `block_for: 0` — отвечать сразу (как
`DatabaseQueue`), `block_for: 5` — ждать до пяти секунд. Побочный эффект тот
же, что в Laravel: `pop()` при `block_for > 0` может уступить поток.

Разрешение задержки — целая секунда, как и `available_at` в PHP: джоб с
задержкой в 2 с становится доступен между первой и второй секундой реального
времени, потому что `os.time()` не дробит.

### MemoryStore как Redis

`MemoryStoreQueue` — порт `RedisQueue`: сама очередь заменяет список, её
**invisibility timeout** делает то же, что `retry_after` и `:reserved`-множество
(прочитанный, но не удалённый джоб возвращается сам), `MemoryStoreSortedMap` с
ключом-таймстампом — это `:delayed`, а `ReadAsync(count, allOrNothing,
waitTimeout)` — это `BLPOP`: воркер ждёт внутри вызова, а не опрашивает.

Считать очередь можно: `GetSizeAsync()` даёт длину, а `excludeInvisible`
проводит ту же границу, что `:reserved` в PHP, — отсюда все четыре размера.
`size()` = длина очереди (видимые плюс невидимые) плюс размер `:delayed`,
`pendingSize()` = `GetSizeAsync(true)`, `reservedSize()` = разница между
двумя вызовами, `delayedSize()` = размер отсортированной карты.

`clear()` (контракт `ClearableQueue`, как у `RedisQueue` и `MemoryQueue`)
чистит обе структуры и возвращает, сколько удалил. Одного джоба он достать не
может — зарезервированного: `ReadAsync` отдаёт только видимое, а вызова,
который заберёт предмет из-под другого читателя, нет. В PHP такой дыры нет,
`:reserved` там обычный ключ.

Отличия платформы: сами джобы не видны — `ReadAsync` единственный способ
прочитать джоб, и он же его резервирует, поэтому `pendingJobs()` и соседи
отвечают пустой коллекцией, а `creationTimeOfOldestPendingJob()` — ничем;
предмет — не больше 32 КБ (иначе `InvalidPayloadException`); квота
вселенной — `64 КБ + 1.2 КБ × игроков`, бюджет — `1000 + 120 × игроков` юнитов
в минуту, и ожидание в `ReadAsync` стоит юнит за каждые две секунды. Доставка
— at-least-once, как и у Laravel: `retry_after` обязан быть больше `timeout`
джоба. Задержки меряются целыми секундами (`os.time()`), как и `available_at` в
PHP.

`ShouldQueue` — интерфейс-маркер без методов, искать в рантайме нечего, поэтому
это декоратор класса с проверкой `isShouldQueue()`; реестр тот же, что у
атрибутов контейнера. `InteractsWithQueue` — трейт, а множественного
наследования в TypeScript нет: джоб наследует его как класс, и
`CallQueuedHandler` проверяет `instanceof` там, где PHP смотрит
`class_uses_recursive()`.

`ReadsClassAttributes::getAttributeValue()` в PHP сначала сравнивает свойство
экземпляра с дефолтом класса. Дефолтов в таблице класса нет — roblox-ts
присваивает их в конструкторе, — поэтому выигрывает любое заданное свойство.

В `CallQueuedHandler::call()` ждёт своего компонента одна ветка — debounce
(`DebounceLock`); middleware, уникальность, батчи и цепочки работают.

`InteractsWithTime` — трейт, ставший статическим классом: Carbon нет, время
берётся из `os.time()`, задержка — секунды или `DateTime`. `parseDateInterval()`
(нет `\DateInterval`) и `runTimeForHumans()` (нет `CarbonInterval`) не
портированы.

### Запрос — это вызов ремоута

У `Illuminate\Http` в Laravel под ногами Symfony, а под Symfony — веб-сервер,
который уже разобрал строку запроса. Здесь разбирать нечего: клиент зовёт
`RemoteFunction:InvokeServer(method, path, data)`, и `Http/RemoteGateway` — это
и есть веб-сервер, у которого в PHP нет файла-аналога. Он проверяет конверт
(глагол, путь, таблицу ограниченного размера и глубины), отвечает 503, пока
приложение не забутстрапилось, и отдаёт запрос ядру.

Ремоутов четыре, и они объявлены в `default.project.json`, а не создаются в
рантайме: тогда они есть до первого скрипта. `Call` — `RemoteFunction` (запрос с
ответом), `Send` — `RemoteEvent` (без ответа), `Stream` —
`UnreliableRemoteEvent` (движок роняет всё больше 1000 байт), `Push` — обратное
направление, под будущий `Broadcasting`. `RemoteFunction:InvokeClient` не
используется никогда: сервер повис бы на клиенте, который может не ответить.

Что из этого следует для `Request`: заголовков, кук, файлов и сессии нет, а
`ip()` заменён на **`player()`** — движок называет вызывающего сам, и подделать
его из payload нельзя. Это же значение уходит в контекст лога обработчика
исключений там, где PHP пишет `Auth::id()`.

`Response` несёт значение, а не строку: по ремоуту едет таблица Luau, кодировать
нечего. Поэтому `JsonResponse` избыточен — `json($data)` и `make($data)`
построили бы один и тот же объект, — а у обработчика исключений схлопывается
развилка `shouldReturnJson()`: HTML-ветку рисовать не для кого.

### Сопоставление: сегменты вместо регулярки

`Symfony\Component\Routing\CompiledRoute` собирает из URI одно регулярное
выражение с именованными группами. В Luau нет PCRE (см. «Str: паттерны вместо
регулярок»), поэтому `Routing/CompiledRoute` идёт по сегментам. Три правила,
которые из этого выросли:

- **параметр занимает сегмент целиком**: `users/{id}` работает, а `v{version}/api`
  отвергается при регистрации маршрута — паттерн `where` пришлось бы вклеивать
  в середину сегментного, а паттерны Luau так не составляются;
- **необязательные параметры только в хвосте** (этого требует и Symfony):
  `posts/{page?}` работает, `posts/{page?}/comments` отвергается;
- **`where` проверяет один сегмент — кроме последнего параметра**: тот забирает
  весь остаток пути, сколько бы сегментов в нём ни было и даже если их нет
  вовсе, а паттерн судит уже остаток целиком. Это ровно то, что делает регулярка
  Symfony, и на этом собран `Route::fallback()` — в PHP он и есть
  `{fallbackPlaceholder}` с `where(".*")`. Последний параметр **без** паттерна
  берёт один сегмент: отказать остатку было бы нечем.

```ts
route.get("files/{path}", ...).where("path", ".*");  // ловит files/a/b/c.txt
route.get("ping/{id}", ...).whereNumber("id");       // ping/1/2 не ловит: "1/2" не число
route.fallback(...);                                 // ловит всё, включая "/"
```

Один хвост от этого остаётся: `files` (без слэша и без остатка) тоже подойдёт
маршруту `files/{path}` с `.*` и даст пустую строку, тогда как Symfony
потребовал бы `/files/`. Разделения между `files` и `files/` здесь нет в
принципе — пустые сегменты отбрасываются при разборе пути.

Хоста нет вовсе, поэтому `HostValidator` и `domain()` не портированы.

### Порядок аргументов экшена вместо тайп-хинтов

PHP смотрит на тайп-хинты параметров контроллера и раскладывает по ним всё:
что-то приходит из контейнера, что-то — из маршрута. Типы стёрты, поэтому
источник задаётся **позицией и аннотацией**: сначала параметры с атрибутами
(`Inject`, `RouteParameter`), потом параметры маршрута в порядке URI.

```ts
public show(@Inject("log") log: LogManager, id: string): unknown
```

Замыкание получает запрос первым аргументом, потом параметры маршрута — в PHP
это тоже определяется тайп-хинтом `Request $request`:

```ts
route.get("players/{player}", (request: Request, player: Player) => ...)
```

### Транспорт вместо схемы URL

У маршрута в Laravel есть вторая ось помимо глагола — схема: `httpsOnly()` и
`SchemeValidator`. Схем здесь нет, а ремоуты есть, и они ровно так же
ортогональны глаголу. Обычный маршрут отвечает на `call` и `send`,
`Route::stream()` — только на unreliable-ремоуте, `->reliable()` сужает до
`call`. Проверяет это `Matching/TransportValidator` — порт `SchemeValidator`
один в один, только поле другое.

### Ядро: бутстрап на старте, `terminate()` через `task.defer`

`Foundation\Http\Kernel` перенесён почти дословно, но процесс здесь живёт
дольше запроса, а в PHP умирает вместе с ответом. Отсюда два отличия в точке
входа (она же `public/index.php`): `bootstrap()` зовётся один раз на старте, а
не на входе в первый запрос — провайдерам есть что делать до первого вызова, тому
же воркеру очереди. И `terminate()` уезжает в `task.defer`: PHP терминирует
после `$response->send()`, а отправка ответа здесь — это возврат из обработчика,
после которого уже ничего не выполнится.

`whenRequestLifecycleIsLongerThan()` меряет `os.clock()`, а не `Carbon`:
настенных часов с таймзоной в порте нет, а длительность нужна монотонная.

Списки по умолчанию — PHP-шные за вычетом непортированного. Глобальный пуст
(весь список PHP — про веб-сервер: `TrustProxies`, `HandleCors`,
`ValidatePostSize`, `TrimStrings`, …), группы `web` нет (куки, сессии, CSRF,
вьюхи), осталась `api`: каждый запрос по ремоуту — это она. Алиас один —
`throttle`.

### Обработчик исключений: колбэки без тайп-хинтов

`Foundation\Exceptions\Handler` выбирает колбэки `reportable()` и `renderable()`
по тайп-хинту первого параметра — читает его рефлексией. Читать нечего, поэтому
колбэк зовут на **каждое** исключение, и он разбирается сам; ровно так PHP ведёт
себя с нетипизированным колбэком. По той же причине `map()` берёт класс-источник
отдельным аргументом, а не выводит его из замыкания.

```ts
exceptions.map(ItemNotFoundException, NotFoundHttpException);
exceptions.renderable((e) =>
    e instanceof MyException ? new Response({ oops: true }, 418) : undefined,
);
```

`Routing\Pipeline` ищет обработчик по конкретному классу: контракт
`ExceptionHandler` — интерфейс, а интерфейс рантайм-следа не оставляет. И
исключение со своим `render()` обязано вернуть готовый `Response`: PHP пропускает
результат через `Router::toResponse()`, а такой импорт замкнул бы цикл
`Router → Routing\Pipeline → Handler → Router` — циклический импорт значений
убивает модуль (см. «Stringable: один модуль на два класса»). Колбэкам
`renderable()` PHP и сам не даёт конвертации, так что ограничение то же.

Тело ответа при `app.debug` — сообщение и класс брошенного. Файла, строки и
стека в нём нет: `error()` бросает значение, а не стек.

### Параметры `make()` / `call()`

PHP сопоставляет `$parameters` по **имени** параметра. Имён нет, поэтому
override задаётся либо самим abstract, либо позицией:

```ts
app.make(Report, [logger]);               // по позиции
app.make(Report, new Map([[Logger, x]])); // по abstract
app.make(Report, new Map([[2, x]]));      // по позиции, второй параметр
```

Позиции нумеруются **с единицы**, как индексы списка в Luau, а не с нуля.
Это не стиль, а вынужденное: `new Map([[1, x]])` компилируется в `{[1] = x}`
— ту же самую таблицу, что и список `[x]`, и различить их нельзя. При
нумерации с единицы обе формы хотя бы значат одно и то же (первый параметр);
при нумерации с нуля они значили бы разное, и переопределить *второй*
параметр в одиночку было бы нечем — `Map([[1, x]])` прочиталось бы как
список из одного элемента и попало в первый.

### Не портировано

| Что | Почему |
|---|---|
| `bind(Closure $abstract)` через возвращаемый тип | типы возврата стёрты |
| `Container::__get` / `__set` (сахар `$app->events`) | в TS индекс и свойство — одно выражение, перехватывать нечего |
| `whenHasAttribute`, `resolveFromAttribute`, `afterResolvingAttribute` | нет рефлексии атрибутов на параметрах |
| `SelfBuilding` как интерфейс | интерфейсы стёрты; ищется статический `newInstance` |
| `DeferrableProvider` как интерфейс | провайдер считается отложенным, если объявил свой `provides()` |
| `Macroable` (Collection, Str, Stringable, Arr, Application; **не** Container — он его не использует) | нет `__call` |
| `Optional`, `HigherOrderTapProxy`, `HigherOrderWhenProxy` | все три живут на `__get`/`__call`; коллбэк у `optional`, `tap`, `when`, `unless` обязателен |
| хелперы `e`, `preg_replace_array` | нет HTML и PCRE |
| хелперы `env`, `windows_os`, `laravel_cloud` | нет окружения, которое можно прочитать |
| хелпер `object_get` | объект здесь — таблица, это уже делает `data_get` |
| хелпер `literal` | нет именованных аргументов и `stdClass` |
| хелперы `append_config`, `class_uses_recursive`, `trait_uses_recursive` | трейты не оставляют следа в рантайме |
| хелпер `once` | хэширует место вызова из бэктрейса |
| `str()` без аргумента (анонимный прокси к `Str`) | нет `__call`; сам `str($string)` есть |
| `AliasLoader`, `Facade::defaultAliases()` | в TypeScript нет глобального пространства имён, куда алиасить класс |
| Mockery-хелперы фасада (`spy`, `partialMock`, `shouldReceive`, `expects`, `isFake`) | нет мок-библиотеки и тестов |
| `ApplicationBuilder`: `withBroadcasting`, `withCommands`, `withSchedule`, `prefersJsonResponses` | вещание, консоль, очереди |
| `ApplicationBuilder::withEvents()` | обнаружение событий по файловой системе |
| очереди замыканий в `Dispatcher` (`QueuedClosure`, `InvokeQueuedClosure`, `queueable()`) | замыкание не сериализуется; слушатели-классы с `@ShouldQueue()` работают |
| broadcast в `Dispatcher` (`shouldBroadcast`, `broadcastWhen`, `broadcastEvent`) | нет broadcasting |
| транзакции в `Dispatcher` (`ShouldDispatchAfterCommit`, `ShouldHandleEventsAfterCommit`, `setTransactionManagerResolver`) | нет БД |
| `ShouldBeDiscovered` и обнаружение событий | нет файловой системы |
| драйверы очереди `database`, `sqs`, `beanstalkd`, `failover`, `background` | нет бэкендов; `redis` заменён на `memorystore`, `database` — на `memory` |
| `queue:work`, `queue:listen`, `queue:retry` и прочие команды, `Queue\Listener` | нет консоли; воркер запускается из провайдера |
| `Worker::$popCallbacks`, `Interruptible`, `DetectsLostConnections` | нет соединения, которое можно потерять |
| `CallQueuedClosure`, `QueuedClosure` | замыкание не сериализуется |
| батч на несколько серверов (`MemoryStoreBatchRepository`) | счётчики есть где держать, а коллбэки — нет |
| `ChainedBatch` — цепочка внутри батча | цепочка сериализуется, коллбэки батча нет |
| `Bus::batches()`, прунинг батчей, `queue:prune-batches` | нет консоли и перебора хранилища |
| `catch()` у цепочки, `chainCatchCallbacks` | коллбэк — замыкание, оно не сериализуется |
| `dispatchAfterResponse()`, `PendingClosureDispatch` | нет ответа; замыкание не сериализуется |
| `DebounceFor`, `DebounceLock` | нужен debounce-лок; `ShouldBeUnique` работает |
| драйверы кэша `file`, `redis`, `memcached`, `dynamodb`, `apc` | нет бэкендов; `redis` заменён на `memorystore`, `database` — на `datastore` |
| `FileFailedJobProvider`, `DynamoDbFailedJobProvider` | нет файловой системы и DynamoDB; упавшие джобы пишет `datastore` |
| `queue:failed`, `queue:retry`, `queue:forget`, `queue:prune-failed` | нет консоли; у провайдера есть `all/find/forget/flush/prune/count` |
| теги кэша (`TaggedCache`, `TagSet`), `flexible()`, `funnel()`, `MemoizedStore` | ни один здешний стор не умеет теги |
| `RateLimitedWithRedis`, `ThrottlesExceptionsWithRedis` | это Lua-скриптовые варианты тех же middleware |
| `Queue\Middleware\FailOnException` | просто не дошли руки; от обработчика исключений он не зависит |
| `queueShouldRestart` (cache-сигнал рестарта воркера) | флаг в кэше, ещё не подключён |
| `QueueManager::pause/resume/isPaused`, `QueueRoutes` | флаги в кэше не подключены; роутов очередей нет |
| пути, `.env`, кэш конфига, `PackageManifest` | нет файловой системы |
| `runningInConsole`, maintenance mode, локали, консольное ядро | нет консоли |
| `publishes`, `commands`, `loadMigrationsFrom` и т.п. в провайдере | нет файловой системы и Artisan |
| `Routing\{ResourceRegistrar,PendingResourceRegistration}` (`Route::resource`, `apiResource`, `singleton`) | сахар над семью обычными маршрутами; по уговору — после ядра |
| `Routing\{UrlGenerator,Redirector,RedirectController,ViewController}`, хелперы `route()`/`url()`, `Router::redirect/view` | адресов и вьюх нет |
| `Route::can()`, `missing()`, scoped-биндинги, `Route::controller(...)` | нет авторизации; группе контроллера нужна строковая форма экшена |
| `Router::substituteImplicitBindings()` | неявный биндинг ищет модель по route key — ждёт БД; `Route::bind()` работает |
| `Route::domain()`, `Matching\HostValidator`, `httpsOnly()`/`SchemeValidator` | хостов нет; на месте схемы — транспорт |
| `Http\{JsonResponse,RedirectResponse,ResponseFactory,StreamedResponse}`, хелпер `response()` | контент и так значение; редиректов и потоков нет |
| `Request`: заголовки, куки, файлы, сессия, `expectsJson()`, `user()` | по ремоуту не едет ничего из этого; `user()` ждёт `Auth` |
| `Http::fake()`, `preventStrayRequests()`, пулы, `timeout()`, middleware клиента | нет Guzzle и тестов; зависший `InvokeServer` отменить нечем |
| `Foundation\Http\Middleware\*` (`TrimStrings`, `ConvertEmptyStringsToNull`, `InvokeDeferredCallbacks`, `HandlePrecognitiveRequests`, …) | поэтому глобальный стек пуст; `ConvertEmptyStringsToNull` вдобавок невыразим — таблица Luau не хранит `nil` |
| `Handler`: `throttle()`/`throttleUsing()`, `dontFlash()`, `unauthenticated()`, ветка `ValidationException`, `ShouldntReport`, `renderForConsole()` | нужны `Lottery`, сессия, `Auth`, `Validation`; интерфейс-маркер стёрт; консоли нет |
| `Kernel`: бутстраппер `HandleExceptions`, `enableHttpMethodParameterOverride()`, `$routeMiddleware` | обработчики ошибок PHP; форм нет; PHP сам пометил deprecated |
| `Configuration\Middleware`: `web()`, `pages()`, редиректы гостей, куки, CSRF, `trustHosts`/`trustProxies`, `statefulApi()`, `throttleWithRedis()` | группы `web` нет, остальное — дело веб-сервера и Sanctum |
| `ThrottleRequestsWithRedis` | стор лимитера выбирает `cache.limiter`, а не middleware |

### Переименования (конфликты имён в TS/Luau)

Свойство и метод с одним именем на одном классе невозможны:

| PHP | Порт |
|---|---|
| `Container::$instance` (static) | `Container::sharedInstance` |
| `Container::$resolved` | `Container::resolvedTypes` |
| `Bus\Queueable::$delay` | `Queueable::delaySeconds` — рядом метод `delay()` |
| `Bus\Queueable::afterCommit()` | `Queueable::afterCommitting()` — рядом свойство `afterCommit` |
| `ThrottlesExceptions::$byJob` | `ThrottlesExceptions::byJobUuid` — рядом метод `byJob()` |
| `Pipeline::$pipes` | `Pipeline::pipeStack` — рядом метод `pipes()` |
| `Application::$hasBeenBootstrapped` | `Application::bootstrapped` |
| `Application::$booted` | `Application::hasBooted` |
| `ContextualBindingBuilder::$needs` | `ContextualBindingBuilder::needsAbstract` |
| `Queue\Jobs\Job::failed()` (protected) | `Job::failedJob()` — рядом свойство `$failed` |
| `Queue\Jobs\SyncJob::$payload` | `SyncJob::jobPayload` — рядом метод `payload()` |
| `Support\Stringable::$value` | `Stringable::stringValue` — рядом метод `value()` |
| `Http\Request::$method`, `$pathInfo` (Symfony) | `Request::requestMethod`, `requestPath` — рядом методы `method()` и `path()` |
| `Http\Response::$content` (Symfony) | `Response::responseContent` — рядом метод `content()` |
| `ResponseTrait::$exception` | `Response::responseException` — рядом метод `exception()` |
| `Foundation\Http\Kernel::$bootstrappers` | `Kernel::bootstrappersList` — рядом метод `bootstrappers()` |
| `Foundation\Exceptions\Handler::$dontReport` | `Handler::dontReportTypes` — рядом метод `dontReport()` |
| `Foundation\Configuration\Middleware::$priority` | `Middleware::priorityList` — рядом метод `priority()` |
| `Foundation\Configuration\Middleware::use()` | `Middleware::useMiddleware()` — `use` в TypeScript занято |

Публичные методы (`instance()`, `resolved()`, `hasBeenBootstrapped()`,
`booted()`, `needs()`) сохранили имена.

### Прочее

- `bindMethod` строит ключ как `ИмяКласса@метод`: полного имени с неймспейсом
  в рантайме нет, поэтому одноимённые классы разделят один ключ.
- `tagged()` возвращает `RewindableGenerator`, но резолвит сервисы разом.
- `Dispatcher` не кладёт в массив ответов `nil`, возвращённый слушателем.
- `Config\Repository`: нет `float()` и `collection()`.
- `retry()` спит через `task.wait`, а не `Sleep::usleep`, и повторяет циклом:
  `goto`, которым PHP возвращается к началу попытки, в Luau тоже нет.
- `RemoteLimits` (длина пути, размер и глубина payload) стоят на глаз: замер —
  записанный открытый вопрос дизайна, а не забытая константа.
- `Contracts\Http\Kernel` и `Contracts\Debug\ExceptionHandler` биндятся по
  конкретному классу: интерфейсы стёрты, и это та же сделка, что с
  `Bus\Dispatcher`.
- `ThrottleRequests` ключуется `UserId` игрока и не хэширует его: PHP берёт
  аутентифицированного пользователя, а без него IP.
- `ApplicationBuilder::withRouting()` берёт функцию — это порт формы
  `withRouting(using:)`, которая в PHP тоже не навешивает группу `api` сама.
