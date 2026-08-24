# Роутинг поверх ремоутов — дизайн

Отвечает на вопрос, помеченный в `porting-plan.md` как «требует решения»: что
считать запросом, как выглядят `Request`/`Response`, где живут маршруты, как
ложатся контроллеры и middleware, как делится сервер и клиент.

Это документ решений, а не отчёт о сделанном. Код — после согласования.

---

## Что даёт платформа

Проверено по `@rbxts/types` (`include/generated/None.d.ts`):

- `RemoteEvent:FireServer(...)` — клиент → сервер, без ответа. На сервере
  `OnServerEvent:Connect((player, ...args))`, и **первый аргумент подставляет
  движок**: игрока подделать с клиента нельзя.
- `RemoteFunction:InvokeServer(...)` — вызов с ответом, клиентский поток ждёт.
  На сервере `OnServerInvoke` — **свойство, а не сигнал**: обработчик ровно
  один на ремоут.
- `RemoteFunction:InvokeClient(player, ...)` — сервер ждёт клиента, который
  может не ответить никогда (вышел, ошибка в обработчике). Поток висит.
  Использовать нельзя.
- `UnreliableRemoteEvent` — без гарантий доставки и порядка, **лимит 1000 байт**
  на пейлоад; больше — пакет молча дропается.
- Через границу проходят только сериализуемые значения: без функций, без
  метатаблиц (экземпляр класса приедет голой таблицей), без циклов, без
  смешанных ключей в одной таблице. `Instance` идёт по ссылке, если он
  реплицирован этому клиенту.

Два следствия определяют всё остальное. Обработчик у `RemoteFunction` один —
значит, диспетчер по определению центральный, и «ремоут на маршрут» не убирает
общую точку входа, а только размножает Instance. И объект команды через границу
не поедет — поедут только данные; это то же ограничение, что у `memorystore` в
очередях, и решается оно уже существующим `Support/Serializer`.

---

## Решение 1. Запрос — это конверт, а не ремоут

Три ремоута-шлюза, объявленные в дереве Rojo (`ReplicatedStorage/Larablox`), а
не создаваемые в рантайме: тогда они существуют до первого скрипта и на клиенте
не нужен `WaitForChild` с гонкой.

| Instance | Класс | Роль | Транспорт в конверте |
|---|---|---|---|
| `Call` | `RemoteFunction` | запрос с ответом | `call` |
| `Send` | `RemoteEvent` | запрос без ответа | `send` |
| `Stream` | `UnreliableRemoteEvent` | поток, ≤1000 байт | `stream` |

Конверт — позиционные аргументы `(method, uri, data)`, без обёртки в таблицу:
`InvokeServer("POST", "shop/buy/42", { qty: 2 })`.

**Глаголы остаются HTTP-шными** — `get`, `post`, `put`, `patch`, `delete`,
`options`, `any`, `match`. Они не про протокол, а про семантику операции, и
именно на них завязаны `Router`, `RouteCollection::match` и весь публичный API
Laravel. Менять их — переписывать компонент, а не портировать.

Транспорт — **вторая ось**, ортогональная глаголу, и это ровно то место, где в
Laravel стоит схема (`http`/`https`):

- маршрут, объявленный обычным глаголом, доступен по `call` и по `send`
  (в случае `send` ответ формируется и выбрасывается — аналог оборванного
  соединения);
- `Route.stream(uri, action)` объявляет маршрут, доступный **только** по
  `stream`: там другой контракт — 1000 байт, без гарантий, без ответа;
- `->reliable()` на маршруте запрещает `send` — порт `httpsOnly()`.

Проверяет это `Matching/TransportValidator` рядом с `MethodValidator` и
`UriValidator`; `HostValidator` и `SchemeValidator` не портируются.

**Почему не ремоут на маршрут.** Обработчик `RemoteFunction` всё равно один, так
что центральный диспетчер никуда не девается; зато дерево `ReplicatedStorage`
становится частью API, параметризованные маршруты (`shop/buy/{item}`) в имена
Instance не ложатся, а каждый новый маршрут требует правки проектного файла и
перезапуска `rojo serve`. Единственное, что теряется, — типизация «на ремоут»,
и её возвращает типизированный клиент (решение 5).

---

## Решение 2. Request и Response

### `Illuminate\Http\Request`

Собирается шлюзом из `(player, method, uri, data)`. Symfony под ним нет, поэтому
класс свой, а не наследник.

