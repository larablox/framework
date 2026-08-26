/// <reference types="@rbxts/testez/globals" />
import { expectDeepEqual } from "../../TestHelpers";
import { Arr, ArrayAccessible } from "Illuminate/Support/Arr";
import { Collection } from "Illuminate/Support/Collection";

/**
 * PHP: `Illuminate\Tests\Support\SupportArrTest` -- the methods that address
 * keys with "dot" notation: `accessible`, `exists`, `wrap`, `get`, `has`,
 * `hasAll`, `hasAny`, `set`, `add`, `push`, `forget`, `pull`, `only`,
 * `except`, `prependKeysWith`, `dot`, `undot`, `isAssoc`, `isList`. These all
 * take/return `ArrayAccessible` (`Arr.ts`'s own doc comment: "a nested table
 * addressed by string keys, as produced by an object literal") -- see
 * `Arr.ts`'s class comment and `laravel-parity.md`'s "Arr: список и карта"
 * section for why that is a different contract than PHP's single array type.
 *
 * Systematic adaptations, applying throughout this file:
 *
 * - **No `nil`-as-a-value.** A Luau table cannot hold `nil`, so an entry that
 *   is *present but null* is indistinguishable from an *absent* entry --
 *   `{foo: undefined}` never actually gets a `foo` key at all. PHP cases that
 *   depend on that distinction (`Arr::get(['foo' => null], 'foo', 'default')`
 *   returning `null`, not `'default'`) have no counterpart and are dropped.
 * - **No closure-unwrapping default.** PHP's `Arr::get`/`first`/`last` call
 *   `value($default)`, invoking a `Closure` default and returning its result.
 *   This port's `defaultValue` parameter is returned as-is, never invoked --
 *   so the "default is a callback" sub-cases are dropped, keeping the
 *   plain-literal-default sub-cases.
 * - **No `ArrayAccess` objects.** PHP exercises `ArrayObject` wrappers
 *   nested inside plain arrays; there is no such interface here, and every
 *   accessible value is already a plain table, so those cases are dropped.
 * - **Keys are always strings.** An object literal's keys compile to Luau
 *   *strings*, never numbers -- unlike a real array literal, whose keys are
 *   genuine Lua integers. So PHP scenarios that lean on int-vs-string key
 *   coercion (`Arr::add([], 1, 'hAz')`, `Arr::except([1 => 'hAz', ...], 2)`,
 *   `Arr::only(['foo', 'bar', 'baz'], 0)`) have no faithful translation and
 *   are dropped; a numeric *path segment* (`'products.0.name'`) is kept by
 *   spelling the fixture as an object literal with a quoted `"0"` key, which
 *   is exactly what the segment string will look up.
 */
