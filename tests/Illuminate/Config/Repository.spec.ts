/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../TestHelpers';
import { InvalidArgumentException } from 'Illuminate/Exception';
import { Repository } from 'Illuminate/Config/Repository';
import type { ArrayAccessible } from 'Illuminate/Support/Arr';

/**
 * PHP: `Illuminate\Tests\Config\RepositoryTest`.
 *
 * Not ported:
 *
 * - `testSetArray` -- upstream's `Repository::set()` accepts either a single
 *   `$key, $value` pair or one array of pairs (`is_array($key)` dispatches to
 *   a bulk path). This port's `Repository.set()` (`Repository.ts`) types
 *   `key` as a plain `string` -- there is no array overload -- so the bulk
 *   form has no faithful equivalent, the same kind of gap `Config`'s section
 *   of `agent_docs/laravel-parity.md` already tracks for this class.
 * - `testOffsetExists`, `testOffsetGet`, `testOffsetSet`, `testOffsetUnset`
 *   -- `ArrayAccess` is not ported (`agent_docs/laravel-parity.md`: Config
 *   "Не реализовано: ..., ArrayAccess, Macroable, ...").
 * - `testItIsMacroable` -- `Macroable` is not ported (same line).
 * - `testItGetsAsCollection` -- `collection()` is not ported; `Repository.ts`'s
 *   own class comment: "there is no Collection yet."
 * - `testItGetsAsFloat`, `testItThrowsAnExceptionWhenTryingToGetNonFloatValueAsFloat`
 *   -- `float()` is not ported; `Repository.ts`'s class comment: "Luau has a
 *   single number type."
 *
 * Adapted, not skipped:
 *
 * - `testGetWithArrayOfKeys` -- upstream's `Repository::get()` dispatches to
 *   `getMany()` when handed an array of keys instead of a single string.
 *   This port's `Repository.get()` types `key` as a plain `string`, so the
 *   array-of-keys form is reached only through `getMany()` directly -- the
 *   same fixtures are exercised below via `getMany()`, same as
 *   `testGetMany` itself does upstream.
 * - `testPrepend`, `testPush` -- upstream reads back individual elements via
 *   dotted numeric access (`get('array.0')`, `get('array.1')`, ...). This
 *   port's `Arr.get()` (`Arr.ts`) walks a table addressed by *string* keys
 *   (`ArrayAccessible`); a genuine array's runtime keys are Lua integers, not
 *   strings, so a numeric dot segment never matches one -- the same "Keys are
 *   always strings" limitation `Arr/KeyedAccess.spec.ts`'s class comment
 *   documents for `Arr.get()` in general. `Repository.get('array')` itself
 *   (no dot) is unaffected -- it still returns the underlying array directly,
 *   which is what `prepend()`/`push()` actually mutate -- so the adaptation
 *   below reads elements via `repository.get('array')[index]` instead, same
 *   values, same order, same assertions.
 *
 * The `string()`/`array()`/`boolean()`/`integer()` exception-message
 * assertions below check the exact message rather than upstream's
 * `expectExceptionMessageMatches` regex: the regex's `(.*)` wildcard exists
 * only to skip over PHP's `gettype()` name, which this port spells
 * differently (`typeOf()`, e.g. `"table"` where PHP says `"array"`) --
 * `typeOf()` is deterministic for the fixture values used here, so the exact
 * message is asserted directly instead of pattern-matched.
 */
