/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../TestHelpers';
import { Request } from 'Illuminate/Http/Request';
import { Route } from 'Illuminate/Routing/Route';

/**
 * PHP: `Illuminate\Tests\Http\HttpRequestTest`.
 *
 * `Request::create()` builds a Symfony-shaped request from a URL string; there
 * is no URL here (see `agent_docs/laravel-parity.md`, "Запрос — это вызов
 * ремоута"), so every test below constructs `new Request(player, method,
 * path, input)` directly instead. `game.Players` is not available inside
 * TestEZ (there is no running place), so a plain empty table stands in for
 * the calling `Player` -- nothing exercised here reads it.
 *
 * Not ported, and why:
 *
 * - `testInstanceMethod`, `testRootMethod`, `testUrlMethod`, `testFullUrlMethod`,
 *   `testFullUrlWithoutQueryMethod`, `testFullUrlIsMethod`, `testAjaxMethod`,
 *   `testPrefetchMethod`, `testPjaxMethod`, `testSecureMethod`,
 *   `testUserAgentMethod`, `testHostMethod`, `testHttpHostMethod`,
 *   `testSchemeAndHttpHostMethod` -- all address a URL, headers or the
 *   request scheme, none of which `Request` carries (`instance()` is PHP's own
 *   accessor for the underlying Symfony request, which does not exist here).
 * - `testWhenEnumMethod`, `testEnumMethod`, `testEnumsMethod` -- `enum()`/
 *   `enums()` are not ported (`InteractsWithData.ts`'s doc comment: a
 *   TypeScript enum has no `tryFrom` to key off of).
 * - `testFluentMethod` -- `Fluent` is not ported yet.
 * - `testFloatMethod` -- `float()` is not ported; Luau has one number type,
 *   so `integer()` already covers the distinction PHP draws.
 * - `testDateMethod` and friends, `testIntervalMethod` and friends -- no
 *   Carbon stand-in yet.
 * - `testQueryMethod`, `testPostMethod`, `testCookieMethod`,
 *   `testHasCookieMethod`, `testFileMethod`, `testImageMethod` and its
 *   "missing key" variant, `testHasFileMethod`, `testServerMethod`,
 *   `testHeaderMethod`, `testBearerTokenMethod`, `testJSONMethod` and its
 *   variants -- headers, cookies, files, the `$_SERVER` bag and the raw
 *   request body are not ported; `input()`/`all()` already read directly from
 *   the payload table, so there is no separate query/post/json split to test.
 * - `testAllInputReturnsInputAndFiles`, `testAllInputReturnsNestedInputAndFiles`,
 *   `testInputWithEmptyFilename`, `testMultipleFileUploadWithEmptyValue` --
 *   files.
 * - `testOldMethodCallsSession` and its variants, `testFlushMethodCallsSession`,
 *   `testSessionMethod`, `testHasSessionMethod`,
 *   `testGetSessionMethodWith(out)LaravelSession` -- no session.
 * - `testExpectsJson`, `testFormatReturnsAcceptableFormat`, `testWantsMarkdown`,
 *   `testAcceptsMarkdown`, `testMatchesType`, every `testFormatReturnsAccepts*`,
 *   `testWantsJson*`, `testAcceptsJson*`, `testPrefersMethod`,
 *   `testPrefersRespectsHeaderChanges`, `testCacheClearedWhenTransitioningFromUnsetToSetHeader`,
 *   `testBadAcceptHeader`, `testCaseInsensitiveAcceptHeader` -- content
 *   negotiation off the `Accept` header; not ported (see `Request.ts`'s class
 *   comment).
 * - `testUserResolverMakesUserAvailableAsMagicProperty` -- `user()` waits for
 *   `Illuminate\Auth`.
 * - `testFingerprintMethod`, `testFingerprintWithoutRoute` -- `fingerprint()`
 *   hashes the method, route URI, ip and session token; none of the last two
 *   exist here.
 * - `testJsonRequestFillsRequestBodyParams`, `testNonJsonRequestDoesntFillRequestBodyParams`,
 *   `testGeneratingJsonRequestFromParentRequestUsesCorrectType`,
 *   `testCreatingJsonRequestFromBaseDoesNotTriggerRequestPropertyDeprecation`,
 *   `testJsonRequestsCanMergeDataIntoJsonRequest`, `testItCanHaveObjectsInJsonPayload`,
 *   `testItDoesNotGenerateJsonErrorsForEmptyContent` -- the JSON request body
 *   detection PHP does from `Content-Type`; the payload already arrives as a
 *   table.
 * - `testMagicMethods` -- PHP's `__get()` reaches into `all()`/route
 *   parameters/attributes through property access, which cannot be
 *   intercepted on a Luau class.
 * - `testHttpRequestFlashCallsSessionFlashInputWithInputData` and its
 *   `Only`/`Except` variants -- flash data, no session.
 * - `testItClampsValues` -- `clamp()` waits for `Illuminate\Support\Number`.
 *
 * One systematic adaptation runs through the input-reading tests: **a Luau
 * table cannot hold `nil`**, so an input spelled `{name: undefined}` never
 * gets a `name` key at all -- PHP's *present but null* and *absent* are the
 * same state here. Sub-cases that turn on telling those two apart
 * (`has('foo.bar')` over `['foo' => ['bar' => null]]`, `whenMissing('bar')`
 * over `['bar' => null]`, `offsetExists('name')` over `['name' => null]`) have
 * no counterpart and are dropped; each is marked where it was.
 */

