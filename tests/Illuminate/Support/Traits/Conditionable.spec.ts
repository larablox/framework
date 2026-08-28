/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from '../../TestHelpers';
import { Conditionable } from 'Illuminate/Support/Traits/Conditionable';

/**
 * PHP: `Illuminate\Tests\Support\SupportConditionableTest`.
 *
 * The proxy tests (`testWhenProxy`, `testUnlessProxy`) are adapted from the
 * upstream test's documented behavior -- the composer dist ships no tests to
 * copy from: a zero-argument `when()`/`unless()` captures the condition from
 * the next property or method access and applies the one after it.
 */
export = (): void => {
    describe('Conditionable', () => {
        class ConditionableLogger extends Conditionable()
        {
            public values = new Array<unknown>();

            public truthy = true;

            public falsy = false;

            public log(...values: Array<unknown>): this
            {
                for (const each of values) {
                    this.values[this.values.size()] = each;
                }

                return this;
            }

            public has(value: unknown): boolean
            {
                return (this.values as Array<defined>).includes(value as defined);
            }

            public truthyMethod(): boolean
            {
                return true;
            }

            public falsyMethod(): boolean
            {
                return false;
            }
        }

        it('when() with no arguments captures the condition from the next access', () => {
            // PHP: SupportConditionableTest::testWhenProxy (adapted -- see
            // the class comment)
            const logger = new ConditionableLogger();

            logger.when().truthy.log('one');
            logger.when().falsy.log('two');
            logger.when().truthyMethod().log('three');
            logger.when().falsyMethod().log('four');

            expectDeepEqual(logger.values, [
                'one',
                'three',
            ]);
        });

        it('unless() with no arguments captures the negated condition', () => {
            // PHP: SupportConditionableTest::testUnlessProxy (adapted -- see
            // the class comment)
            const logger = new ConditionableLogger();

            logger.unless().truthy.log('one');
            logger.unless().falsy.log('two');
            logger.unless().truthyMethod().log('three');
            logger.unless().falsyMethod().log('four');

            expectDeepEqual(logger.values, [
                'two',
                'four',
            ]);
        });

        it('when() and unless() with only a value return a conditioned proxy', () => {
            // PHP: the func_num_args() === 1 branch -- (new
            // HigherOrderWhenProxy($this))->condition($value)
            const logger = new ConditionableLogger();

            logger.when(true).log('one');
            logger.when(false).log('two');
            logger.unless(true).log('three');
            logger.unless(false).log('four');

            expectDeepEqual(logger.values, [
                'one',
                'four',
            ]);
        });

        it('when() invokes the callback for a truthy static or callback condition', () => {
            // PHP: SupportConditionableTest::testWhenConditionCallback
            const logger = new ConditionableLogger().when(
                2,
                (l, condition) => {
                    return l.log('when', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger.values, [
                'when',
                2,
            ]);

            const logger2 = new ConditionableLogger().log('init').when(
                (l) => l.has('init'),
                (l, condition) => {
                    return l.log('when', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger2.values, [
                'init',
                'when',
                true,
            ]);
        });

        it('when() invokes the default callback for a falsy condition', () => {
            // PHP: SupportConditionableTest::testWhenDefaultCallback
            const logger = new ConditionableLogger().when(
                undefined as number | undefined,
                (l, condition) => {
                    return l.log('when', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger.values, [
                'default',
                undefined,
            ]);

            const logger2 = new ConditionableLogger().when(
                (l) => l.has('missing'),
                (l, condition) => {
                    return l.log('when', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger2.values, [
                'default',
                false,
            ]);
        });

        it('unless() invokes the callback for a falsy static or callback condition', () => {
            // PHP: SupportConditionableTest::testUnlessConditionCallback
            const logger = new ConditionableLogger().unless(
                undefined as number | undefined,
                (l, condition) => {
                    return l.log('unless', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger.values, [
                'unless',
                undefined,
            ]);

            const logger2 = new ConditionableLogger().unless(
                (l) => l.has('missing'),
                (l, condition) => {
                    return l.log('unless', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger2.values, [
                'unless',
                false,
            ]);
        });

        it('unless() invokes the default callback for a truthy condition', () => {
            // PHP: SupportConditionableTest::testUnlessDefaultCallback
            const logger = new ConditionableLogger().unless(
                2,
                (l, condition) => {
                    return l.log('unless', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger.values, [
                'default',
                2,
            ]);

            const logger2 = new ConditionableLogger().log('init').unless(
                (l) => l.has('init'),
                (l, condition) => {
                    return l.log('unless', condition);
                },
                (l, condition) => {
                    return l.log('default', condition);
                },
            );

            expectDeepEqual(logger2.values, [
                'init',
                'default',
                true,
            ]);
        });
    });
};