Портируется: `method`, `path`, `segment`, `segments`, `is`, `input`, `all`,
`keys`, `has`, `hasAny`, `filled`, `missing`, `boolean`, `integer`, `string`,
`only`, `except`, `collect`, `merge`, `mergeIfMissing`, `replace`, `toArray`,
`offsetExists`/`offsetGet`/`offsetSet`/`offsetUnset` — то есть
`InteractsWithInput`, а под ним `Support\Traits\InteractsWithData`, который в
PHP делят между собой `Request`, `Fluent` и `ValidatedInput`.

Данные лежат **обычной таблицей, не `OrderedMap`**: пейлоад приезжает из-за
границы ремоута уже неупорядоченным, и заворачивать его в упорядоченную
структуру значило бы выдумать порядок, которого не было. `Arr` и `data_get`
работают ровно с такой таблицей.

`route()` и резолвер маршрута приезжают вместе с `Illuminate\Routing`, `user()`
— вместе с `Auth`; `uri()` в Laravel 13 возвращает `Support\Uri`, которого нет,
поэтому путь отдаёт `path()`.

Добавляется одно: **`player(): Player`**. Это и адрес отправителя, и
идентичность — в PHP её роль делят `ip()`, сессия и `user()`. Сюда потом сядет
`Auth`, а `fingerprint()` считается от `UserId` вместо IP.

Не портируется: заголовки, куки, файлы, сессия, `host`/`scheme`/`url`/`fullUrl`,
`ajax`/`pjax`/`prefetch`/`secure`, `getAcceptableContentTypes`, `json`/`setJson`
(данные и так таблица). `bearerToken` — вместе с Auth, если понадобится.

### `Illuminate\Http\Response`

`content` + `status` + `headers`. Заголовки без HTTP выглядят лишними, но их
пишут портируемые middleware (`ThrottleRequests` кладёт `X-RateLimit-*`), и
стоят они дёшево.

Коды остаются HTTP-шными — это общий словарь, который дальше понадобится
`Validation`, `Auth` и клиенту:

| Код | Когда |
|---|---|
| 200 | ответ есть |
| 204 | маршрут отработал, но транспорт `send` |
| 403 | middleware не пустил |
| 404 | маршрут не найден |
| 405 | глагол или транспорт не тот |
| 422 | валидация (позже) |
| 429 | `throttle` |
| 500 | исключение в обработчике |
| 503 | приложение ещё не `booted` |

Через границу ответ уезжает плоской таблицей `(status, data, headers)` и на
клиенте разворачивается в `Http\Client\Response`.

`ResponseFactory` и хелпер `response()` портируются в урезанном виде: `make`,
`json` (здесь это то же самое, что `make`), `noContent`. `RedirectResponse`,
`view`, `download`, `stream` — не портируются.

---

## Решение 3. Где живут маршруты

Файловой системы нет, поэтому «файл маршрутов» — модуль, экспортирующий функцию:

```ts
// src/server/routes/api.ts
export function api(): void {
    Route.middleware(["throttle:60,1"]).group(() => {
        Route.post("shop/buy/{item}", [ShopController, "buy"]).name("shop.buy");
        Route.get("shop/items", [ShopController, "index"]);
        Route.stream("player/input", [InputController, "receive"]);
    });
}
```

Регистрируется двумя путями, как и в Laravel:

- `Application.configure().withRouting({ api })` — идиома 11+;
- свой `RouteServiceProvider` с вызовом `api()` в `boot()` — для тех, кому нужны
  паттерны, биндинги и лимитеры рядом с маршрутами.

`RouteFileRegistrar` и `loadRoutesFrom()` теряют смысл: грузить нечего, функция
уже импортирована.

Роутер регистрирует `RoutingServiceProvider` — **только в серверном
приложении**. `src/Illuminate/Routing` реплицируется всюду (как весь фреймворк),
но на клиенте боотится не он, а `Http\Client`.

---

## Решение 4. Экшены, параметры, middleware

### Экшен

```ts
Route.post("shop/buy/{item}", [ShopController, "buy"]);   // [Controller::class, 'method']
Route.get("ping", () => "pong");                          // замыкание
```

Строковая форма `"ShopController@buy"` не портируется — автозагрузки по имени
класса нет. (Реестр `Support/Serializer` умеет имя → класс; если строки
понадобятся, они лягут на него, но по умолчанию — нет.)

Замыкание в экшене, в отличие от очередей, законно: маршруты регистрируются на
сервере при загрузке и границу не пересекают.

### Параметры

