import { HigherOrderTapProxy, HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';
import { Tappable } from 'Illuminate/Support/Traits/Tappable';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `SupportTappableTest.php` here to port literally. The first two cases
// mirror the two scenarios upstream's `SupportTappableTest` is known to
// name that apply here - `testTappableClassWithCallback` (the callback
// receives the instance, and the instance itself comes back to chain on)
// and `testTappableClassWithoutCallback` (the proxy form forwards the next
// method call to the instance and hands the instance back) - on the same
// `setName()`/`getName()` shape as upstream's `TappableClass`. Upstream's
// invokable-object cases (`testTappableClassWithInvokableClass`,
// `testTappableClassWithNoneInvokableClass`) have no counterpart: PHP's
// `__invoke` is not a construct this port has. The rest are reconstructed
// from Tappable's own behavior: what the callback is handed, what is
// discarded, the explicit-`undefined` form PHP's `is_null()` treats the
// same as an omitted callback, and the typed shape each overload promises.

class TappableClass extends Tappable(class
{
    public name?: string;

    public calls: Array<string> = [];

    public setName(name: string): this
    {
        this.name = name;
        this.calls.push(`setName:${name}`);

        return this;
    }

    public getName(): string | undefined
    {
        this.calls.push('getName');

        return this.name;
    }
})
{}

export = (): void => {
    describe('Tappable', () => {
        describe('tap()', () => {
            it('with a callback: the callback receives the instance, and the instance comes back to chain on', () => {
                const name = new TappableClass().tap((tappable) => {
                    tappable.setName('MyName');
                }).getName();

                expect(name).to.equal('MyName');
            });

            it('without a callback: the proxy forwards the next method call to the instance and hands the instance back', () => {
                const name = new TappableClass().tap().setName('MyName').getName();

                expect(name).to.equal('MyName');
            });

            it('hands the callback the instance itself', () => {
                const tappable = new TappableClass();
                let received: TappableClass | undefined;

                tappable.tap((instance) => {
                    received = instance;
                });

                expect(received).to.equal(tappable);
            });

            it('returns the instance, not the result of the callback', () => {
                const tappable = new TappableClass();

                const result: TappableClass = tappable.tap(() => 'ignored');

                expect(result).to.equal(tappable);
            });

            it('the proxy hands the instance back even when the forwarded method returns something else', () => {
                const tappable = new TappableClass().setName('MyName');

                const result: TappableClass = tappable.tap().getName();

                expect(result).to.equal(tappable);
                expect(tappable.calls[1]).to.equal('getName');
            });

            it('the proxy forwards the parameters of the call it hands on', () => {
                const tappable = new TappableClass();

                tappable.tap().setName('forwarded');

                expect(tappable.name).to.equal('forwarded');
                expect(tappable.calls[0]).to.equal('setName:forwarded');
            });

            it('types the no-callback form as the tap proxy view of the instance', () => {
                const tappable = new TappableClass();

                const view: HigherOrderTapProxyView<TappableClass> = tappable.tap();

                expect((view as unknown as HigherOrderTapProxy<TappableClass>).target).to.equal(tappable);
            });

            // PHP's `tap(null)` reaches `is_null($callback)` the same way an
            // omitted argument does, so an explicit `undefined` is the proxy
            // form too - reached through the optional-callback overload,
            // which is also what lets the trait pass its own optional
            // callback straight through to the helper.
            it('treats an explicit undefined callback like an omitted one, handing back the proxy', () => {
                const tappable = new TappableClass();
                const callback: ((instance: TappableClass) => unknown) | undefined = undefined;

                const result: HigherOrderTapProxyView<TappableClass> | TappableClass = tappable.tap(callback);

                expect(result).never.to.equal(tappable);
                expect((result as unknown as HigherOrderTapProxy<TappableClass>).target).to.equal(tappable);
            });
        });
    });
};
