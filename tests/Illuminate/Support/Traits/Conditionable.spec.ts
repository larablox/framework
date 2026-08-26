/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Conditionable } from "Illuminate/Support/Traits/Conditionable";

/**
 * PHP: `Illuminate\Tests\Support\SupportConditionableTest`.
 *
 * `Conditionable.ts`'s class comment: `when()`/`unless()` called with no
 * callback return a `HigherOrderWhenProxy` in PHP, captured through
 * `__get`/`__call`; neither exists here, so the callback is required and the
 * proxy is not ported. `testWhenProxy` and `testUnlessProxy` exercise exactly
 * that proxy form end to end and have nothing to port from.
 */
export = (): void => {
    describe("Conditionable", () => {
        class ConditionableLogger extends Conditionable() {
            public values = new Array<unknown>();

            public log(...values: Array<unknown>): this {
                for (const each of values) {
                    this.values[this.values.size()] = each;
                }

                return this;
            }

            public has(value: unknown): boolean {
                return (this.values as Array<defined>).includes(
                    value as defined,
                );
            }
        }

        it("when() invokes the callback for a truthy static or callback condition", () => {
            // PHP: SupportConditionableTest::testWhenConditionCallback
            const logger = new ConditionableLogger().when(
                2,
                (l, condition) => {
                    return l.log("when", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger.values, ["when", 2]);

            const logger2 = new ConditionableLogger().log("init").when(
                (l) => l.has("init"),
                (l, condition) => {
                    return l.log("when", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger2.values, ["init", "when", true]);
        });

        it("when() invokes the default callback for a falsy condition", () => {
            // PHP: SupportConditionableTest::testWhenDefaultCallback
            const logger = new ConditionableLogger().when(
                undefined as number | undefined,
                (l, condition) => {
                    return l.log("when", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger.values, ["default", undefined]);

            const logger2 = new ConditionableLogger().when(
                (l) => l.has("missing"),
                (l, condition) => {
                    return l.log("when", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger2.values, ["default", false]);
        });

        it("unless() invokes the callback for a falsy static or callback condition", () => {
            // PHP: SupportConditionableTest::testUnlessConditionCallback
            const logger = new ConditionableLogger().unless(
                undefined as number | undefined,
                (l, condition) => {
                    return l.log("unless", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger.values, ["unless", undefined]);

            const logger2 = new ConditionableLogger().unless(
                (l) => l.has("missing"),
                (l, condition) => {
                    return l.log("unless", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger2.values, ["unless", false]);
        });

        it("unless() invokes the default callback for a truthy condition", () => {
            // PHP: SupportConditionableTest::testUnlessDefaultCallback
            const logger = new ConditionableLogger().unless(
                2,
                (l, condition) => {
                    return l.log("unless", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger.values, ["default", 2]);

            const logger2 = new ConditionableLogger().log("init").unless(
                (l) => l.has("init"),
                (l, condition) => {
                    return l.log("unless", condition);
                },
                (l, condition) => {
                    return l.log("default", condition);
                },
            );

            expectDeepEqual(logger2.values, ["init", "default", true]);
        });
    });
};
