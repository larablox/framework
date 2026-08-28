/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual, expectThrows } from '../TestHelpers';
import {
    blank,
    class_basename,
    data_fill,
    data_forget,
    data_get,
    data_has,
    data_set,
    filled,
    head,
    last,
    optional,
    retry,
    str,
    tap,
    throw_if,
    throw_unless,
    transform,
    value,
    when,
    _with,
} from 'Illuminate/Support/Helpers';
import { LogicException, RuntimeException } from 'Illuminate/Exception';
import { Stringable } from 'Illuminate/Support/Stringable';

/**
 * PHP: `Illuminate\Tests\Support\SupportHelpersTest`.
 *
 * `Helpers.ts`'s own class comment lists what this module does not port --
 * `e`, `env`, `once`, `literal`, `object_get`, `preg_replace_array`,
 * `windows_os`, `append_config`, `class_uses_recursive`,
 * `trait_uses_recursive`, `fluent`, `str()` with no argument, `optional`/`tap`
 * with no callback. Every PHP test exercising one of those --
 * `testE*`, `testEnv*`, `testObjectGet*`, `testPregReplaceArray`,
 * `testAppendConfig`, `testClassUsesRecursive*`, `testTraitUsesRecursive`,
 * `testLiteral`, `testWrite*EnvVariable*`, `testGetFromSERVERFirst`,
 * `testRequiredEnv*`, `testOptionalIsMacroable` (Macroable is not ported),
 * the no-callback branches of `testStr`, `testTap`, `testOptional*` -- is
 * skipped here rather than silently omitted.
 *
 * `lazy()`/`proxy()` (PHP 8.4 lazy objects) and every `testLazy*`/`testProxy*`
 * case have no counterpart in `Helpers.ts` at all -- Luau has no lazy-object
 * initialization to hook into -- so none of that section is ported either.
 */