Имена параметров стёрты, `RouteSignatureParameters` неоткуда взять. Правило,
которое из этого вышло (реализовано в `ResolvesRouteDependencies`):

> **аннотированные параметры идут первыми, за ними параметры маршрута — в том
> порядке, в каком их называет URI.**

- `@Inject(Abstract)` резолвит зависимость из контейнера;
- `@RouteParameter("item")` берёт параметр маршрута по имени — это не выдумка,
  а портированный атрибут Laravel `Container\Attributes\RouteParameter`
  (первоначально в этом документе он назывался `@Param`);
- параметры без декоратора получают значения по порядку — ровно как PHP-шный
  `Controller::callAction($method, $parameters)` делает
  `...array_values($parameters)`.

Другого порядка и быть не могло: контейнер отказывается собирать список
аргументов, где аннотированный параметр стоит после неаннотированного —
дырку в списке аргументов Luau не хранит.

**Замыкание — отдельный случай.** Декоратор к параметру замыкания не
прикрепить, сигнатуры нет, читать нечего. Поэтому список фиксирован: **сначала
запрос, потом параметры маршрута**.

```ts
Route.get("shop/{item}", (request, item) => ...);
```

PHP делает то же самое, только узнаёт про `Request` из тайп-хинта. Замыканию,
которому нужно что-то ещё, место в контроллере.

### Сопоставление пути

Symfony компилирует URI в одно регулярное выражение; здесь его нет, поэтому
`CompiledRoute` режет URI на сегменты и идёт по ним. Отсюда три правила,
которые стоит знать до того, как писать маршрут:

- **параметр занимает сегмент целиком.** `posts/{post}` — да,
  `posts/post-{id}` — нет: при регистрации маршрут откажется компилироваться;
- **необязательные параметры только в конце** (этого же требует и Symfony);
- **паттерн `where` проверяется против одного сегмента** — кроме последнего
  параметра: тот забирает весь остаток пути (сколько угодно сегментов или
  ничего), и паттерн судит уже его. Так работает `where("path", ".*")`, и на
  этом же собран `Route::fallback()` — как и в PHP, где он и есть
  `{fallbackPlaceholder}` с `.*`. Последний параметр без паттерна берёт ровно
  один сегмент: отказать остатку было бы нечем.

### Middleware

Ложится на портированный `Pipeline` без изменений; имя второго параметра —
`_next` (конвенция проекта, см. `roblox-ts-constraints.md`).

Портируются: алиасы (`aliasMiddleware`), группы (`middlewareGroup`,
`prependMiddlewareToGroup`, `pushMiddlewareToGroup`), приоритет
(`SortedMiddleware`), `withoutMiddleware`, middleware контроллера,
`gatherRouteMiddleware`.

Из готовых middleware:

- `ThrottleRequests` — поверх уже портированного `RateLimiter`. Не украшение:
  без него клиент крутит `InvokeServer` в цикле и кладёт сервер;
- `SubstituteBindings` — поверх `Route::bind()`. Неявный биндинг моделей ждёт
  Database, но один неявный можно дать сразу: `{player}` →
  `Players:GetPlayerByUserId`;
- `ValidateSignature` не портируется (подписанных URL нет), CSRF не нужен.

`Controller` базовый портируется целиком: `middleware()`, `getMiddleware()`,
`callAction()`.

---

## Решение 5. Клиент — это `Illuminate\Http\Client`

Симметрия, которая уже есть в Laravel: входящее — `Routing` + `Http\Request`,
исходящее — `Http\Client` с фасадом `Http`. Клиентское приложение вызывает
сервер тем же API, каким PHP ходит наружу:

```ts
const response = Http.post("shop/buy/42", { qty: 2 });

if (response.ok()) {
    print(response.json());
} else if (response.status() === 429) {
    // ...
}
```

Портируются: `PendingRequest` (`get`, `post`, `put`, `patch`, `delete`, `send`,
`retry`, `throw`, `throwIf`), `Response` (`status`, `ok`, `successful`,
`failed`, `clientError`, `serverError`, `json`, `body`, `collect`, `header`,
`onError`, `toException`, `throw`, `throwIf`, `throwIfStatus` и трейт
`DeterminesStatusCode`), `Factory`, исключения `RequestException` и
`ConnectionException`.

`timeout()` **не портируется**: зависший `InvokeServer` отменить нечем, и
таймаут был бы враньём. Ретраи при этом работают — они срабатывают на
`ConnectionException` и на неуспешном ответе, ровно как в PHP, где неуспешный
ответ превращается в исключение, чтобы его увидел `retry()`.

