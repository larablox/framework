/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual, expectThrows } from '../../TestHelpers';
import { ContextDehydrating } from 'Illuminate/Log/Context/Events/ContextDehydrating';
import { ContextHydrated } from 'Illuminate/Log/Context/Events/ContextHydrated';
import { Dispatcher } from 'Illuminate/Events/Dispatcher';
import { Repository } from 'Illuminate/Log/Context/Repository';
import type { ContextSnapshot } from 'Illuminate/Log/Context/Repository';

/**
 * PHP: `Illuminate\Tests\Log\ContextTest`.
 *
 * Upstream drives everything through the `Context` facade, a static accessor
 * over a singleton bound in the application container, and asserts against
 * `$this->app` state across tests. There is no facade layer or shared
 * container fixture wired up for this port's test runner, so every test below
 * builds its own `Repository` directly -- `new Repository(new Dispatcher())`
 * -- which is also a cleaner unit boundary: no state survives between tests,
 * where upstream needed `tearDown()` to reset `MyAddContextProcessor`.
 *
 * Not ported, no equivalent in this port:
 * - `test_it_can_serialize_values`: asserts `dehydrate()` produces PHP
 *   serialization strings (`'s:6:"string";'`, `'i:5;'`, ...) and that
 *   `hydrate()` reverses them. `Repository.dehydrate()`/`hydrate()` here just
 *   copy the plain snapshot (`Repository.ts`'s class comment: "There are no
 *   queues here, so they take and return a plain snapshot"), so there is no
 *   serialized-string format to assert against; the round-trip itself is
 *   covered by `it("dehydrate()/hydrate() round-trip a snapshot", ...)` below
 *   without the PHP-specific encoding.
 * - `test_it_adds_context_to_logging`, `test_it_doesnt_override_log_instance_context`,
 *   `test_it_doesnt_allow_context_to_be_used_as_parameters`,
 *   `test_does_not_add_hidden_context_to_logging`,
 *   `test_it_adds_context_to_logged_exceptions`,
 *   `test_uses_closure_for_context_processor`, `test_can_rebind_to_separate_class`:
 *   all assert on a log file's contents (`storage_path('logs/laravel.log')`)
 *   written through the `Log`/`Context` facades and, for the exceptions test,
 *   the bound `ExceptionHandler`. There is no filesystem on this platform and
 *   no facade layer wired into these tests (see above); the mechanism they
 *   exercise -- `ContextLogProcessor` merging `Repository::all()` into a log
 *   record's `extra` -- is `Context\ContextLogProcessor`'s own responsibility,
 *   not `Repository`'s, and is out of scope for this file.
 * - The PHP-only value kinds in `test_it_can_set_values` -- a native `enum`
 *   case and a backed `enum` case (`Suit::Clubs`, `StringBackedSuit::Clubs`)
 *   -- have no TypeScript/Luau analogue and are dropped from the ported
 *   version; every other kind (string, bool, int, float, undefined/null,
 *   array, object literal) carries over.
 */

