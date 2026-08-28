/// <reference types="@rbxts/testez/globals" />
import { Str } from 'Illuminate/Support/Str';

/**
 * PHP: `Illuminate\Tests\Support\SupportStrTest` (identifier/generating and
 * encoding methods: `random`, `password`, `uuid`, `orderedUuid`, `ulid`,
 * `isUuid`, `isUlid`, `isAscii`, `isJson`, `toBase64`, `fromBase64`).
 *
 * `Str::uuid()`/`Str::orderedUuid()` return a Ramsey `UuidInterface` object in
 * PHP (`testUuid` asserts `assertInstanceOf`); this port's `Str.uuid()` /
 * `Str.orderedUuid()` return a plain lowercase string, so that assertion is
 * replaced with a shape check (`isUuid()` on the result) instead of an
 * instance check. `Str::uuid7()` isn't ported (no v7 counterpart), so its
 * assertion in `testUuid` is dropped. The test-factory methods
 * (`createRandomStringsUsing`, `createRandomStringsUsingSequence`,
 * `createUuidsUsing`, `freezeUuids`, `createUlidsUsing`, and their
 * `*Normally()`/`*Sequence()` counterparts) have no counterpart -- `random()`,
 * `uuid()`, `orderedUuid()` and `ulid()` here always draw from `math.random`,
 * so `testRandomStringFactoryCanBeSet`, `testItCanSpecifyASequenceOf...`,
 * `testItCanFreezeUuids*`, `testItCanFreezeUlids*` and their fallback/sequence
 * variants are not ported. `testWhetherTheNumberOfGeneratedCharactersIs...`
 * (620,000 samples for a distribution check) is not ported either -- it is a
 * statistical property of `math.random`, not of this port's logic, and much
 * too slow for a unit test.
 *
 * `Str::isUuid()` takes an optional `$version` in this PHP version; this
 * port's `Str.isUuid()` takes none, so `testIsUuidWithVersion` (which asserts
 * per-version pass/fail) is not ported -- only the plain valid/invalid shape
 * check from `testIsUuidWithValidUuid`/`testIsUuidWithInvalidUuid` survives.
 *
 * `Str::isJson(null)`/`Str::isAscii(null)`/`Str::ascii(null)`/`Str::slug(null)`
 * from `testAsciiNull` are not ported -- every method here takes a required
 * `string`, there is no null overload.
 */
export = (): void => {
    describe('Str identifiers and encoding', () => {
        it('random() generates alphanumeric strings of the given length', () => {
            // PHP: SupportStrTest::testRandom
            expect(Str.random().size()).to.equal(16);
            expect(Str.random(7).size()).to.equal(7);
            expect(typeOf(Str.random())).to.equal('string');
        });

        it('password() generates a password from the requested pools', () => {
            // PHP: SupportStrTest::testPasswordCreation
            expect(Str.password().size()).to.equal(32);
            expect(Str.contains(Str.password(), ' ')).to.equal(false);
            expect(Str.contains(Str.password(32, true, true, true, true), ' ')).to.equal(true);

            expect(
                Str.contains(Str.of(Str.password()).value(), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
            ).to.equal(true);
        });

        it('uuid()/orderedUuid() produce valid, lowercase UUID strings', () => {
            // PHP: SupportStrTest::testUuid (adapted -- see class comment)
            expect(Str.isUuid(Str.uuid())).to.equal(true);
            expect(Str.isUuid(Str.orderedUuid())).to.equal(true);

            const uuid = Str.uuid();

            expect(uuid).to.equal(Str.lower(uuid));
        });

        it('ulid() produces a 26-character Crockford base32 string', () => {
            const ulid = Str.ulid();

            expect(ulid.size()).to.equal(26);
            expect(Str.isUlid(ulid)).to.equal(true);
        });

        it('isUuid() recognizes valid and rejects invalid UUIDs', () => {
            // PHP: SupportStrTest::testIsUuidWithValidUuid / testIsUuidWithInvalidUuid
            const validUuids = [
                'a0a2a2d2-0b87-4a18-83f2-2529882be2de',
                '145a1e72-d11d-11e8-a8d5-f2801f1b9fd1',
                '00000000-0000-0000-0000-000000000000',
                'e60d3f48-95d7-4d8d-aad0-856f29a27da2',
                'ff6f8cb0-c57d-11e1-9b21-0800200c9a66',
                'ff6f8cb0-c57d-21e1-9b21-0800200c9a66',
                'ff6f8cb0-c57d-31e1-9b21-0800200c9a66',
                'ff6f8cb0-c57d-41e1-9b21-0800200c9a66',
                'ff6f8cb0-c57d-51e1-9b21-0800200c9a66',
                'FF6F8CB0-C57D-11E1-9B21-0800200C9A66',
            ];

            for (const uuid of validUuids) {
                expect(Str.isUuid(uuid)).to.equal(true);
            }

            const invalidUuids = [
                'not a valid uuid so we can test this',
                'zf6f8cb0-c57d-11e1-9b21-0800200c9a66',
                '145a1e72-d11d-11e8-a8d5-f2801f1b9fd1\n',
                '145a1e72-d11d-11e8-a8d5-f2801f1b9fd1 ',
                ' 145a1e72-d11d-11e8-a8d5-f2801f1b9fd1',
                '145a1e72-d11d-11e8-a8d5-f2z01f1b9fd1',
                '3f6f8cb0-c57d-11e1-9b21-0800200c9a6',
                'af6f8cb-c57d-11e1-9b21-0800200c9a66',
                'af6f8cb0c57d11e19b210800200c9a66',
                'ff6f8cb0-c57da-51e1-9b21-0800200c9a66',
            ];

            for (const uuid of invalidUuids) {
                expect(Str.isUuid(uuid)).to.equal(false);
            }
        });

        it('isAscii() recognizes 7-bit ASCII strings', () => {
            expect(Str.isAscii('Hello, Laravel!')).to.equal(true);
            expect(Str.isAscii('Héllo')).to.equal(false);
        });

        it('isJson() validates JSON, including the malformed cases', () => {
            // PHP: SupportStrTest::testIsJson (the `null` and array-argument
            // cases are dropped -- see class comment)
            expect(Str.isJson('1')).to.equal(true);
            expect(Str.isJson('[1,2,3]')).to.equal(true);
            expect(Str.isJson('[1,   2,   3]')).to.equal(true);
            expect(Str.isJson('{"first": "John", "last": "Doe"}')).to.equal(true);
            expect(Str.isJson('[{"first": "John", "last": "Doe"}, {"first": "Jane", "last": "Doe"}]')).to.equal(true);

            expect(Str.isJson('1,')).to.equal(false);
            expect(Str.isJson('[1,2,3')).to.equal(false);
            expect(Str.isJson('[1,   2   3]')).to.equal(false);
            expect(Str.isJson('{first: "John"}')).to.equal(false);
            expect(Str.isJson('[{first: "John"}, {first: "Jane"}]')).to.equal(false);
            expect(Str.isJson('')).to.equal(false);
        });

        it('toBase64()/fromBase64() round-trip', () => {
            // PHP: SupportStrTest::testToBase64 / testFromBase64
            expect(Str.toBase64('foo')).to.equal('Zm9v');
            expect(Str.toBase64('foobar')).to.equal('Zm9vYmFy');

            expect(Str.fromBase64(Str.toBase64('foo'))).to.equal('foo');
            expect(Str.fromBase64(Str.toBase64('foobar'))).to.equal('foobar');
        });
    });
};