export = (): void => {
    describe('Helpers', () => {
        it("blank() reports emptiness the way PHP's blank() does", () => {
            // PHP: SupportHelpersTest::testBlank (Countable branch not ported --
            // see Helpers.ts: an object here is never "empty", only an array is)
            expect(blank(undefined)).to.equal(true);
            expect(blank('')).to.equal(true);
            expect(blank('  ')).to.equal(true);
            expect(blank(new Stringable(''))).to.equal(true);
            expect(blank(new Stringable('  '))).to.equal(true);
            expect(blank(10)).to.equal(false);
            expect(blank(true)).to.equal(false);
            expect(blank(false)).to.equal(false);
            expect(blank(0)).to.equal(false);
            expect(blank(new Stringable(' FooBar '))).to.equal(false);
        });

        it("class_basename() reports a compiled class's own name", () => {
            // PHP: SupportHelpersTest::testClassBasename -- adapted. PHP strips a
            // namespace off a string like 'Foo\Bar\Baz'; there are no
            // class-name strings here (Helpers.ts's `Throwable` type comment),
            // so only the "accepts objects" case -- the one PHP case that does
            // not depend on namespace-string parsing -- is portable.
            class Baz {}

            expect(class_basename(new Baz())).to.equal('Baz');
        });

        it('when() returns the value (or default) for a truthy/falsy condition', () => {
            // PHP: SupportHelpersTest::testWhen -- PHP's loose (`==`) vs strict
            // (`===`) comparisons are evaluated before the call in the PHP
            // source; only their resulting booleans matter to when() itself,
            // so they are inlined here as literal booleans.
            expect(when(true, 'Hello')).to.equal('Hello');
            expect(when(false, 'Hello')).to.equal(undefined);
            expect(when(true, 'There')).to.equal('There'); // 1 === 1
            expect(when(true, 'There')).to.equal('There'); // 1 == '1'
            expect(when(false, 'There')).to.equal(undefined); // 1 == 2
            expect(when('1', () => undefined)).to.equal(undefined);
            expect(when(0, () => undefined)).to.equal(undefined);
            expect(when([1, 2, 3, 4], 'True')).to.equal('True');
            // PHP's `when([], 'True')` (null, an empty array being falsy) has
            // no counterpart: `[]` and `{}` are the same Luau value, and the
            // `new stdClass` case just below pins it as truthy.
            expect(when({}, () => 'True')).to.equal('True');
            expect(when(false, 'Hello', 'World')).to.equal('World');
            expect(when(false, 'Hello', 'World')).to.equal('World'); // 1 === 0
            expect(when(false, 'Hello', 'World')).to.equal('World'); // 1 == '0'
            expect(
                when(
                    '',
                    () => 'There',
                    () => undefined,
                ),
            ).to.equal(undefined);
            expect(
                when(
                    0,
                    () => 'There',
                    () => undefined,
                ),
            ).to.equal(undefined);
            // Dropped for the same reason as `when([], 'True')` above.
            expect(
                when(
                    true,
                    (v) => v,
                    (v) => v !== true,
                ),
            ).to.equal(true);
            expect(
                when(
                    false,
                    (v) => v,
                    (v) => v !== true,
                ),
            ).to.equal(true);
        });

        it('filled() is the negation of blank()', () => {
            // PHP: SupportHelpersTest::testFilled
            expect(filled(undefined)).to.equal(false);
            expect(filled('')).to.equal(false);
            expect(filled('  ')).to.equal(false);
            expect(filled(new Stringable(''))).to.equal(false);
            expect(filled(new Stringable('  '))).to.equal(false);
            expect(filled(10)).to.equal(true);
            expect(filled(true)).to.equal(true);
            expect(filled(false)).to.equal(true);
            expect(filled(0)).to.equal(true);
            expect(filled(new Stringable(' FooBar '))).to.equal(true);
        });

        it('value() unwraps a closure, or returns a non-closure unchanged', () => {
            // PHP: SupportHelpersTest::testValue
            expect(value('foo')).to.equal('foo');
            expect(value(() => 'foo')).to.equal('foo');
            expect(value((arg: string) => arg, 'foo')).to.equal('foo');
        });

        it('data_has() reports whether a dotted path resolves', () => {
            // PHP: SupportHelpersTest::testDataHas -- object/ArrayAccess/dotted-key
            // cases dropped: `DataTarget` addresses tables (Collection,
            // OrderedMap, list, plain table), not PHP's stdClass/ArrayAccess.
            const array = [{ users: [{ name: 'Taylor' }] }];
            const plainArray = [1, 2, 3];

            expect(data_has(array, '0.users.0.name')).to.equal(true);
            expect(data_has(array, '0.users.3')).to.equal(false);
            expect(data_has(plainArray, '0')).to.equal(true);
            expect(data_has(plainArray, '4')).to.equal(false);
            expect(data_has(plainArray, [])).to.equal(false);
            expect(data_has(plainArray, undefined)).to.equal(false);
        });

        it('data_get() reads a dotted path, with `*`, defaults and directives', () => {
            // PHP: SupportHelpersTest::testDataGet
            const array = [{ users: [{ name: 'Taylor' }] }];

            expect(data_get(array, '0.users.0.name')).to.equal('Taylor');
            expect(data_get(array, '0.users.3')).to.equal(undefined);
            expect(data_get(array, '0.users.3', 'Not found')).to.equal('Not found');
            expect(data_get(array, '0.users.3', () => 'Not found')).to.equal('Not found');
        });

        it('data_get() fans `*` out over nested arrays', () => {
            // PHP: SupportHelpersTest::testDataGetWithNestedArrays
            const array = [{ name: 'taylor', email: 'taylorotwell@gmail.com' }, { name: 'abigail' }, { name: 'dayle' }];

            expectDeepEqual(data_get(array, '*.name'), ['taylor', 'abigail', 'dayle']);
        });

        it('data_get() collapses a double `*`', () => {
            // PHP: SupportHelpersTest::testDataGetWithDoubleNestedArraysCollapsesResult
            const array = {
                posts: [
                    {
                        comments: [
                            { author: 'taylor', likes: 4 },
                            { author: 'abigail', likes: 3 },
                        ],
                    },
                    {
                        comments: [{ author: 'abigail', likes: 2 }, { author: 'dayle' }],
                    },
                ],
            };

            expectDeepEqual(data_get(array, 'posts.*.comments.*.author'), ['taylor', 'abigail', 'abigail', 'dayle']);
        });

        it('data_get() understands {first} and {last}', () => {
            // PHP: SupportHelpersTest::testDataGetFirstLastDirectives
            const array = {
                flights: [
                    {
                        segments: [
                            { from: 'LHR', to: 'IST' },
                            { from: 'IST', to: 'PKX' },
                        ],
                    },
                    {
                        segments: [
                            { from: 'LGW', to: 'SAW' },
                            { from: 'SAW', to: 'PEK' },
                        ],
                    },
                ],
                empty: new Array<never>(),
            };

            expect(data_get(array, 'flights.0.segments.{first}.from')).to.equal('LHR');
            expect(data_get(array, 'flights.0.segments.{last}.to')).to.equal('PKX');
            expect(data_get(array, 'flights.{first}.segments.{first}.from')).to.equal('LHR');
            expect(data_get(array, 'flights.{last}.segments.{last}.to')).to.equal('PEK');
            expect(data_get(array, 'empty.{first}', 'Not found')).to.equal('Not found');
            expect(data_get(array, 'empty.{last}', 'Not found')).to.equal('Not found');
        });

        it('data_get() escapes `*`, {first} and {last} with a leading backslash', () => {
            // PHP: SupportHelpersTest::testDataGetEscapedSegmentKeys
            const array = {
                symbols: {
                    '{last}': { description: 'dollar' },
                    '*': { description: 'asterisk' },
                    '{first}': { description: 'caret' },
                },
            };

            expect(data_get(array, 'symbols.\\{first}.description')).to.equal('caret');
            expect(data_get(array, 'symbols.{first}.description')).to.equal('dollar');
            expect(data_get(array, 'symbols.\\*.description')).to.equal('asterisk');
        });

        it('data_get() with a bare `*` reads every value', () => {
            // PHP: SupportHelpersTest::testDataGetStar
            const data = { foo: 'bar' };

            expectDeepEqual(data_get(data, '*'), ['bar']);
        });

        it('data_fill() only fills a key that is not already set', () => {
            // PHP: SupportHelpersTest::testDataFill
            const data: Record<string, unknown> = { foo: 'bar' };

            expect(data_fill(data, 'baz', 'boom')).to.equal(data);
            expect(data.baz).to.equal('boom');

            data_fill(data, 'baz', 'noop');
            expect(data.baz).to.equal('boom');

            data_fill(data, 'foo.bar', 'kaboom');
            expect((data.foo as Record<string, unknown>).bar).to.equal('kaboom');
        });

        it('data_fill() with `*` fills every matching leaf', () => {
            // PHP: SupportHelpersTest::testDataFillWithStar
            const data: Record<string, unknown> = {
                bar: [{ baz: 'original' }, {}],
            };

            data_fill(data, 'bar.*.baz', 'boom');

            const bar = data.bar as Array<Record<string, unknown>>;
            expect(bar[0].baz).to.equal('original');
            expect(bar[1].baz).to.equal('boom');
        });

        it('data_set() overwrites by default and builds missing levels', () => {
            // PHP: SupportHelpersTest::testDataSet
            const data: Record<string, unknown> = { foo: 'bar' };

            data_set(data, 'baz', 'boom');
            expect(data.baz).to.equal('boom');

            data_set(data, 'baz', 'kaboom');
            expect(data.baz).to.equal('kaboom');

            data_set(data, 'foo.bar', 'boom');
            expect((data.foo as Record<string, unknown>).bar).to.equal('boom');

            data_set(data, 'baz.bar.boom.kaboom', 'boom');
            const baz = data.baz as Record<string, unknown>;
            const bazBar = baz.bar as Record<string, unknown>;
            const bazBarBoom = bazBar.boom as Record<string, unknown>;
            expect(bazBarBoom.kaboom).to.equal('boom');
        });

        it('data_set() with `*` writes every matching leaf', () => {
            // PHP: SupportHelpersTest::testDataSetWithStar
            const data: Record<string, unknown> = {
                bar: [{ baz: 'original' }, { baz: 'original' }],
            };

            data_set(data, 'bar.*.baz', 'boom');

            const bar = data.bar as Array<Record<string, unknown>>;
            expect(bar[0].baz).to.equal('boom');
            expect(bar[1].baz).to.equal('boom');

            data_set(data, 'bar.*', 'overwritten');
            expect(bar[0]).to.equal('overwritten');
            expect(bar[1]).to.equal('overwritten');
        });

        it('data_forget() removes a key, and re-indexes a list', () => {
            // PHP: SupportHelpersTest::testDataRemove -- PHP leaves a hole in the
            // list; a Luau array cannot, so the list re-indexes (Helpers.ts's
            // `data_forget` comment)
            let data: Record<string, unknown> = {
                foo: 'bar',
                hello: 'world',
            };

            data_forget(data, 'foo');
            expect(data.foo).to.equal(undefined);
            expect(data.hello).to.equal('world');

            data = { foo: 'bar', hello: 'world' };
            data_forget(data, 'nothing');
            expect(data.foo).to.equal('bar');

            data = {
                one: { two: { three: 'hello', four: ['five'] } },
            };
            data_forget(data, 'one.two.three');
            const one = data.one as Record<string, unknown>;
            const two = one.two as Record<string, unknown>;
            expect(two.three).to.equal(undefined);
            expectDeepEqual(two.four, ['five']);
        });

        it('data_forget() with `*` removes a key from every item', () => {
            // PHP: SupportHelpersTest::testDataRemoveWithStar
            const data: Record<string, unknown> = {
                article: {
                    title: 'Foo',
                    comments: [
                        { comment: 'foo', name: 'First' },
                        { comment: 'bar', name: 'Second' },
                    ],
                },
            };

            data_forget(data, 'article.comments.*.name');

            const article = data.article as Record<string, unknown>;
            const comments = article.comments as Array<Record<string, unknown>>;
            expect(comments[0].name).to.equal(undefined);
            expect(comments[0].comment).to.equal('foo');
            expect(comments[1].name).to.equal(undefined);
        });

        it('head() and last() answer the first/last item, or undefined', () => {
            // PHP: SupportHelpersTest::testHead, ::testLast -- PHP's `false` on
            // an empty array becomes `undefined` here (Helpers.ts's `head` comment)
            const array = ['a', 'b', 'c'];

            expect(head(array)).to.equal('a');
            expect(last(array)).to.equal('c');
        });

        it('str() wraps a value in a Stringable', () => {
            // PHP: SupportHelpersTest::testStr -- only the argument form; the
            // no-argument accessor form is not ported (Helpers.ts class comment)
            const stringable = str('string-value');

            expect(stringable).to.be.a('table');
            expect(stringable.toString()).to.equal('string-value');
        });

        it('tap() calls the callback with the value and returns the value', () => {
            // PHP: SupportHelpersTest::testTap -- only the callback form; PHP's
            // no-callback `HigherOrderTapProxy` form is not ported
            const object = { id: 1 };

            expect(
                tap(object, (o) => {
                    o.id = 2;
                }).id,
            ).to.equal(2);
        });

        it('throw_if() throws the given exception, or the condition value otherwise', () => {
            // PHP: SupportHelpersTest::testThrow, ::testThrowDefaultException,
            // ::testThrowExceptionWithMessage, ::testThrowExceptionAsStringWithMessage,
            // ::testThrowClosureException, ::testThrowWithString -- PHP's string
            // class-name / class-string forms collapse into passing the class
            // itself (Helpers.ts's `Throwable` type comment)
            expectThrows(() => throw_if(true, new LogicException()));

            expectThrows(() => throw_if(true));

            let messageException: unknown;
            try {
                throw_if(true, 'test');
            } catch (e) {
                messageException = e;
            }
            expect(messageException instanceof RuntimeException).to.equal(true);

            expectThrows(() => throw_if(true, LogicException, 'test'));

            expectThrows(() => throw_if(true, () => new RuntimeException('test')));
        });

        it('throw_unless() throws unless the condition is truthy', () => {
            // PHP: SupportHelpersTest::testThrowUnless,
            // ::testThrowUnlessDefaultException, ::testThrowUnlessExceptionWithMessage,
            // ::testThrowUnlessExceptionAsStringWithMessage, ::testThrowReturnIfNotThrown
            expectThrows(() => throw_unless(false, new LogicException()));
            expectThrows(() => throw_unless(false));
            expectThrows(() => throw_unless(false, LogicException, 'test'));
            expect(throw_unless('foo', new RuntimeException())).to.equal('foo');
        });

        it('optional() calls the callback only when the value is present', () => {
            // PHP: SupportHelpersTest::testOptionalWithCallback -- only the
            // callback form is ported (Helpers.ts's `optional` comment)
            let called = false;
            expect(
                optional(undefined, () => {
                    called = true;
                }),
            ).to.equal(undefined);
            expect(called).to.equal(false);

            expect(optional(5, (n) => n * 2)).to.equal(10);
        });

        it('retry() retries the callback and sleeps between attempts', () => {
            // PHP: SupportHelpersTest::testRetry -- adapted: this port sleeps
            // through `task.wait`, not a fakeable `Sleep` facade
            // (`Illuminate/Support/Sleep` is not ported), so the sleep duration
            // itself is not asserted, only that the retried callback eventually
            // succeeds on the expected attempt.
            let attempted = 0;

            const attempts = retry(
                2,
                (n) => {
                    attempted = n;

                    if (n > 1) {
                        return n;
                    }

                    throw new RuntimeException();
                },
                0,
            );

            expect(attempts).to.equal(2);
            expect(attempted).to.equal(2);
        });

        it('retry() gives up once the `when` callback refuses the exception', () => {
            // PHP: SupportHelpersTest::testRetryWithFailingWhenCallback
            expectThrows(() =>
                retry(
                    2,
                    (n) => {
                        if (n > 1) {
                            return n;
                        }

                        throw new RuntimeException();
                    },
                    0,
                    () => false,
                ),
            );
        });

        it('transform() applies the callback, or returns the default when blank', () => {
            // PHP: SupportHelpersTest::testTransform, ::testTransformDefaultWhenBlank
            expect(transform(5, (v) => v * 2)).to.equal(10);
            expect(transform(undefined, () => 10)).to.equal(undefined);
            expect(transform(undefined, () => 'bar', 'baz')).to.equal('baz');
            expect(
                transform(
                    '',
                    () => 'bar',
                    () => 'baz',
                ),
            ).to.equal('baz');
        });

        it('with() calls the callback with the value, or returns the value itself', () => {
            // PHP: SupportHelpersTest::testWith
            expect(_with(10)).to.equal(10);
            expect(_with(5, (five) => five + 5)).to.equal(10);
        });
    });
};
