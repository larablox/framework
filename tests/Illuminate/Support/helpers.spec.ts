import { HigherOrderTapProxy, HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';
import { tap } from 'Illuminate/Support/helpers';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `SupportHelpersTest.php` here to port literally. Only `tap()` is
// covered here, ported alongside `Tappable` (which delegates to it); the
// port-invented PHP stand-ins (`truthy()`, `func_num_args()`, ...) live in
// `Larablox/php.ts` and have their own spec. These cases are
// reconstructed from tap()'s own behavior, covering
// what upstream's `SupportHelpersTest::testTap` is known to name - the
// callback form hands the value to the callback and returns the value, and
// the proxy form (`tap($mock)->foo()`) reaches the target's method and
// hands back the target, never `foo()`'s own result - plus the explicit-
// `null` branch of `is_null($callback)` and the primitive values the
// callback form accepts, which no proxy could.

class Subject
{
    public active = false;

    public calls: Array<string> = [];

    public isActive(): boolean
    {
        return this.active;
    }

    public activate(reason: string): string
    {
        this.active = true;
        this.calls.push(`activate:${reason}`);

        return `activated:${reason}`;
    }
}

export = (): void => {
    describe('helpers', () => {
        describe('tap()', () => {
            it('with a callback: hands the value to the callback and returns the value', () => {
                const subject = new Subject();
                let received: Subject | undefined;

                const result: Subject = tap(subject, (value) => {
                    received = value;
                });

                expect(received).to.equal(subject);
                expect(result).to.equal(subject);
            });

            it('with a callback: returns the value, not the result of the callback', () => {
                const subject = new Subject();

                const result = tap(subject, (value) => value.activate('callback'));

                expect(result).to.equal(subject);
                expect(result).never.to.equal('activated:callback');
                expect(subject.calls[0]).to.equal('activate:callback');
            });

            it('with a callback: accepts a primitive value, which no proxy could wrap', () => {
                let received: number | undefined;

                const result: number = tap(5, (value) => {
                    received = value;
                });

                expect(received).to.equal(5);
                expect(result).to.equal(5);
            });

            it('without a callback: returns a tap proxy around the value', () => {
                const subject = new Subject();

                const result: HigherOrderTapProxyView<Subject> = tap(subject);

                expect((result as unknown as HigherOrderTapProxy<Subject>).target).to.equal(subject);
                expect(subject.calls.size()).to.equal(0);
            });

            it('without a callback: the proxy forwards the next method call and hands back the value, not the result', () => {
                const subject = new Subject();

                const result: Subject = tap(subject).activate('proxied');

                expect(result).to.equal(subject);
                expect(subject.calls[0]).to.equal('activate:proxied');
                expect(subject.isActive()).to.equal(true);
            });

            it('with an explicit undefined callback: takes the is_null() branch and returns the proxy', () => {
                const subject = new Subject();
                const callback: ((value: Subject) => unknown) | undefined = undefined;

                const result: HigherOrderTapProxyView<Subject> | Subject = tap(subject, callback);

                expect(result).never.to.equal(subject);
                expect((result as unknown as HigherOrderTapProxy<Subject>).target).to.equal(subject);
            });
        });
    });
};