export = (): void => {
    describe('Config Repository', () => {
        // A fresh table every test, same as PHP's `setUp()` reassigning
        // `$this->config` on each run -- sharing one literal across `it()`s
        // would let `set()`/`prepend()`/`push()` mutations from one test leak
        // into the next, since a Luau table is a reference type.
        function makeConfig(): ArrayAccessible
        {
            return {
                foo: 'bar',
                bar: 'baz',
                baz: 'bat',
                null: undefined,
                boolean: true,
                integer: 1,
                float: 1.1,
                associate: {
                    x: 'xxx',
                    y: 'yyy',
                },
                array: [
                    'aaa',
                    'zzz',
                ],
                x: {
                    z: 'zoo',
                },
                'a.b': 'c',
                a: {
                    'b.c': 'd',
                },
            };
        }

        let config: ArrayAccessible;
        let repository: Repository;

        beforeEach(() => {
            config = makeConfig();
            repository = new Repository(config);
        });

        it('get() resolves a dotted key over a literal dotted key', () => {
            // PHP: RepositoryTest::testGetValueWhenKeyContainDot
            expect(repository.get('a.b')).to.equal('c');
            expect(repository.get('a.b.c')).to.equal(undefined);

            expect(repository.get('x.y.z')).to.equal(undefined);
            expect(repository.get('.')).to.equal(undefined);
        });

        it('get() returns a boolean value', () => {
            // PHP: RepositoryTest::testGetBooleanValue
            expect(repository.get('boolean')).to.equal(true);
        });

        it('get() returns a null value', () => {
            // PHP: RepositoryTest::testGetNullValue
            expect(repository.get('null')).to.equal(undefined);
        });

        it('constructs a Repository instance', () => {
            // PHP: RepositoryTest::testConstruct
            expect(repository instanceof Repository).to.equal(true);
        });

        it('has() is true for an existing key', () => {
            // PHP: RepositoryTest::testHasIsTrue
            expect(repository.has('foo')).to.equal(true);
        });

        it('has() is false for a missing key', () => {
            // PHP: RepositoryTest::testHasIsFalse
            expect(repository.has('not-exist')).to.equal(false);
        });

        it('get() reads a top-level value', () => {
            // PHP: RepositoryTest::testGet
            expect(repository.get('foo')).to.equal('bar');
        });

        it('getMany() reads several keys at once, dotted and defaulted', () => {
            // PHP: RepositoryTest::testGetWithArrayOfKeys (adapted -- see class comment)
            const first = repository.getMany([
                'foo',
                'bar',
                'none',
            ]);
            expect(first.foo).to.equal('bar');
            expect(first.bar).to.equal('baz');
            expect(first.none).to.equal(undefined);

            const second = repository.getMany([
                [
                    'x.y',
                    'default',
                ],
                [
                    'x.z',
                    'default',
                ],
                [
                    'bar',
                    'default',
                ],
                'baz',
            ] as Array<string | [string, unknown]>);
            expectDeepEqual(second, {
                'x.y': 'default',
                'x.z': 'zoo',
                bar: 'baz',
                baz: 'bat',
            });
        });

        it('getMany() reads several keys at once, dotted and defaulted', () => {
            // PHP: RepositoryTest::testGetMany
            const first = repository.getMany([
                'foo',
                'bar',
                'none',
            ]);
            expect(first.foo).to.equal('bar');
            expect(first.bar).to.equal('baz');
            expect(first.none).to.equal(undefined);

            const second = repository.getMany([
                [
                    'x.y',
                    'default',
                ],
                [
                    'x.z',
                    'default',
                ],
                [
                    'bar',
                    'default',
                ],
                'baz',
            ] as Array<string | [string, unknown]>);
            expectDeepEqual(second, {
                'x.y': 'default',
                'x.z': 'zoo',
                bar: 'baz',
                baz: 'bat',
            });
        });

        it('get() falls back to the given default', () => {
            // PHP: RepositoryTest::testGetWithDefault
            expect(repository.get('not-exist', 'default')).to.equal('default');
        });

        it('set() writes a single value', () => {
            // PHP: RepositoryTest::testSet
            repository.set('key', 'value');
            expect(repository.get('key')).to.equal('value');
        });

        it('prepend() unshifts onto an array value', () => {
            // PHP: RepositoryTest::testPrepend (adapted -- see class comment)
            let array = repository.get('array') as Array<string>;
            expect(array[0]).to.equal('aaa');
            expect(array[1]).to.equal('zzz');

            repository.prepend('array', 'xxx');
            array = repository.get('array') as Array<string>;
            expect(array[0]).to.equal('xxx');
            expect(array[1]).to.equal('aaa');
            expect(array[2]).to.equal('zzz');
            expect(array[3]).to.equal(undefined);
            expect(array.size()).to.equal(3);
        });

        it('push() appends onto an array value', () => {
            // PHP: RepositoryTest::testPush (adapted -- see class comment)
            let array = repository.get('array') as Array<string>;
            expect(array[0]).to.equal('aaa');
            expect(array[1]).to.equal('zzz');

            repository.push('array', 'xxx');
            array = repository.get('array') as Array<string>;
            expect(array[0]).to.equal('aaa');
            expect(array[1]).to.equal('zzz');
            expect(array[2]).to.equal('xxx');
            expect(array.size()).to.equal(3);
        });

        it('prepend() onto a missing key creates a new array', () => {
            // PHP: RepositoryTest::testPrependWithNewKey
            repository.prepend('new_key', 'xxx');
            expectDeepEqual(repository.get('new_key'), ['xxx']);
        });

        it('push() onto a missing key creates a new array', () => {
            // PHP: RepositoryTest::testPushWithNewKey
            repository.push('new_key', 'xxx');
            expectDeepEqual(repository.get('new_key'), ['xxx']);
        });

        it('all() returns every configuration item', () => {
            // PHP: RepositoryTest::testAll
            expect(repository.all()).to.equal(config);
        });

        it('string() reads a string configuration value', () => {
            // PHP: RepositoryTest::testItGetsAsString
            expect(repository.string('a.b')).to.equal('c');
        });

        it('string() throws for a non-string value', () => {
            // PHP: RepositoryTest::testItThrowsAnExceptionWhenTryingToGetNonStringValueAsString
            const [ok, err] = pcall(() => repository.string('a'));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
            expect((err as InvalidArgumentException).getMessage()).to.equal(
                'Configuration value for key [a] must be a string, table given.',
            );
        });

        it('array() reads an array configuration value', () => {
            // PHP: RepositoryTest::testItGetsAsArray
            expectDeepEqual(repository.array('array'), [
                'aaa',
                'zzz',
            ]);
        });

        it('array() throws for a non-array value', () => {
            // PHP: RepositoryTest::testItThrowsAnExceptionWhenTryingToGetNonArrayValueAsArray
            const [ok, err] = pcall(() => repository.array('a.b'));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
            expect((err as InvalidArgumentException).getMessage()).to.equal(
                'Configuration value for key [a.b] must be an array, string given.',
            );
        });

        it('boolean() reads a boolean configuration value', () => {
            // PHP: RepositoryTest::testItGetsAsBoolean
            expect(repository.boolean('boolean')).to.equal(true);
        });

        it('boolean() throws for a non-boolean value', () => {
            // PHP: RepositoryTest::testItThrowsAnExceptionWhenTryingToGetNonBooleanValueAsBoolean
            const [ok, err] = pcall(() => repository.boolean('a.b'));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
            expect((err as InvalidArgumentException).getMessage()).to.equal(
                'Configuration value for key [a.b] must be a boolean, string given.',
            );
        });

        it('integer() reads an integer configuration value', () => {
            // PHP: RepositoryTest::testItGetsAsInteger
            expect(repository.integer('integer')).to.equal(1);
        });

        it('integer() throws for a non-integer value', () => {
            // PHP: RepositoryTest::testItThrowsAnExceptionWhenTryingToGetNonIntegerValueAsInteger
            const [ok, err] = pcall(() => repository.integer('a.b'));

            expect(ok).to.equal(false);
            expect(err instanceof InvalidArgumentException).to.equal(true);
            expect((err as InvalidArgumentException).getMessage()).to.equal(
                'Configuration value for key [a.b] must be an integer, string given.',
            );
        });
    });
};
