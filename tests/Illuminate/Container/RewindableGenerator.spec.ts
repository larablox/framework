/// <reference types="@rbxts/testez/globals" />
import { RewindableGenerator } from 'Illuminate/Container/RewindableGenerator';

/**
 * PHP: `Illuminate\Tests\Container\RewindableGeneratorTest`.
 *
 * Ported in full -- both PHP tests translate directly, since `count()` /
 * `Countable` maps straight onto the port's own `count()` method.
 */
export = (): void => {
    describe('RewindableGenerator', () => {
        it('count() uses the provided value', () => {
            // PHP: RewindableGeneratorTest::testCountUsesProvidedValue
            const generator = new RewindableGenerator<string>(function* () {
                yield 'foo';
            }, 999);

            expect(generator.count()).to.equal(999);
        });

        it('count() uses the provided value as a callback, called lazily and only once', () => {
            // PHP: RewindableGeneratorTest::testCountUsesProvidedValueAsCallback
            let called = 0;

            const generator = new RewindableGenerator<string>(
                function* () {
                    yield 'foo';
                },
                () => {
                    called++;

                    return 500;
                },
            );

            // the count callback is called lazily
            expect(called).to.equal(0);

            expect(generator.count()).to.equal(500);

            generator.count();

            // the count callback is called only once
            expect(called).to.equal(1);
        });
    });
};