Транспорт выбирает сам вызов: `get`/`post`/… идут через `Call`,
`->withoutWaiting()` — через `Send` (ответа нет, возвращается `204`),
`->unreliable()` — через `Stream`. Ремоуты в игровом коде не упоминаются вовсе.
Обе эти формы — добавка без аналога в PHP, как и `player()` у запроса.

`Http::fake()`, пулы и промисы — вместе с тестами, которых в проекте нет.

---

## Решение 6. Сервер → клиент — не роутинг

`InvokeClient` запрещён (висящий поток), значит с сервера доступен только push
без ответа. Это не маршрут, а вещание, и его место — будущий `Broadcasting`, а
не `Routing`. В дереве Rojo стоит сразу завести четвёртый ремоут `Push`
(`RemoteEvent`, сервер → клиент), чтобы клиентское приложение могло слушать, но
в этот этап он не входит.

---

## Безопасность

Периметр здесь один и он тонкий, поэтому правила лучше зафиксировать до кода:

1. Игрок берётся из аргумента движка, никогда из пейлоада.
2. Всё пришедшее — недоверенные данные. До `Validation` шлюз проверяет минимум:
   тип конверта, длину `uri`, размер и глубину таблицы данных — **до**
   маршрутизации, чтобы дорогая работа не начиналась вовсе.
3. `throttle` вешается на корневую группу по умолчанию.
4. Исключение наружу отдаётся как `500` без текста; текст и трейс уходят в
   `Log` — сообщение об ошибке серверного кода не должно попадать клиенту.
5. Запрос до `booted` получает `503`, а не падение.

---

## Чего не будет

- `UrlGenerator`, `RouteUrlGenerator`, `Redirector`, `RedirectResponse`,
  `redirect()`, `permanentRedirect()` — адресов нет, перенаправлять некуда;
- домены, поддомены, схемы (`domain`, `secure`, `HostValidator`,
  `SchemeValidator`);
- `CompiledRouteCollection` и Symfony-компиляция маршрутов: матчинг свой, на
  паттернах Luau. Следствие — `where()` ограничен возможностями паттернов
  (нет альтернативы `|`, групповых квантификаторов, lookaround);
- `ViewController`, `view()`, `Route::view` — вида нет;
- куки, сессии, `CanBePrecognitive`, `UploadedFile`, `StreamedEvent`;
- `Console` (`route:list`, `route:cache`) — нет консоли.

Портируется, но не в первый этап: `fallback`, `Routing/Events/*` и
`Foundation\Http\Kernel` с глобальными middleware и `terminate()` — всё это
написано в этапах 2 и 5. Остаётся `ResourceRegistrar` (`Route::resource`,
`apiResource`, `singleton`) с `PendingResourceRegistration` — этап 6.

---

## Этапы

1. **Транспорт — написан.** Ремоуты `Call`/`Send`/`Stream`/`Push` в дереве Rojo,
   `Http/Remote` (поиск инстансов, конверт, лимиты), `Http/RemoteGateway`,
   `Http/Request`, `Http/Response`, `Http/Client/*` + фасад `Http`,
   `Foundation/Providers/FoundationServiceProvider` (синглтон клиента). Заодно
   приехали `Support/Traits/InteractsWithData` и хелпер `retry()`.
   Шлюз лежит в `Http`, а не в `Routing`: о маршрутах он ничего не знает, а
   клиентский транспорт иначе тянул бы `Routing` ради общего конверта.
   Критерий — эхо-запрос отвечает клиенту, минуя роутер.
2. **Ядро — написано.** `Route`, `RouteCollection` (+`AbstractRouteCollection`),
   `Router`, `RouteRegistrar`, `RouteGroup`, `RouteUri`, `RouteAction`,
   `RouteParameterBinder`, `CompiledRoute`, `Matching/*`,
   `RoutingServiceProvider` (базовый провайдер, как в Laravel), `withRouting`,
   фасад `Route`, четыре события. Заодно — `Http/Exceptions/*` и
   `Contracts/Support/Responsable`.
3. **Диспетчеризация — написана.** `ControllerDispatcher`,
   `CallableDispatcher`, `ResolvesRouteDependencies`, `Controller`, и вместо
   выдуманного `@Param` — портированный `Container/Attributes/RouteParameter`,
   который в Laravel ровно для этого и есть.
