import { func_get_arg, func_get_args, func_num_args, truthy } from 'Larablox/php';
import { decoratePackedArgs, PackedArgs } from 'Larablox/TableArgs';

// Nothing to port: these are the port's own stand-ins for PHP language
// built-ins (see CONVENTIONS.md, "func_num_args()"), with no upstream file
// and no upstream test. The cases pin the contract the ported code relies
// on - PHP's scalar truthiness table, and an argument count that survives a
// trailing explicit `undefined` - plus the one documented divergence (an
// empty table is truthy).

class Subject
{
    public name = 'subject';

    /** PHP's `func_num_args()`: the count the caller actually passed. */
    public count(...values: unknown[]): number;
    public count(_args: PackedArgs, ...values: unknown[]): number
    {
        return func_num_args(_args);
    }

    /**
     * PHP's `func_get_arg($position)`: `position` itself is argument 0. Its
     * public overload is rest-only like the others: a typed leading
     * parameter (`position: number`) is not overload-compatible with the
     * implementation's `_args: PackedArgs` (TS2394) - the wall that makes
     * `Conditionable` type `_args` as `any` instead.
     */
    public argAt(...values: unknown[]): unknown;
    public argAt(_args: PackedArgs, position: number, ...values: unknown[]): unknown
    {
        return func_get_arg(_args, position);
    }

    /** PHP's `func_get_args()`: every argument, as passed. */
    public all(...values: unknown[]): Array<unknown>;
    public all(_args: PackedArgs, ...values: unknown[]): Array<unknown>
    {
        return func_get_args(_args);
    }

    /** The method's own declared parameters still arrive after the packed table. */
    public received(...values: unknown[]): Array<unknown>;
    public received(_args: PackedArgs, ...values: unknown[]): Array<unknown>
    {
        return values;
    }

    /** The wrapper keeps `this` bound to the instance. */
    public whoAmI(...values: unknown[]): string;
    public whoAmI(_args: PackedArgs, ...values: unknown[]): string
    {
        return this.name;
    }

    /** Re-enters itself with a different count; the outer count must survive. */
    public nested(...values: unknown[]): Array<number>;
    public nested(_args: PackedArgs, ...values: unknown[]): Array<number>
    {
        const inner = values.size() > 0 ? this.nested() : [];

        return [func_num_args(_args), ...inner];
    }
}

decoratePackedArgs(Subject, 'count');
decoratePackedArgs(Subject, 'argAt');
decoratePackedArgs(Subject, 'all');
decoratePackedArgs(Subject, 'received');
decoratePackedArgs(Subject, 'whoAmI');
decoratePackedArgs(Subject, 'nested');

export = (): void => {
    describe('port-helpers', () => {
        describe('truthy()', () => {
            it('is false for the scalars PHP coerces to false', () => {
                expect(truthy(undefined)).to.equal(false);
                expect(truthy(false)).to.equal(false);
                expect(truthy(0)).to.equal(false);
                expect(truthy(-0)).to.equal(false);
                expect(truthy('')).to.equal(false);
                expect(truthy('0')).to.equal(false);
            });

            it('is true for every other scalar, including the ones that only look falsy', () => {
                expect(truthy(true)).to.equal(true);
                expect(truthy(1)).to.equal(true);
                expect(truthy(-1)).to.equal(true);
                expect(truthy(0.1)).to.equal(true);
                expect(truthy(0 / 0)).to.equal(true);
                expect(truthy(' ')).to.equal(true);
                expect(truthy('00')).to.equal(true);
                expect(truthy('0.0')).to.equal(true);
                expect(truthy('false')).to.equal(true);
            });

            it('is true for functions and objects', () => {
                expect(truthy(() => false)).to.equal(true);
                expect(truthy(new Subject())).to.equal(true);
            });

            it('is true for an empty table, unlike PHP (the documented divergence)', () => {
                expect(truthy([])).to.equal(true);
                expect(truthy({})).to.equal(true);
                expect(truthy(new Map())).to.equal(true);
            });
        });

        describe('func_num_args()', () => {
            it('is 0 when nothing was passed', () => {
                expect(new Subject().count()).to.equal(0);
            });

            it('counts the arguments passed', () => {
                expect(new Subject().count('a')).to.equal(1);
                expect(new Subject().count('a', 'b')).to.equal(2);
                expect(new Subject().count('a', 'b', 'c')).to.equal(3);
            });

            it('counts an explicit undefined, which an omitted argument is not', () => {
                expect(new Subject().count(undefined)).to.equal(1);
                expect(new Subject().count(undefined, undefined)).to.equal(2);
                expect(new Subject().count('a', undefined)).to.equal(2);
            });

            it('is not the packed table\'s size(), which drops a trailing undefined', () => {
                const subject = new Subject();

                expect(subject.all(undefined).size()).to.equal(0);
                expect(subject.count(undefined)).to.equal(1);
            });

            it('survives the method re-entering itself with a different count', () => {
                const counts = new Subject().nested('a', 'b');

                expect(counts[0]).to.equal(2);
                expect(counts[1]).to.equal(0);
            });
        });

        describe('func_get_arg()', () => {
            it('reads the argument at a 0-based position', () => {
                const subject = new Subject();

                expect(subject.argAt(0, 'a', 'b')).to.equal(0);
                expect(subject.argAt(1, 'a', 'b')).to.equal('a');
                expect(subject.argAt(2, 'a', 'b')).to.equal('b');
            });

            it('reads an explicit undefined as undefined', () => {
                expect(new Subject().argAt(1, undefined, 'b')).to.equal(undefined);
            });
        });

        describe('func_get_args()', () => {
            it('returns every argument in order', () => {
                const args = new Subject().all('a', 'b', 'c');

                expect(args.size()).to.equal(3);
                expect(args[0]).to.equal('a');
                expect(args[1]).to.equal('b');
                expect(args[2]).to.equal('c');
            });

            it('returns an empty list when nothing was passed', () => {
                expect(new Subject().all().size()).to.equal(0);
            });
        });

        describe('decoratePackedArgs()', () => {
            it('still hands the method its own declared parameters', () => {
                const values = new Subject().received('a', 'b');

                expect(values.size()).to.equal(2);
                expect(values[0]).to.equal('a');
                expect(values[1]).to.equal('b');
            });

            it('keeps this bound to the instance', () => {
                expect(new Subject().whoAmI('ignored')).to.equal('subject');
            });
        });
    });
};