const player = {} as Player;

export = (): void => {
    describe('Http.Request', () => {
        // PHP: HttpRequestTest::testMethodMethod
        it('returns the method it was constructed with, uppercased', () => {
            for (
                const method of [
                    'GET',
                    'HEAD',
                    'POST',
                    'PUT',
                    'PATCH',
                    'DELETE',
                    'OPTIONS',
                ]
            ) {
                const request = new Request(player, method, '');
                expect(request.method()).to.equal(method);
            }
        });

        // PHP: HttpRequestTest::testPathMethod
        it('normalizes the path', () => {
            expect(new Request(player, 'GET', '').path()).to.equal('/');
            expect(new Request(player, 'GET', '/foo/bar').path()).to.equal('foo/bar');
        });

        // PHP: HttpRequestTest::testDecodedPathMethod
        it('has no percent-decoding to do, so decodedPath() is path()', () => {
            expect(new Request(player, 'GET', '/foo bar').decodedPath()).to.equal('foo bar');
        });

        // PHP: HttpRequestTest::testSegmentMethod (data provider inlined)
        it('returns a single 1-indexed segment, or the default', () => {
            expect(new Request(player, 'GET', '').segment(1, 'default')).to.equal('default');
            expect(new Request(player, 'GET', 'foo/bar//baz').segment(1)).to.equal('foo');
            expect(new Request(player, 'GET', 'foo/bar//baz').segment(2)).to.equal('bar');
            expect(new Request(player, 'GET', 'foo/bar//baz').segment(3)).to.equal('baz');
        });

        // PHP: HttpRequestTest::testSegmentsMethod (data provider inlined)
        it('returns every path segment', () => {
            expect(new Request(player, 'GET', '').segments().size()).to.equal(0);
            expectDeepEqual(new Request(player, 'GET', 'foo/bar').segments(), [
                'foo',
                'bar',
            ]);
            expectDeepEqual(new Request(player, 'GET', 'foo/bar//baz').segments(), [
                'foo',
                'bar',
                'baz',
            ]);
            expectDeepEqual(new Request(player, 'GET', 'foo/0/bar').segments(), [
                'foo',
                '0',
                'bar',
            ]);
        });

        // PHP: HttpRequestTest::testIsMethod
        it('matches the decoded path against wildcard patterns', () => {
            let request = new Request(player, 'GET', '/foo/bar');

            expect(request.is('foo*')).to.equal(true);
            expect(request.is('bar*')).to.equal(false);
            expect(request.is('*bar*')).to.equal(true);
            expect(request.is('bar*', 'foo*', 'baz')).to.equal(true);

            request = new Request(player, 'GET', '/');
            expect(request.is('/')).to.equal(true);
        });

        // PHP: HttpRequestTest::testRouteIsMethod
        it("matches the bound route's name against wildcard patterns", () => {
            const request = new Request(player, 'GET', '/foo/bar');

            expect(request.routeIs('foo.bar')).to.equal(false);

            request.setRouteResolver(() => {
                const route = new Route('GET', '/foo/bar', { as: 'foo.bar' });
                route.bind(request);

                return route;
            });

            expect(request.routeIs('foo.bar')).to.equal(true);
            expect(request.routeIs('foo*', '*bar')).to.equal(true);
            expect(request.routeIs('foo.foo')).to.equal(false);
        });

        // PHP: HttpRequestTest::testRouteMethod
        it("reads a bound route's parameters", () => {
            const request = new Request(player, 'GET', '/foo/bar');

            request.setRouteResolver(() => {
                const route = new Route('GET', '/foo/{required}/{optional?}', {});
                route.bind(request);

                return route;
            });

            expect(request.route('required')).to.equal('bar');
            expect(request.route('required', 'default')).to.equal('bar');
            expect(request.route('optional')).to.equal(undefined);
            expect(request.route('optional', 'default')).to.equal('default');
        });

        // PHP: HttpRequestTest::testHasMethod
        it('has() reports a key present even when its value is empty', () => {
            let request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });
            expect(request.has('name')).to.equal(true);
            expect(request.has('age')).to.equal(true);
            expect(request.has('foo')).to.equal(false);
            expect(request.has([
                'name',
                'email',
            ])).to.equal(false);

            request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                email: 'foo',
            });
            expect(request.has('name')).to.equal(true);
            expect(request.has([
                'name',
                'email',
            ])).to.equal(true);

            request = new Request(player, 'GET', '/', {
                foo: [
                    'bar',
                    'bar',
                ],
            });
            expect(request.has('foo')).to.equal(true);

            // PHP's fixture is `['foo' => ['bar' => null, 'baz' => '']]`; the
            // `bar` key cannot exist here, so its sub-case is dropped -- see
            // the class comment.
            request = new Request(player, 'GET', '/', {
                foo: { baz: '' },
            });
            expect(request.has('foo.baz')).to.equal(true);
        });

        // PHP: HttpRequestTest::testWhenHasMethod
        it('whenHas() runs the callback with the value, or the default callback when missing', () => {
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });

            let name: unknown = false;
            let bar: unknown = false;

            request.whenHas('name', (value) => {
                name = value;

                return true;
            });

            request.whenHas(
                'bar',
                () => {
                    bar = 'test';

                    return true;
                },
                () => {
                    bar = true;

                    return true;
                },
            );

            expect(name).to.equal('Taylor');
            expect(bar).to.equal(true);
        });

        // PHP: HttpRequestTest::testWhenFilledMethod
        it('whenFilled() only runs the callback for a non-empty value', () => {
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });

            let name: unknown = false;
            let age: unknown = false;

            request.whenFilled('name', (value) => {
                name = value;

                return true;
            });

            request.whenFilled('age', () => {
                age = 'test';

                return true;
            });

            expect(name).to.equal('Taylor');
            expect(age).to.equal(false);
        });

        // PHP: HttpRequestTest::testMissingMethod
        it('missing() is the negation of has()', () => {
            let request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });
            expect(request.missing('name')).to.equal(false);
            expect(request.missing('foo')).to.equal(true);
            expect(request.missing([
                'name',
                'email',
            ])).to.equal(true);

            request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                email: 'foo',
            });
            expect(request.missing('name')).to.equal(false);
        });

        // PHP: HttpRequestTest::testWhenMissingMethod
        it('whenMissing() runs the callback only when the key is absent', () => {
            // PHP builds the request from `['bar' => null]` and asserts that
            // `bar` is *not* missing. That distinction does not exist here
            // (class comment), so the input carries a real value instead.
            const request = new Request(player, 'GET', '/', { bar: 'baz' });

            let name: unknown = true;
            let bar: unknown = true;

            request.whenMissing('name', () => {
                name = 'Taylor';

                return true;
            });

            request.whenMissing(
                'bar',
                () => {
                    bar = 'test';

                    return true;
                },
                () => {
                    bar = true;

                    return true;
                },
            );

            expect(name).to.equal('Taylor');
            expect(bar).to.equal(true);
        });

        // PHP: HttpRequestTest::testHasAnyMethod
        it('hasAny() reports true when any of the keys is present', () => {
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });
            expect(request.hasAny('name')).to.equal(true);
            expect(request.hasAny('foo')).to.equal(false);
            expect(request.hasAny([
                'name',
                'email',
            ])).to.equal(true);
        });

        // PHP: HttpRequestTest::testFilledMethod
        it('filled() reports true only for a non-empty value', () => {
            let request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });
            expect(request.filled('name')).to.equal(true);
            expect(request.filled('age')).to.equal(false);
            expect(request.filled('city')).to.equal(false);
            expect(request.filled('foo')).to.equal(false);

            request = new Request(player, 'GET', '/', {
                foo: [
                    'bar',
                    'baz',
                ],
            });
            expect(request.filled('foo')).to.equal(true);

            request = new Request(player, 'GET', '/', { foo: { bar: 'baz' } });
            expect(request.filled('foo.bar')).to.equal(true);
        });

        // PHP: HttpRequestTest::testIsNotFilledMethod
        it('isNotFilled() is the negation of filled()', () => {
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });
            expect(request.isNotFilled('name')).to.equal(false);
            expect(request.isNotFilled('age')).to.equal(true);
            expect(request.isNotFilled('city')).to.equal(true);
            expect(request.isNotFilled('foo')).to.equal(true);
        });

        // PHP: HttpRequestTest::testFilledAnyMethod
        it('anyFilled() reports true when any of the keys is filled', () => {
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
                city: undefined,
            });
            expect(request.anyFilled(['name'])).to.equal(true);
            expect(request.anyFilled(['age'])).to.equal(false);
            expect(request.anyFilled([
                'age',
                'name',
            ])).to.equal(true);
            expect(request.anyFilled([
                'foo',
                'bar',
            ])).to.equal(false);
        });

        // PHP: HttpRequestTest::testInputMethod
        it('input() reads a single value with a default', () => {
            const request = new Request(player, 'GET', '/', { name: 'Taylor' });
            expect(request.input('name')).to.equal('Taylor');
            expect(request.input('foo', 'Bob')).to.equal('Bob');
        });

        // PHP: HttpRequestTest::testStringMethod
        it('string() wraps a value as a Stringable', () => {
            const request = new Request(player, 'GET', '/', {
                int: 123,
                int_str: '456',
                str: 'abc',
                empty_str: '',
            });

            expect(request.string('int').value()).to.equal('123');
            expect(request.string('int_str').value()).to.equal('456');
            expect(request.string('empty_str').value()).to.equal('');
            expect(request.string('unknown_key').value()).to.equal('');
        });

        // PHP: HttpRequestTest::testBooleanMethod
        it('boolean() reads the FILTER_VALIDATE_BOOLEAN vocabulary', () => {
            const request = new Request(player, 'GET', '/', {
                with_trashed: 'false',
                download: true,
                checked: 1,
                unchecked: '0',
                with_on: 'on',
                with_yes: 'yes',
            });

            expect(request.boolean('checked')).to.equal(true);
            expect(request.boolean('download')).to.equal(true);
            expect(request.boolean('unchecked')).to.equal(false);
            expect(request.boolean('with_trashed')).to.equal(false);
            expect(request.boolean('some_undefined_key')).to.equal(false);
            expect(request.boolean('with_on')).to.equal(true);
            expect(request.boolean('with_yes')).to.equal(true);
        });

        // PHP: HttpRequestTest::testIntegerMethod
        it('integer() truncates towards zero and falls back to 0', () => {
            const request = new Request(player, 'GET', '/', {
                int: '123',
                raw_int: 456,
                zero_padded: '078',
                space_padded: ' 901',
                nan: 'nan',
            });

            expect(request.integer('int')).to.equal(123);
            expect(request.integer('raw_int')).to.equal(456);
            expect(request.integer('zero_padded')).to.equal(78);
            expect(request.integer('space_padded')).to.equal(901);
            expect(request.integer('nan')).to.equal(0);
            expect(request.integer('unknown_key', 123456)).to.equal(123456);
        });

        // PHP: HttpRequestTest::testArrayMethod
        it('array() wraps a scalar and passes an already-accessible value through', () => {
            let request = new Request(player, 'GET', '/', {});
            expect((request.array() as Array<unknown>).size()).to.equal(0);

            request = new Request(player, 'GET', '/', {
                users: [
                    1,
                    2,
                    3,
                ],
                roles: [
                    4,
                    5,
                    6,
                ],
                email: 'test@example.com',
            });

            expectDeepEqual(request.array('missing'), []);
            expectDeepEqual(request.array('users'), [
                1,
                2,
                3,
            ]);
            expectDeepEqual(request.array(['users']), {
                users: [
                    1,
                    2,
                    3,
                ],
            });
        });

        // PHP: HttpRequestTest::testCollectMethod
        it('collect() wraps input as a Collection', () => {
            let request = new Request(player, 'GET', '/', {
                users: [
                    1,
                    2,
                    3,
                ],
            });
            expectDeepEqual(request.collect('users').all(), [
                1,
                2,
                3,
            ]);
            expect(request.collect('developers').isEmpty()).to.equal(true);
            expectDeepEqual(request.collect().all(), [
                [
                    1,
                    2,
                    3,
                ],
            ]);

            request = new Request(player, 'GET', '/', {});
            expect(request.collect().isEmpty()).to.equal(true);
        });

        // PHP: HttpRequestTest::testArrayAccess, testArrayAccessWithoutRouteResolver
        it('supports table-index access through the ArrayAccessible offset methods', () => {
            // PHP's fixture is `['name' => null, 'foo' => ['bar' => null,
            // 'baz' => '']]`; the two null-valued keys cannot exist here, so
            // their sub-cases are dropped -- see the class comment.
            const request = new Request(player, 'GET', '/', {
                foo: { baz: '' },
            });

            expect(request.offsetExists('non-existent')).to.equal(false);
            expect(request.offsetGet('non-existent')).to.equal(undefined);

            expect(request.offsetExists('foo.baz')).to.equal(true);
            expect(request.offsetGet('foo.baz')).to.equal('');

            // No route resolver has been set: offsetGet still answers from input.
            const plain = new Request(player, 'GET', '/', { name: 'Taylor' });
            expect(plain.offsetGet('name')).to.equal('Taylor');
        });

        // PHP: HttpRequestTest::testAllMethod
        it('all() fills requested keys with undefined and returns everything without keys', () => {
            let request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: undefined,
            });
            expectDeepEqual(
                request.all([
                    'name',
                    'age',
                    'email',
                ]),
                {
                    name: 'Taylor',
                    age: undefined,
                    email: undefined,
                },
            );
            expectDeepEqual(request.all('name'), { name: 'Taylor' });
            expectDeepEqual(request.all(), { name: 'Taylor', age: undefined });

            request = new Request(player, 'GET', '/', {
                developer: { name: 'Taylor', age: undefined },
            });
            expectDeepEqual(
                request.all([
                    'developer.name',
                    'developer.skills',
                ]),
                {
                    developer: { name: 'Taylor', skills: undefined },
                },
            );
        });

        // PHP: HttpRequestTest::testKeysMethod
        it('keys() lists the input keys', () => {
            // PHP's fixture is `['name' => 'Taylor', 'age' => null]`; `age`
            // cannot be a key at all here (class comment), so it carries a
            // value -- what is under test is that both names come back.
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: '',
            });
            const keys = request.keys();

            expect(keys.includes('name')).to.equal(true);
            expect(keys.includes('age')).to.equal(true);
            expect(keys.size()).to.equal(2);
        });

        // PHP: HttpRequestTest::testOnlyMethod
        it('only() keeps just the requested keys', () => {
            let request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: undefined,
            });
            expectDeepEqual(
                request.only([
                    'name',
                    'age',
                    'email',
                ]),
                {
                    name: 'Taylor',
                    age: undefined,
                },
            );

            request = new Request(player, 'GET', '/', {
                developer: { name: 'Taylor', age: undefined },
            });
            expectDeepEqual(request.only('developer.name'), {
                developer: { name: 'Taylor' },
            });
            expectDeepEqual(request.only('developer.skills'), {});
        });

        // PHP: HttpRequestTest::testExceptMethod
        it('except() drops the requested keys', () => {
            const request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                age: 25,
            });
            expectDeepEqual(request.except('age'), { name: 'Taylor' });
            expectDeepEqual(
                request.except([
                    'age',
                    'name',
                ]),
                {},
            );
        });

        // PHP: HttpRequestTest::testMergeMethod
        it('merge() adds input without disturbing existing keys', () => {
            const request = new Request(player, 'GET', '/', { name: 'Taylor' });
            request.merge({ buddy: 'Dayle' });
            expect(request.input('name')).to.equal('Taylor');
            expect(request.input('buddy')).to.equal('Dayle');
        });

        // PHP: HttpRequestTest::testMergeIfMissingMethod
        it('mergeIfMissing() only fills in keys that are absent', () => {
            let request = new Request(player, 'GET', '/', { name: 'Taylor' });
            request.mergeIfMissing({ boolean_setting: 0 });
            expect(request.input('boolean_setting')).to.equal(0);

            request = new Request(player, 'GET', '/', {
                name: 'Taylor',
                boolean_setting: 1,
            });
            request.mergeIfMissing({ boolean_setting: 0 });
            expect(request.input('boolean_setting')).to.equal(1);

            request = new Request(player, 'GET', '/', {
                user: { first_name: 'Taylor', email: 'taylor@laravel.com' },
            });
            request.mergeIfMissing({ 'user.last_name': 'Otwell' });
            expect(request.input('user.last_name')).to.equal('Otwell');
        });

        // PHP: HttpRequestTest::testReplaceMethod
        it('replace() swaps out the entire input source', () => {
            const request = new Request(player, 'GET', '/', { name: 'Taylor' });
            request.replace({ buddy: 'Dayle' });
            expect(request.input('name')).to.equal(undefined);
            expect(request.input('buddy')).to.equal('Dayle');
        });

        // PHP: HttpRequestTest::testOffsetUnsetMethod
        it('offsetUnset() removes a key from the input source', () => {
            const request = new Request(player, 'HEAD', '/', {
                name: 'Taylor',
            });
            request.offsetUnset('name');
            expect(request.input('name')).to.equal(undefined);
        });
    });
};
