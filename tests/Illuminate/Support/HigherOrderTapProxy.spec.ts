import { HigherOrderTapProxy, HigherOrderTapProxyView } from 'Illuminate/Support/HigherOrderTapProxy';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `HigherOrderTapProxyTest.php` here to port literally. These cases are
// reconstructed from HigherOrderTapProxy's own behavior, covering the one
// scenario upstream's `SupportHelpersTest::testTap` names for the proxy
// form (`tap($mock)->foo()` reaches the target's `foo()` and hands back
// `$mock`, not `foo()`'s own result), plus the argument-forwarding and
// receiver-binding edges the port's explicit dynamic-dispatch receiver
// exists to get right, and the `public $target` field being as assignable
// from the outside as PHP's is (its declared type is the bare `T`, with the
// index-signature cast kept inside `__call` where it is used).

// `true` only when `A` and `B` are the same type, not merely mutually
// assignable - the two generic signatures are compared structurally, and
// `X extends A` and `X extends B` only agree for every `X` if `A` and `B`
// are identical.
type Same<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false;

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

        it('accepts a new target of the same type, and later calls reach it', () => {
            const first = new Subject();
            const second = new Subject();

            const proxy = new HigherOrderTapProxy(first);
            proxy.target = second;
            const result = proxy.___call('activate', ['swapped']);

            expect(proxy.target).to.equal(second);
            expect(result).to.equal(second);
            expect(second.calls[0]).to.equal('activate:swapped');
            expect(first.calls.size()).to.equal(0);
        });

        it('rejects a target of the wrong type at compile time', () => {
            // Directive-free stand-in for `@ts-expect-error` on
            // `proxy.target = 'not a subject'` - roblox-ts refuses to compile
            // a file carrying that directive at all. The field's declared type
            // is exactly the `T` the proxy was built with (not the
            // `T & Record<string, unknown>` intersection, which rejected
            // `proxy.target = new Subject()`, and nothing wider either), so a
            // string is not assignable to it. Either annotation collapses to
            // `false` and stops compiling the moment that changes.
            const targetIsExactlySubject: Same<HigherOrderTapProxy<Subject>['target'], Subject> = true;
            const stringIsRejected: string extends HigherOrderTapProxy<Subject>['target'] ? false : true = true;

            expect(targetIsExactlySubject).to.equal(true);
            expect(stringIsRejected).to.equal(true);
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