4. **Middleware — написан.** Алиасы, группы, `withoutMiddleware`, приоритет
   (`SortedMiddleware`), `SubstituteBindings` поверх `Route::bind()` и
   `ThrottleRequests` поверх `RateLimiter`. Неявный биндинг моделей остаётся за
   базой данных.

   Одна вещь потребовала правки в `Pipeline`. PHP передаёт пайплайну строку
   `"Class:60,1"` — класс там и есть строка. Здесь алиас указывает на сам класс,
   к которому суффикс не приклеить, поэтому аргументы едут рядом:
   `[ThrottleRequests, "60", "1"]`. `Pipeline::parsePipeString()` читает эту
   форму так же, как читал строку.
5. **Ядро приложения — написано.** `Foundation\Http\Kernel` (+контракт),
   `Foundation\Exceptions\{Handler,ReportableHandler}` (+контракт
   `Contracts\Debug\ExceptionHandler`), `Foundation\Configuration\{Middleware,
   Exceptions}` и `withKernels`/`withMiddleware`/`withExceptions` у билдера,
   события `RequestHandled` и `Terminating`, `Routing\Pipeline`.

   Точка входа стала тем, чем в PHP является `public/index.php`: резолвит ядро,
   бутстрапит его и отдаёт `handle()` шлюзу. Два места разошлись с PHP, и оба —
   про то, что процесс переживает запрос: `bootstrap()` зовётся один раз на
   старте (провайдерам есть что делать до первого вызова — тому же воркеру
   очереди), а `terminate()` уезжает в `task.defer`, потому что «отправить
   ответ» здесь означает «вернуть его».

   Обработчик забрал у шлюза статус исключения — и не только его: теперь тело
   ответа при `app.debug` несёт `{message, exception}`, 404 и 405 не попадают в
   лог (`internalDontReport`), а 500 попадает вместе с `UserId` игрока в
   контексте. `Routing\Pipeline` превращает исключение в ответ **внутри** лукового
   пайплайна, поэтому middleware снаружи бросившего дописывают свои заголовки:
   404 от биндера приезжает с `X-RateLimit-*`.

   Списки алиасов, групп и приоритета переехали из `AppServiceProvider`
   приложения в ядро, как и в PHP. Группа `web` не переехала (куки, сессии,
   CSRF, вьюхи), глобальный список пуст (весь список PHP — про веб-сервер), а
   `api` осталась: каждый запрос по ремоуту — это она.
6. **Дальше.** `Validation` → `FormRequest`; `Auth` поверх `request.player()`.

---

## Открытые вопросы

Решено 22.08.2026:

1. **Глаголы — HTTP-шные.** `get`, `post`, `put`, `patch`, `delete`, `options`,
   `any`, `match`; транспорт остаётся второй осью, как схема в Laravel.
2. **`Route::resource` портируем после ядра.** Это сахар над семью обычными
   маршрутами, и ставить его не на что, пока нет `Route`, `Router` и
   `RouteRegistrar`. Этап 6, вместе с `PendingResourceRegistration`.
4. **Границы шлюза замеряем, а не назначаем.** Максимальная длина `uri`, размер
   данных, глубина таблицы — замер на этапе 1, до того как шлюз попадёт в
   игровой код.

3. **Сервер → клиент — вещание, не маршруты.** Был выбор. Симметричный роутер:
   клиент поднимает свой `Router`, сервер шлёт в `Push` тот же конверт
   `(method, uri, data)`, клиент матчит по своей таблице и зовёт свой
   контроллер. Или `Broadcasting`: сервер вещает событие в канал
   (`Channel`, `PrivateChannel`, `PresenceChannel`), клиент слушает его уже
   портированным `Events\Dispatcher`, а `Support/Serializer` разворачивает имя
   события обратно в класс — ровно тем же механизмом, каким это делают очереди.

   Выбрано вещание: клиентского роутера у Laravel нет вовсе (server → browser
   там устроен именно через `ShouldBroadcast` и Echo), принимающая сторона на
   клиенте уже написана, а пайплайн middleware на доверенном источнике пустой.
   Каналы при этом дают то, чего у роутера нет: выбор адресата (`FireClient`,
   `FireAllClients`, группа игроков) описан данными, а не ручным вызовом на
   каждой отправке. Цена — нет одного файла со списком входов «сервер →
   клиент»; лечится картой событий в `EventServiceProvider` (в PHP это
   `$listen`, в порте её пока нет).

   `Broadcasting` — отдельный компонент после `Routing`; в этап 1 входит только
   ремоут `Push` в дереве.
