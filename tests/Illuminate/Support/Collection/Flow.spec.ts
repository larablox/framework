/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Collection } from "Illuminate/Support/Collection";

/**
 * PHP: `Illuminate\Tests\Support\SupportCollectionTest` -- `tap`, `pipe`,
 * `when`, `unless`, `whenEmpty`, `whenNotEmpty`, `dump`. See
 * `Construction.spec.ts`'s class comment for the adaptations shared across
 * this directory.
 *
 * PHP's `when()`/`unless()`/`whenEmpty()`/`whenNotEmpty()` return whatever
 * the invoked callback returns (falling back to `$this`), which is how
 * `$data = $data->when($cond, fn ($c) => $c->concat([...]))` picks up a
 * *new* collection built by a non-mutating call like `concat()`. This
 * port's `when()` (`Collection.ts`) always returns `this` regardless of the
 * callback's return value, so every scenario here drives the callback with
 * a mutating call (`push()`) instead of `concat()`, preserving the
 * "callback ran / didn't run" behavior under test without relying on the
 * return-value substitution PHP's version does.
 */
export = (): void => {
    describe("Collection flow", () => {
        it("tap() passes the collection to a callback and returns it unchanged", () => {
            // PHP: SupportCollectionTest::testTap
            const data = new Collection([1, 2, 3]);

            let fromTap: Array<number> = [];
            let tappedInstance: Collection<defined, number> | undefined;
            const result = data.tap((collection) => {
                fromTap = collection.slice(0, 1).toArray() as Array<number>;
                tappedInstance = collection;
            });

            expect(result).to.equal(data);
            expect(tappedInstance).to.equal(data);
            expectDeepEqual(fromTap, [1]);
            expectDeepEqual(data.toArray(), [1, 2, 3]);
        });

        it("pipe() passes the collection to a callback and returns its result", () => {
            // PHP: SupportCollectionTest::testPipe
            const data = new Collection([1, 2, 3]);

            expect(data.pipe((collection) => collection.sum())).to.equal(6);
        });

        it("when() runs a callback only if the condition is true, with an otherwise", () => {
            // PHP: SupportCollectionTest::testWhen, ::testWhenDefault
            const data = new Collection(["michael", "tom"]);
            data.when(true, (collection) => collection.push("adam"));
            expectDeepEqual(data.toArray(), ["michael", "tom", "adam"]);

            const untouched = new Collection(["michael", "tom"]);
            untouched.when(false, (collection) => collection.push("adam"));
            expectDeepEqual(untouched.toArray(), ["michael", "tom"]);

            const withOtherwise = new Collection(["michael", "tom"]);
            withOtherwise.when(
                false,
                (collection) => collection.push("adam"),
                (collection) => collection.push("taylor"),
            );
            expectDeepEqual(withOtherwise.toArray(), [
                "michael",
                "tom",
                "taylor",
            ]);
        });

        it("unless() runs a callback only if the condition is false, with an otherwise", () => {
            // PHP: SupportCollectionTest::testUnless, ::testUnlessDefault
            const data = new Collection(["michael", "tom"]);
            data.unless(false, (collection) => collection.push("caleb"));
            expectDeepEqual(data.toArray(), ["michael", "tom", "caleb"]);

            const untouched = new Collection(["michael", "tom"]);
            untouched.unless(true, (collection) => collection.push("caleb"));
            expectDeepEqual(untouched.toArray(), ["michael", "tom"]);
        });

        it("whenEmpty() / whenNotEmpty() branch on the collection's emptiness", () => {
            // PHP: SupportCollectionTest::testWhenEmpty, ::testWhenNotEmpty
            const data = new Collection(["michael", "tom"]);
            data.whenEmpty(() => {
                throw "whenEmpty() should not trigger on a non-empty collection";
            });
            expectDeepEqual(data.toArray(), ["michael", "tom"]);

            const empty = new Collection<number, string>();
            empty.whenEmpty((collection) => collection.push("adam"));
            expectDeepEqual(empty.toArray(), ["adam"]);

            const notEmpty = new Collection(["michael", "tom"]);
            notEmpty.whenNotEmpty((collection) => collection.push("adam"));
            expectDeepEqual(notEmpty.toArray(), ["michael", "tom", "adam"]);

            const stillEmpty = new Collection<number, string>();
            stillEmpty.whenNotEmpty((collection) => collection.push("adam"));
            expectDeepEqual(stillEmpty.toArray(), []);
        });

        it("dump() prints the items and returns the collection unchanged", () => {
            // PHP: SupportCollectionTest::testDump (adapted: PHP asserts on
            // `VarDumper`'s captured output, which this port's `dump()` --
            // a plain `print()` -- has no hook for; only the "returns
            // itself, unchanged" contract is asserted)
            const data = new Collection([1, 2, 3]);

            expect(data.dump()).to.equal(data);
            expectDeepEqual(data.toArray(), [1, 2, 3]);
        });
    });
};