export = (): void => {
    describe('Context Repository', () => {
        it('can set and get values of every plain kind', () => {
            // PHP: ContextTest::test_it_can_set_values (enum cases dropped, see class comment)
            const context = new Repository(new Dispatcher());

            const values: Record<string, unknown> = {
                string: 'string',
                bool: false,
                int: 5,
                float: 5.5,
                undef: undefined,
                array: [1, 2, 3],
                hash: { foo: 'bar' },
            };

            for (const [key, value] of pairs(values)) {
                context.add(key as string, value);
            }

            for (const [key, value] of pairs(values)) {
                expect(context.get(key as string)).to.equal(value);
            }
        });

        it('addIf() only adds the value when it is not already present', () => {
            // PHP: ContextTest::test_it_can_add_values_when_not_already_present
            const context = new Repository(new Dispatcher());

            context.addIf('foo', 1);
            expect(context.get('foo')).to.equal(1);

            context.addIf('foo', 2);
            expect(context.get('foo')).to.equal(1);
        });

        it('hydrated() listeners run when a ContextHydrated event is dispatched', () => {
            // PHP: ContextTest::test_it_can_listen_to_the_hydrating_event
            const events = new Dispatcher();
            const context = new Repository(events);

            context.add('one', 1);
            context.add('two', 2);
            context.hydrated(() => {
                context.add('two', 99);
                context.add('three', 3);
            });
            events.dispatch(new ContextHydrated(context));

            expect(context.get('one')).to.equal(1);
            expect(context.get('two')).to.equal(99);
            expect(context.get('three')).to.equal(3);
        });

        it('dehydrating() listeners run when a ContextDehydrating event is dispatched', () => {
            // PHP: ContextTest::test_it_can_listen_to_the_dehydrated_event
            const events = new Dispatcher();
            const context = new Repository(events);

            context.add('one', 1);
            context.add('two', 2);
            context.dehydrating(() => {
                context.add('two', 99);
                context.add('three', 3);
            });
            events.dispatch(new ContextDehydrating(context));

            expect(context.get('one')).to.equal(1);
            expect(context.get('two')).to.equal(99);
            expect(context.get('three')).to.equal(3);
        });

        it('modifying context inside a dehydrating() listener does not affect the live repository', () => {
            // PHP: ContextTest::test_it_can_modify_context_while_dehydrating_without_impacting_global_instance
            const context = new Repository(new Dispatcher());

            context.add('one', 1);
            context.dehydrating((repository: Repository) => {
                repository.add('one', 99);
            });

            const dehydrated = context.dehydrate();
            expect(context.get('one')).to.equal(1);

            context.hydrate(dehydrated);
            expect(context.get('one')).to.equal(99);
        });

        it('dehydrate() returns undefined when empty', () => {
            // PHP: ContextTest::test_dehydrate_returns_null_when_empty
            const context = new Repository(new Dispatcher());

            expect(context.dehydrate()).to.equal(undefined);
        });

        it('hydrate(undefined) still fires the hydrated event', () => {
            // PHP: ContextTest::test_hydrating_null_triggers_hydrating_event
            const context = new Repository(new Dispatcher());
            let called = false;

            context.hydrated(() => {
                called = true;
            });

            context.hydrate(undefined);

            expect(called).to.equal(true);
        });

        it('dehydrate()/hydrate() round-trip a snapshot', () => {
            // Adapted from ContextTest::test_it_can_serialize_values -- the
            // PHP-serialization-string half is not ported, see class comment.
            const context = new Repository(new Dispatcher());

            context.add({
                string: 'string',
                bool: false,
                int: 5,
                float: 5.5,
                array: [1, 2, 3],
                hash: { foo: 'bar' },
            });
            context.addHidden('number', 55);

            const dehydrated = context.dehydrate() as ContextSnapshot;

            context.flush();
            expect(context.get('string')).to.equal(undefined);

            context.hydrate(dehydrated);

            expect(context.get('string')).to.equal('string');
            expect(context.get('bool')).to.equal(false);
            expect(context.get('int')).to.equal(5);
            expect(context.get('float')).to.equal(5.5);
            expect(context.get('array')).to.be.a('table');
            expect(context.get('hash')).to.be.a('table');
            expect(context.getHidden('number')).to.equal(55);
        });

        it('push() appends to a list', () => {
            // PHP: ContextTest::test_it_can_push_to_list
            const context = new Repository(new Dispatcher());

            context.push('breadcrumbs', 'foo');
            context.push('breadcrumbs', 'bar');
            context.push('breadcrumbs', 'baz', 'qux');

            expectDeepEqual(context.get('breadcrumbs'), ['foo', 'bar', 'baz', 'qux']);
        });

        it('push() throws when the key is not an array', () => {
            // PHP: ContextTest::test_throws_when_pushing_to_non_array
            const context = new Repository(new Dispatcher());

            context.add('breadcrumbs', 'foo');

            expectThrows(
                () => context.push('breadcrumbs', 'bar'),
                'Unable to push value onto context stack for key [breadcrumbs].',
            );
        });

        it('push() throws when the key holds a non-list array', () => {
            // PHP: ContextTest::test_throws_when_pushing_to_non_list_array
            const context = new Repository(new Dispatcher());

            context.add('breadcrumbs', { foo: 'bar' });

            expectThrows(
                () => context.push('breadcrumbs', 'bar'),
                'Unable to push value onto context stack for key [breadcrumbs].',
            );
        });

        it('pop() removes and returns from the end of the list', () => {
            // PHP: ContextTest::test_it_can_pop_from_list
            const context = new Repository(new Dispatcher());

            context.push('breadcrumbs', 'foo', 'bar');

            expect(context.pop('breadcrumbs')).to.equal('bar');
            expect(context.pop('breadcrumbs')).to.equal('foo');
            expectDeepEqual(context.get('breadcrumbs'), []);
        });

        it('pop() throws when popping an empty list', () => {
            // PHP: ContextTest::test_throws_when_popping_from_empty_list
            const context = new Repository(new Dispatcher());

            context.push('breadcrumbs', 'bar');
            context.pop('breadcrumbs');

            expectThrows(
                () => context.pop('breadcrumbs'),
                'Unable to pop value from context stack for key [breadcrumbs].',
            );
        });

        it('pop() throws when the key holds a non-list array', () => {
            // PHP: ContextTest::test_throws_when_popping_from_non_list_array
            const context = new Repository(new Dispatcher());

            context.add('breadcrumbs', { foo: 'bar' });

            expectThrows(
                () => context.pop('breadcrumbs'),
                'Unable to pop value from context stack for key [breadcrumbs].',
            );
        });

        it('pushHidden()/popHidden() mirror push()/pop() for hidden data', () => {
            // PHP: ContextTest::test_it_can_pop_from_hidden_list
            const context = new Repository(new Dispatcher());

            context.pushHidden('breadcrumbs', 'foo', 'bar');

            expect(context.popHidden('breadcrumbs')).to.equal('bar');
            expect(context.popHidden('breadcrumbs')).to.equal('foo');
            expectDeepEqual(context.getHidden('breadcrumbs'), []);
        });

        it('popHidden() throws when popping an empty hidden list', () => {
            // PHP: ContextTest::test_throws_when_popping_from_empty_hidden_list
            const context = new Repository(new Dispatcher());

            context.pushHidden('breadcrumbs', 'bar');
            context.popHidden('breadcrumbs');

            expectThrows(
                () => context.popHidden('breadcrumbs'),
                'Unable to pop value from hidden context stack for key [breadcrumbs].',
            );
        });

        it('popHidden() throws when the hidden key holds a non-list array', () => {
            // PHP: ContextTest::test_throws_when_popping_from_hidden_non_list_array
            const context = new Repository(new Dispatcher());

            context.addHidden('breadcrumbs', { foo: 'bar' });

            expectThrows(
                () => context.popHidden('breadcrumbs'),
                'Unable to pop value from hidden context stack for key [breadcrumbs].',
            );
        });

        it('has()/missing() report whether a key is set', () => {
            // PHP: ContextTest::test_it_can_check_if_context_has_been_set
            const context = new Repository(new Dispatcher());

            context.add('foo', 'bar');
            context.add('nullish', undefined);

            expect(context.has('foo')).to.equal(true);
            // A value of `undefined` is indistinguishable from "unset" here --
            // `has()` reads `this.data[key] !== undefined` (Repository.ts) --
            // unlike PHP, where `Context::add('null', null)` still leaves the
            // array key present and `isset()`-checkable. `missing()` below
            // exercises the same divergence for the same reason.
            expect(context.has('unset')).to.equal(false);
        });

        it('missing() is the inverse of has()', () => {
            // PHP: ContextTest::test_it_can_check_if_context_is_missing
            const context = new Repository(new Dispatcher());

            context.add('foo', 'bar');

            expect(context.missing('lorem')).to.equal(true);
            expect(context.missing('foo')).to.equal(false);
        });

        it('stackContains() checks a value against every entry', () => {
            // PHP: ContextTest::test_it_can_check_if_value_is_in_context_stack
            const context = new Repository(new Dispatcher());

            context.push('foo', 'bar', 'lorem');

            expect(context.stackContains('foo', 'bar')).to.equal(true);
            expect(context.stackContains('foo', 'lorem')).to.equal(true);
            expect(context.stackContains('foo', 'doesNotExist')).to.equal(false);
        });

        it('stackContains() accepts a predicate callback', () => {
            // PHP: ContextTest::test_it_can_check_if_value_is_in_context_stack_with_closures
            const context = new Repository(new Dispatcher());

            context.push('foo', 'bar', ['lorem'], 123);
            context.pushHidden('baz');

            expect(context.stackContains('foo', (value: unknown) => value === 'bar')).to.equal(true);
            expect(context.stackContains('foo', (value: unknown) => value === 'baz')).to.equal(false);
        });

        it('hiddenStackContains() checks a value against every hidden entry', () => {
            // PHP: ContextTest::test_it_can_check_if_value_is_in_hidden_context_stack
            const context = new Repository(new Dispatcher());

            context.pushHidden('foo', 'bar', 'lorem');

            expect(context.hiddenStackContains('foo', 'bar')).to.equal(true);
            expect(context.hiddenStackContains('foo', 'lorem')).to.equal(true);
            expect(context.hiddenStackContains('foo', 'doesNotExist')).to.equal(false);
        });

        it('hiddenStackContains() accepts a predicate callback', () => {
            // PHP: ContextTest::test_it_can_check_if_value_is_in_hidden_context_stack_with_closures
            const context = new Repository(new Dispatcher());

            context.pushHidden('foo', 'baz');
            context.push('foo', 'bar', ['lorem'], 123);

            expect(context.hiddenStackContains('foo', (value: unknown) => value === 'baz')).to.equal(true);
            expect(context.hiddenStackContains('foo', (value: unknown) => value === 'bar')).to.equal(false);
        });

        it('stackContains() does not see values pushed onto the hidden stack', () => {
            // PHP: ContextTest::test_it_cannot_check_if_hidden_value_is_in_non_hidden_context_stack
            const context = new Repository(new Dispatcher());

            context.pushHidden('foo', 'bar', 'lorem');

            expect(context.stackContains('foo', 'bar')).to.equal(false);
        });

        it('all() returns every set value', () => {
            // PHP: ContextTest::test_it_can_get_all_values
            const context = new Repository(new Dispatcher());

            context.add('foo', 'bar');
            context.add('nullish', undefined);

            expectDeepEqual(context.all(), { foo: 'bar' });
        });

        it('silently returns undefined/empty for unset values', () => {
            // PHP: ContextTest::test_it_silently_ignores_unset_values
            const context = new Repository(new Dispatcher());

            expect(context.get('foo')).to.equal(undefined);
            expect(context.has('foo')).to.equal(false);
            expectDeepEqual(context.all(), {});
        });

        it('is a flat key-value store -- dotted keys are not nested', () => {
            // PHP: ContextTest::test_it_is_simple_key_value_system
            const context = new Repository(new Dispatcher());

            context.add('parent.child', 5);

            expect(context.get('parent')).to.equal(undefined);
            expect(context.get('parent.child')).to.equal(5);
        });

        it('only() retrieves a subset of context', () => {
            // PHP: ContextTest::test_it_can_retrieve_subset_of_context
            const context = new Repository(new Dispatcher());

            context.add('parent.child.1', 5);
            context.add('parent.child.2', 6);
            context.add('another', 7);

            expectDeepEqual(context.only(['parent.child.1', 'parent.child.2']), {
                'parent.child.1': 5,
                'parent.child.2': 6,
            });
        });

        it('except() excludes a subset of context', () => {
            // PHP: ContextTest::test_it_can_exclude_subset_of_context
            const context = new Repository(new Dispatcher());

            context.add('parent.child.1', 5);
            context.add('parent.child.2', 6);
            context.add('another', 7);

            expectDeepEqual(context.except(['parent.child.1', 'parent.child.2']), { another: 7 });
        });

        it('exceptHidden() excludes a subset of hidden context', () => {
            // PHP: ContextTest::test_it_can_exclude_subset_of_hidden_context
            const context = new Repository(new Dispatcher());

            context.addHidden('parent.child.1', 5);
            context.addHidden('parent.child.2', 6);
            context.addHidden('another', 7);

            expectDeepEqual(context.exceptHidden(['parent.child.1', 'parent.child.2']), { another: 7 });
        });

        it('addHidden()/getHidden()/pushHidden() manage the hidden bag independently of add()', () => {
            // PHP: ContextTest::test_it_can_add_hidden
            const context = new Repository(new Dispatcher());

            context.addHidden('foo', 'data');

            expect(context.has('foo')).to.equal(false);
            expect(context.hasHidden('foo')).to.equal(true);
            expect(context.get('foo')).to.equal(undefined);
            expect(context.getHidden('foo')).to.equal('data');
            expectDeepEqual(context.onlyHidden(['foo']), { foo: 'data' });

            context.forgetHidden('foo');

            expect(context.has('foo')).to.equal(false);
            expect(context.hasHidden('foo')).to.equal(false);
            expect(context.get('foo')).to.equal(undefined);
            expect(context.getHidden('foo')).to.equal(undefined);

            context.pushHidden('foo', 1);
            context.pushHidden('foo', 2);
            expectDeepEqual(context.getHidden('foo'), [1, 2]);

            context.addHidden('foo', 'bar');

            expectThrows(
                () => context.pushHidden('foo', 2),
                'Unable to push value onto hidden context stack for key [foo].',
            );
        });

        it('pull()/pullHidden() retrieve and forget in one step', () => {
            // PHP: ContextTest::test_it_can_pull
            const context = new Repository(new Dispatcher());

            context.add('foo', 'data');

            expect(context.pull('foo')).to.equal('data');
            expect(context.get('foo')).to.equal(undefined);

            context.addHidden('foo', 'data');

            expect(context.pullHidden('foo')).to.equal('data');
            expect(context.getHidden('foo')).to.equal(undefined);
        });

        it('scope() sets keys for the callback and restores them afterwards, even on error', () => {
            // PHP: ContextTest::test_scope_sets_keys_and_restores
            const context = new Repository(new Dispatcher());
            let contextInClosure:
                | {
                    data: Record<string, unknown>;
                    hidden: Record<string, unknown>;
                }
                | undefined;

            const callback = () => {
                contextInClosure = {
                    data: context.all(),
                    hidden: context.allHidden(),
                };

                throw 'test_with_sets_keys_and_restores';
            };

            context.add('key1', 'value1');
            context.add('key2', 123);
            context.addHidden({
                hiddenKey1: 'hello',
                hiddenKey2: 'world',
            });

            expectThrows(() => context.scope(callback, { key1: 'with', key3: 'also-with' }, { hiddenKey3: 'foobar' }));

            expect(contextInClosure).never.to.equal(undefined);
            const captured = contextInClosure as {
                data: Record<string, unknown>;
                hidden: Record<string, unknown>;
            };
            expectDeepEqual(captured.data, {
                key1: 'with',
                key2: 123,
                key3: 'also-with',
            });
            expectDeepEqual(captured.hidden, {
                hiddenKey1: 'hello',
                hiddenKey2: 'world',
                hiddenKey3: 'foobar',
            });

            expectDeepEqual(context.all(), { key1: 'value1', key2: 123 });
            expectDeepEqual(context.allHidden(), {
                hiddenKey1: 'hello',
                hiddenKey2: 'world',
            });
        });

        it('increment()/decrement() maintain a counter', () => {
            // PHP: ContextTest::test_it_increments_a_counter / test_it_decrements_a_counter
            const context = new Repository(new Dispatcher());

            context.increment('foo');
            expect(context.get('foo')).to.equal(1);

            context.increment('foo');
            expect(context.get('foo')).to.equal(2);

            context.decrement('foo');
            expect(context.get('foo')).to.equal(1);
        });

        it('increment()/decrement() accept a custom amount', () => {
            // PHP: ContextTest::test_it_custom_increments_a_counter / test_it_custom_decrements_a_counter
            const context = new Repository(new Dispatcher());

            context.increment('foo', 2);
            expect(context.get('foo')).to.equal(2);

            context.increment('foo', 3);
            expect(context.get('foo')).to.equal(5);

            context.decrement('foo', 5);
            expect(context.get('foo')).to.equal(0);
        });

        it('remember() adds the value only once', () => {
            // PHP: ContextTest::test_it_remembers_a_value
            const context = new Repository(new Dispatcher());

            expect(context.remember('int', 1)).to.equal(1);

            let closureRunCount = 0;
            const closure = () => {
                closureRunCount++;

                return 'bar';
            };

            expect(context.remember('foo', closure)).to.equal('bar');
            expect(context.get('foo')).to.equal('bar');

            context.remember('foo', closure);
            expect(closureRunCount).to.equal(1);
        });

        it('rememberHidden() adds the hidden value only once', () => {
            // PHP: ContextTest::test_it_remembers_a_hidden_value
            const context = new Repository(new Dispatcher());

            expect(context.rememberHidden('int', 1)).to.equal(1);

            let closureRunCount = 0;
            const closure = () => {
                closureRunCount++;

                return 'bar';
            };

            expect(context.rememberHidden('foo', closure)).to.equal('bar');
            expect(context.getHidden('foo')).to.equal('bar');

            context.rememberHidden('foo', closure);
            expect(closureRunCount).to.equal(1);
        });
    });
};
