/// <reference types="@rbxts/testez/globals" />
import { Util } from 'Illuminate/Container/Util';

/**
 * PHP: `Illuminate\Tests\Container\UtilTest`.
 *
 * `testGetParameterClassName` is not ported: it exercises
 * `Util::getParameterClassName(ReflectionParameter)`, and this port's `Util`
 * has no such method at all -- `agent_docs/laravel-parity.md` documents
 * `Container/Util.ts` as shipping "без рефлексивных методов" (without the
 * reflective ones), since constructor/closure parameter types do not survive
 * compilation to Luau.
 *
 * `testArrayWrap` is ported for every case that survives the platform, and
 * two kinds of case are dropped, each documented in `roblox-ts-constraints.md`
 * / `laravel-parity.md`:
 * - `Util::arrayWrap([null])` / `arrayWrap([null, null])` -- a Luau array
 *   cannot hold `nil`, so there is no way to construct the input array in the
 *   first place;
 * - the `serialize()`/`unserialize()` round-trip on a stdClass object -- PHP
 *   serialization does not exist here (`Support/Serializer.ts` is a different,
 *   registry-based mechanism, not a byte-for-byte equivalent).
 */
export = (): void => {
    describe('Util', () => {
        it('unwrapIfClosure() returns a plain value as is, and calls a function value', () => {
            // PHP: UtilTest::testUnwrapIfClosure
            expect(Util.unwrapIfClosure('foo')).to.equal('foo');
            expect(Util.unwrapIfClosure(() => 'foo')).to.equal('foo');
        });

        it("arrayWrap() wraps a scalar, passes an array through, and treats undefined as PHP's null", () => {
            // PHP: UtilTest::testArrayWrap (partial -- see class comment)
            const object = { value: 'a' };

            const wrappedString = Util.arrayWrap('a');
            expect(wrappedString.size()).to.equal(1);
            expect(wrappedString[0]).to.equal('a');

            const array = ['a'];
            const wrappedArray = Util.arrayWrap(array);
            expect(wrappedArray).to.equal(array);

            const wrappedObject = Util.arrayWrap(object);
            expect(wrappedObject.size()).to.equal(1);
            expect(wrappedObject[0]).to.equal(object);

            const wrappedUndefined = Util.arrayWrap(undefined);
            expect(wrappedUndefined.size()).to.equal(0);

            const wrappedEmptyString = Util.arrayWrap('');
            expect(wrappedEmptyString.size()).to.equal(1);
            expect(wrappedEmptyString[0]).to.equal('');

            const emptyStringArray = [''];
            const wrappedEmptyStringArray = Util.arrayWrap(emptyStringArray);
            expect(wrappedEmptyStringArray).to.equal(emptyStringArray);

            const wrappedFalse = Util.arrayWrap(false);
            expect(wrappedFalse.size()).to.equal(1);
            expect(wrappedFalse[0]).to.equal(false);

            const falseArray = [false];
            const wrappedFalseArray = Util.arrayWrap(falseArray);
            expect(wrappedFalseArray).to.equal(falseArray);

            const wrappedZero = Util.arrayWrap(0);
            expect(wrappedZero.size()).to.equal(1);
            expect(wrappedZero[0]).to.equal(0);
        });
    });
};