export = (): void => {
    describe("Arr keyed access", () => {
        it("accessible() recognizes tables and rejects everything else", () => {
            // PHP: SupportArrTest::testAccessible (ArrayAccess/stdClass cases
            // dropped -- Arr.accessible() only asks typeIs(value, "table"),
            // and every compiled class instance is a table too, so it cannot
            // reject a plain object the way PHP rejects a bare stdClass)
            expect(Arr.accessible({})).to.equal(true);
            expect(Arr.accessible([1, 2])).to.equal(true);
            expect(Arr.accessible({ a: 1, b: 2 })).to.equal(true);
            expect(Arr.accessible(new Collection([1, 2]))).to.equal(true);

            expect(Arr.accessible(undefined)).to.equal(false);
            expect(Arr.accessible("abc")).to.equal(false);
            expect(Arr.accessible(123)).to.equal(false);
            expect(Arr.accessible(12.34)).to.equal(false);
            expect(Arr.accessible(true)).to.equal(false);
            expect(Arr.accessible(() => undefined)).to.equal(false);
        });

        it("exists() checks a key or index", () => {
            // PHP: SupportArrTest::testExists (Collection-with-null and
            // ArrayAccess-object cases dropped, see class comment)
            // A Luau list starts at 1, so PHP's index 0/1 pair becomes 1/2 --
            // the case under test ("an index that is there" against "one that
            // is not") is what carries over, not the number itself.
            expect(Arr.exists([1], 1)).to.equal(true);
            expect(Arr.exists({ a: 1 }, "a")).to.equal(true);

            expect(Arr.exists([1], 2)).to.equal(false);
            expect(Arr.exists({ a: 1 }, "b")).to.equal(false);
        });

        it("wrap() wraps a bare value, passes an array through, and turns undefined into []", () => {
            // PHP: SupportArrTest::testWrap (WeakMap/serialize-roundtrip
            // cases dropped -- no such concepts here)
            const object = { value: "a" };

            expectDeepEqual(Arr.wrap("a"), ["a"]);
            const array = ["a"];
            expect(Arr.wrap(array)).to.equal(array);
            expectDeepEqual(Arr.wrap(object), [object]);
            expectDeepEqual(Arr.wrap(undefined), []);
            expectDeepEqual(Arr.wrap([undefined as unknown as string]), [
                undefined,
            ]);
            expectDeepEqual(Arr.wrap(""), [""]);
            expectDeepEqual(Arr.wrap([""]), [""]);
            expectDeepEqual(Arr.wrap(false), [false]);
            expectDeepEqual(Arr.wrap([false]), [false]);
            expectDeepEqual(Arr.wrap(0), [0]);
        });

        it("get() reads a value using dot notation", () => {
            // PHP: SupportArrTest::testGet (ArrayAccess-object and
            // present-but-null cases dropped, see class comment)
            expectDeepEqual(
                Arr.get({ "products.desk": { price: 100 } }, "products.desk"),
                { price: 100 },
            );

            expectDeepEqual(
                Arr.get(
                    { products: { desk: { price: 100 } } },
                    "products.desk",
                ),
                { price: 100 },
            );

            // Null key returns the whole target.
            const array = ["foo", "bar"];
            expect(Arr.get(array, undefined)).to.equal(array);

            // Target is not accessible.
            expect(Arr.get(undefined, "foo", "default")).to.equal("default");
            expect(Arr.get(false, "foo", "default")).to.equal("default");
            expect(Arr.get(undefined, undefined, "default")).to.equal(
                "default",
            );

            // Target is empty and key is undefined.
            const empty = {};
            expect(Arr.get(empty, undefined)).to.equal(empty);

            // Numeric path segments -- kept as quoted string keys, see class
            // comment.
            const products = {
                products: {
                    "0": { name: "desk" },
                    "1": { name: "chair" },
                },
            };
            expect(Arr.get(products, "products.0.name")).to.equal("desk");
            expect(Arr.get(products, "products.1.name")).to.equal("chair");

            // Default value for a missing key.
            expect(
                Arr.get(
                    { names: { developer: "taylor" } },
                    "names.otherDeveloper",
                    "dayle",
                ),
            ).to.equal("dayle");

            // Empty-string keys.
            expect(Arr.get({ "": "bar" }, "")).to.equal("bar");
            expect(Arr.get({ "": { "": "bar" } }, ".")).to.equal("bar");
        });

        it("has() checks for one or many dotted keys", () => {
            // PHP: SupportArrTest::testHas (ArrayAccess-object cases
            // dropped, see class comment)
            expect(
                Arr.has({ "products.desk": { price: 100 } }, "products.desk"),
            ).to.equal(true);

            const products = { products: { desk: { price: 100 } } };
            expect(Arr.has(products, "products.desk")).to.equal(true);
            expect(Arr.has(products, "products.desk.price")).to.equal(true);
            expect(Arr.has(products, "products.foo")).to.equal(false);
            expect(Arr.has(products, "products.desk.foo")).to.equal(false);

            const array = ["foo", "bar"];
            expect(Arr.has(array, undefined as unknown as string)).to.equal(
                false,
            );

            expect(Arr.has(undefined, "foo")).to.equal(false);
            expect(Arr.has(false, "foo")).to.equal(false);
            expect(Arr.has(undefined, undefined as unknown as string)).to.equal(
                false,
            );
            expect(Arr.has({}, undefined as unknown as string)).to.equal(false);

            expect(Arr.has(products, ["products.desk"])).to.equal(true);
            expect(
                Arr.has(products, ["products.desk", "products.desk.price"]),
            ).to.equal(true);
            expect(Arr.has(products, ["products", "products"])).to.equal(true);
            expect(Arr.has(products, ["foo"])).to.equal(false);
            expect(Arr.has(products, [])).to.equal(false);
            expect(
                Arr.has(products, ["products.desk", "products.price"]),
            ).to.equal(false);

            // Numeric path segment, spelled the way the class comment
            // describes -- a quoted key, since a path segment is a string and
            // a real list is keyed by numbers.
            const nested = { products: { "0": { name: "desk" } } };
            expect(Arr.has(nested, "products.0.name")).to.equal(true);
            expect(Arr.has(nested, "products.0.price")).to.equal(false);

            expect(Arr.has({ "": "some" }, "")).to.equal(true);
            expect(Arr.has({ "": "some" }, [""])).to.equal(true);
            expect(Arr.has([""], "")).to.equal(false);
            expect(Arr.has({}, "")).to.equal(false);
            expect(Arr.has({}, [""])).to.equal(false);
        });

        it("hasAll() checks that every dotted key is present", () => {
            // PHP: SupportArrTest::testHasAllMethod (PHP's `city` is present
            // but `null` -- no such value exists here, see class comment --
            // adapted to an empty string, which is present-but-falsy the
            // same way `null` is for this check)
            const array = { name: "Taylor", age: "", city: "" };
            expect(Arr.hasAll(array, "name")).to.equal(true);
            expect(Arr.hasAll(array, "age")).to.equal(true);
            expect(Arr.hasAll(array, ["age", "car"])).to.equal(false);
            expect(Arr.hasAll(array, "city")).to.equal(true);
            expect(Arr.hasAll(array, ["city", "some"])).to.equal(false);
            expect(Arr.hasAll(array, ["name", "age", "city"])).to.equal(true);
            expect(
                Arr.hasAll(array, ["name", "age", "city", "country"]),
            ).to.equal(false);

            const user = { user: { name: "Taylor" } };
            expect(Arr.hasAll(user, "user.name")).to.equal(true);
            expect(Arr.hasAll(user, "user.age")).to.equal(false);

            expect(Arr.hasAll({ name: "Taylor" }, "foo")).to.equal(false);
            expect(
                Arr.hasAll({ name: "Taylor" }, ["foo", "bar", "baz", "bar"]),
            ).to.equal(false);
        });

        it("hasAny() checks that at least one dotted key is present", () => {
            // PHP: SupportArrTest::testHasAnyMethod (PHP also calls
            // `Arr::hasAny($array, 'name', 'email')` with the keys spread
            // across two variadic string arguments -- this port's `hasAny`
            // takes a single `string | Array<string>`, so those calls are
            // folded into the equivalent array-form call already exercised
            // below, rather than duplicated)
            const array = { name: "Taylor", age: "" };
            expect(Arr.hasAny(array, "name")).to.equal(true);
            expect(Arr.hasAny(array, "age")).to.equal(true);
            expect(Arr.hasAny(array, "foo")).to.equal(false);
            expect(Arr.hasAny(array, ["name", "email"])).to.equal(true);

            const withEmail = { name: "Taylor", email: "foo" };
            expect(Arr.hasAny(withEmail, ["name", "email"])).to.equal(true);
            expect(Arr.hasAny(withEmail, ["surname", "password"])).to.equal(
                false,
            );

            const nested = { foo: { bar: undefined as unknown, baz: "" } };
            expect(Arr.hasAny(nested, "foo.baz")).to.equal(true);
            expect(Arr.hasAny(nested, "foo.bax")).to.equal(false);
            expect(Arr.hasAny(nested, ["foo.bax", "foo.baz"])).to.equal(true);
        });

        it("set() writes a value using dot notation, creating intermediate tables", () => {
            // PHP: SupportArrTest::testSet
            const array: { products: { desk: { price: number } } } = {
                products: { desk: { price: 100 } },
            };
            Arr.set(array, "products.desk.price", 200);
            expectDeepEqual(array, { products: { desk: { price: 200 } } });

            const nested = { table: 0 };
            Arr.set(nested, "table", 500);
            expect(nested.table).to.equal(500);

            const empty: Record<string, unknown> = {};
            Arr.set(empty, "products.desk.price", 200);
            expectDeepEqual(empty, { products: { desk: { price: 200 } } });

            const override: Record<string, unknown> = { products: "table" };
            Arr.set(override, "products.desk.price", 300);
            expectDeepEqual(override, { products: { desk: { price: 300 } } });
        });

        it("add() sets a value only if the dotted key is not already present", () => {
            // PHP: SupportArrTest::testAdd (int-key cases dropped, see class
            // comment)
            expectDeepEqual(Arr.add({ name: "Desk" }, "price", 100), {
                name: "Desk",
                price: 100,
            });
            expectDeepEqual(Arr.add({}, "surname", "Mövsümov"), {
                surname: "Mövsümov",
            });
            expectDeepEqual(Arr.add({}, "developer.name", "Ferid"), {
                developer: { name: "Ferid" },
            });

            // The key already exists.
            expectDeepEqual(Arr.add({ type: "Table" }, "type", "Chair"), {
                type: "Table",
            });
            expectDeepEqual(
                Arr.add(
                    { category: { type: "Table" } },
                    "category.type",
                    "Chair",
                ),
                { category: { type: "Table" } },
            );
        });

        it("push() appends values onto a dotted array key", () => {
            // PHP: SupportArrTest::testPush (the null-key "push onto the
            // whole array" form and the InvalidArgumentException branch are
            // dropped: `key` is a required `string` here -- there is no
            // "whole array" key -- and the port's error path does not raise
            // the same message, see class comment)
            const array: Record<string, unknown> = {};

            Arr.push(array, "office.furniture", "Desk");
            expectDeepEqual(
                (array.office as { furniture: Array<string> }).furniture,
                ["Desk"],
            );

            Arr.push(array, "office.furniture", "Chair", "Lamp");
            expectDeepEqual(
                (array.office as { furniture: Array<string> }).furniture,
                ["Desk", "Chair", "Lamp"],
            );
        });

        it("forget() removes one or many dotted keys", () => {
            // PHP: SupportArrTest::testForget
            const nullKey = { products: { desk: { price: 100 } } };
            Arr.forget(nullKey, []);
            expectDeepEqual(nullKey, { products: { desk: { price: 100 } } });

            const desk = { products: { desk: { price: 100 } } };
            Arr.forget(desk, "products.desk");
            expectDeepEqual(desk, { products: {} });

            const price = { products: { desk: { price: 100 } } };
            Arr.forget(price, "products.desk.price");
            expectDeepEqual(price, { products: { desk: {} } });

            const missing = { products: { desk: { price: 100 } } };
            Arr.forget(missing, "products.final.price");
            expectDeepEqual(missing, { products: { desk: { price: 100 } } });

            const taxes = {
                products: { desk: { price: { original: 50, taxes: 60 } } },
            };
            Arr.forget(taxes, "products.desk.price.taxes");
            expectDeepEqual(taxes, {
                products: { desk: { price: { original: 50 } } },
            });

            const many = { products: { desk: { price: 50 }, "": "something" } };
            Arr.forget(many, ["products.amount.all", "products.desk.price"]);
            expectDeepEqual(many, { products: { desk: {}, "": "something" } });

            // Only works on first-level keys -- a literal dotted key does
            // not resolve through nested tables.
            const emails: Record<string, unknown> = {
                "joe@example.com": "Joe",
                "jane@example.com": "Jane",
            };
            Arr.forget(emails, "joe@example.com");
            expectDeepEqual(emails, { "jane@example.com": "Jane" });

            const nestedEmails = {
                emails: {
                    "joe@example.com": { name: "Joe" },
                    "jane@localhost": { name: "Jane" },
                },
            };
            Arr.forget(nestedEmails, [
                "emails.joe@example.com",
                "emails.jane@localhost",
            ]);
            expectDeepEqual(nestedEmails, {
                emails: { "joe@example.com": { name: "Joe" } },
            });

            // A top-level key following a dotted key resolves against the
            // top level, not through it.
            const topLevel = { users: { name: "Joe", id: 1 }, id: 99 };
            Arr.forget(topLevel, ["users.name", "id"]);
            expectDeepEqual(topLevel, { users: { id: 1 } });
        });

        it("pull() reads a dotted value and removes it", () => {
            // PHP: SupportArrTest::testPull (int-key case dropped, see class
            // comment)
            const array = { name: "Desk", price: 100 };
            expect(Arr.pull(array, "name")).to.equal("Desk");
            expectDeepEqual(array, { price: 100 });

            // Only works on first-level keys.
            const emails = {
                "joe@example.com": "Joe",
                "jane@localhost": "Jane",
            };
            expect(Arr.pull(emails, "joe@example.com")).to.equal("Joe");
            expectDeepEqual(emails, { "jane@localhost": "Jane" });

            // Does not work for nested keys.
            const nested = {
                emails: { "joe@example.com": "Joe", "jane@localhost": "Jane" },
            };
            expect(Arr.pull(nested, "emails.joe@example.com")).to.equal(
                undefined,
            );
            expectDeepEqual(nested, {
                emails: { "joe@example.com": "Joe", "jane@localhost": "Jane" },
            });
        });

        it("only() keeps a subset of dotted keys", () => {
            // PHP: SupportArrTest::testOnly (int-key list cases dropped --
            // `only()` addresses `ArrayAccessible`, string keys only, see
            // class comment)
            const array = { name: "Desk", price: 100, orders: 10 };
            expectDeepEqual(Arr.only(array, ["name", "price"]), {
                name: "Desk",
                price: 100,
            });
            expectDeepEqual(Arr.only(array, ["nonExistingKey"]), {});
            expectDeepEqual(
                Arr.only(array, undefined as unknown as Array<string>),
                {},
            );
        });

        it("except() drops a subset of dotted keys", () => {
            // PHP: SupportArrTest::testExcept (int-key cases dropped, see
            // class comment)
            const array = { name: "taylor", age: 26 };
            expectDeepEqual(Arr.except(array, ["name"]), { age: 26 });
            expectDeepEqual(Arr.except(array, "name"), { age: 26 });

            const nested = {
                name: "taylor",
                framework: { language: "PHP", name: "Laravel" },
            };
            expectDeepEqual(Arr.except(nested, "framework"), {
                name: "taylor",
            });
            expectDeepEqual(Arr.except(nested, "framework.language"), {
                name: "taylor",
                framework: { name: "Laravel" },
            });
            expectDeepEqual(Arr.except(nested, ["name", "framework.name"]), {
                framework: { language: "PHP" },
            });
        });

        it("prependKeysWith() prefixes every top-level key", () => {
            // PHP: SupportArrTest::testPrependKeysWith
            const array = {
                id: "123",
                data: "456",
                list: [1, 2, 3],
                meta: { key: 1 },
            };

            expectDeepEqual(Arr.prependKeysWith(array, "test."), {
                "test.id": "123",
                "test.data": "456",
                "test.list": [1, 2, 3],
                "test.meta": { key: 1 },
            });
        });

        it("dot() flattens a nested table with dotted keys", () => {
            // PHP: SupportArrTest::testDot (int-key cases dropped, see class
            // comment)
            expectDeepEqual(Arr.dot({ foo: { bar: "baz" } }), {
                "foo.bar": "baz",
            });
            expectDeepEqual(Arr.dot({}), {});
            expectDeepEqual(Arr.dot({ foo: {} }), { foo: {} });
            expectDeepEqual(Arr.dot({ foo: { bar: {} } }), { "foo.bar": {} });
            expectDeepEqual(
                Arr.dot({ name: "taylor", languages: { php: true } }),
                { name: "taylor", "languages.php": true },
            );

            expectDeepEqual(
                Arr.dot({
                    user: {
                        name: "Taylor",
                        age: 25,
                        languages: ["PHP", "C#"],
                    },
                }),
                {
                    "user.name": "Taylor",
                    "user.age": 25,
                    // A Luau list is keyed from 1, so the flattened indices
                    // shift by one against PHP's.
                    "user.languages.1": "PHP",
                    "user.languages.2": "C#",
                },
            );

            expectDeepEqual(
                Arr.dot({
                    foo: "bar",
                    empty_array: {},
                    user: { name: "Taylor" },
                    key: "value",
                }),
                {
                    foo: "bar",
                    empty_array: {},
                    "user.name": "Taylor",
                    key: "value",
                },
            );
        });

        it("dot() honors the depth argument", () => {
            // PHP: SupportArrTest::testDotWithDepth
            expectDeepEqual(
                Arr.dot(
                    { user: { name: "Taylor", address: { city: "Dallas" } } },
                    "",
                    1,
                ),
                {
                    "user.name": "Taylor",
                    "user.address": { city: "Dallas" },
                },
            );

            expectDeepEqual(
                Arr.dot(
                    { user: { address: { city: { name: "Dallas" } } } },
                    "",
                    2,
                ),
                { "user.address.city": { name: "Dallas" } },
            );

            expectDeepEqual(
                Arr.dot(
                    { user: { address: { city: { name: "Dallas" } } } },
                    "",
                    math.huge,
                ),
                { "user.address.city.name": "Dallas" },
            );

            expectDeepEqual(
                Arr.dot(
                    { user: { name: "Taylor", address: { city: "Dallas" } } },
                    "",
                    0,
                ),
                {
                    user: { name: "Taylor", address: { city: "Dallas" } },
                },
            );

            expectDeepEqual(
                Arr.dot({ user: { name: "Taylor" } }, "prefix.", 1),
                { "prefix.user.name": "Taylor" },
            );
        });

        it("undot() expands a flattened dotted table", () => {
            // PHP: SupportArrTest::testUndot
            expectDeepEqual(
                Arr.undot({
                    "user.name": "Taylor",
                    "user.age": 25,
                    "user.languages.0": "PHP",
                    "user.languages.1": "C#",
                }),
                {
                    user: {
                        name: "Taylor",
                        age: 25,
                        languages: { "0": "PHP", "1": "C#" },
                    },
                },
            );

            expectDeepEqual(
                Arr.undot({
                    "pagination.previous": "<<",
                    "pagination.next": ">>",
                }),
                { pagination: { previous: "<<", next: ">>" } },
            );
        });

        it("isAssoc() / isList() tell a map apart from a sequence", () => {
            // PHP: SupportArrTest::testIsAssoc / testIsList (mixed
            // numeric/string-key cases dropped -- an object literal's keys
            // are always Luau strings, never the genuine Lua integers a real
            // array literal produces, so there is no faithful way to build
            // PHP's "numeric keys out of order" fixtures here, see class
            // comment)
            expect(Arr.isList([])).to.equal(true);
            expect(Arr.isList([1, 2, 3])).to.equal(true);
            expect(Arr.isList(["foo", 2, 3])).to.equal(true);
            expect(Arr.isList(["foo", "bar"])).to.equal(true);

            expect(Arr.isList({ foo: "bar", baz: "qux" })).to.equal(false);

            expect(Arr.isAssoc([] as unknown as ArrayAccessible)).to.equal(
                false,
            );
            expect(
                Arr.isAssoc([1, 2, 3] as unknown as ArrayAccessible),
            ).to.equal(false);
            expect(
                Arr.isAssoc(["foo", 2, 3] as unknown as ArrayAccessible),
            ).to.equal(false);

            expect(Arr.isAssoc({ foo: "bar", baz: "qux" })).to.equal(true);
        });
    });
};
