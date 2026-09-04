import { HigherOrderTapProxy, HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `HigherOrderTapProxyTest.php` here to port literally. These cases are
// reconstructed from HigherOrderTapProxy's own behavior, covering the one
// scenario upstream's `SupportHelpersTest::testTap` names for the proxy
// form (`tap($mock)->foo()` reaches the target's `foo()` and hands back
// `$mock`, not `foo()`'s own result), plus the argument-forwarding and
// receiver-binding edges the port's explicit dynamic-dispatch receiver
// exists to get right.

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

    public rename(first: string, last: string): string
    {
        this.calls.push(`rename:${first}:${last}`);

        return `${first} ${last}`;
    }

    public touch(): number
    {
        this.calls.push('touch');

        return this.calls.size();
    }
}

export = (): void => {
    describe('HigherOrderTapProxy', () => {
        it('exposes the target it was constructed with', () => {
            const subject = new Subject();

            const proxy = new HigherOrderTapProxy(subject);

            expect(proxy.target).to.equal(subject);
        });

        describe('__call()', () => {
            it('forwards the method call to the target with its parameters', () => {
                const subject = new Subject();

                new HigherOrderTapProxy(subject).___call('activate', ['tap']);

                expect(subject.calls[0]).to.equal('activate:tap');
            });

            it('returns the target, not the result of the forwarded call', () => {
                const subject = new Subject();

                const result = new HigherOrderTapProxy(subject).___call('activate', ['tap']);

                expect(result).to.equal(subject);
                expect(result).never.to.equal('activated:tap');
            });

            it('binds the target as the receiver of the forwarded call', () => {
                const subject = new Subject();

                new HigherOrderTapProxy(subject).___call('activate', ['bound']);

                expect(subject.isActive()).to.equal(true);
            });

            it('forwards multiple parameters in order', () => {
                const subject = new Subject();

                new HigherOrderTapProxy(subject).___call('rename', ['Taylor', 'Otwell']);

                expect(subject.calls[0]).to.equal('rename:Taylor:Otwell');
            });

            it('forwards a call with no parameters', () => {
                const subject = new Subject();

                const result = new HigherOrderTapProxy(subject).___call('touch', []);

                expect(subject.calls[0]).to.equal('touch');
                expect(result).to.equal(subject);
            });
        });

        describe('magic dispatch view', () => {
            it('routes a method call on the view through __call and hands back the target', () => {
                const subject = new Subject();
                const view = new HigherOrderTapProxy(subject) as unknown as HigherOrderTapProxyView<Subject>;

                const result = view.activate('view');

                expect(result).to.equal(subject);
                expect(subject.calls[0]).to.equal('activate:view');
            });

            it('what comes back is the real target, so the next call in the chain is a plain one', () => {
                const subject = new Subject();
                const view = new HigherOrderTapProxy(subject) as unknown as HigherOrderTapProxyView<Subject>;

                const result = view.activate('chain').isActive();

                expect(result).to.equal(true);
            });

            it('forwards the view call parameters in order', () => {
                const subject = new Subject();
                const view = new HigherOrderTapProxy(subject) as unknown as HigherOrderTapProxyView<Subject>;

                view.rename('Taylor', 'Otwell');

                expect(subject.calls[0]).to.equal('rename:Taylor:Otwell');
            });
        });
    });
};
