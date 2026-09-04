import { HigherOrderWhenProxy, PendingHigherOrderWhenProxy, ResolvedHigherOrderWhenProxy } from 'Illuminate/Support/HigherOrderWhenProxy';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `HigherOrderWhenProxyTest.php` here to port literally, and upstream
// itself exercises this proxy through Conditionable's `when()`/`unless()`
// rather than in a test of its own. These cases are reconstructed from
// HigherOrderWhenProxy's own behavior and drive the proxy directly
// (Conditionable.spec.ts covers the `when()`/`unless()` route): the
// scenarios upstream reaches through the trait - a conditioned hop that
// forwards or hands back the target, a capture hop that takes its
// condition from a property read or a method call, and the negated capture
// `unless()` sets up - plus the branches only a direct caller can pin down:
// `condition()`/`negateConditionOnCapture()` as fluent setters, `__get`/
// `__call` before versus after a condition, the PHP-truthiness edges
// `truthy()` replicates, and the typed two-hop flow through the exported
// magic-dispatch view types.

class Subject
{
    public active = true;

    public count = 0;

    public calls: Array<string> = [];

    public isActive(): boolean
    {
        this.calls.push('isActive');

        return this.active;
    }

    public activate(reason: string): string
    {
        this.calls.push(`activate:${reason}`);

        return `activated:${reason}`;
    }

    public rename(first: string, last: string): string
    {
        this.calls.push(`rename:${first}:${last}`);

        return `${first} ${last}`;
    }
}

export = (): void => {
    describe('HigherOrderWhenProxy', () => {
        describe('condition()', () => {
            it('returns the same proxy, so the condition can be set fluently', () => {
                const subject = new Subject();
                const proxy = new HigherOrderWhenProxy(subject);

                expect(proxy.condition(true)).to.equal(proxy);
            });

            it('stores the condition, so the next member access resolves against it instead of capturing', () => {
                const subject = new Subject();

                const truthy = new HigherOrderWhenProxy(subject).condition(true).__get('active');
                const falsy = new HigherOrderWhenProxy(subject).condition(false).__get('active');

                expect(truthy).to.equal(true);
                expect(falsy).to.equal(subject);
            });
        });

        describe('negateConditionOnCapture()', () => {
            it('returns the same proxy, so it can be chained ahead of the capture', () => {
                const proxy = new HigherOrderWhenProxy(new Subject());

                expect(proxy.negateConditionOnCapture()).to.equal(proxy);
            });
        });

        describe('__get()', () => {
            describe('before a condition is set', () => {
                it('captures the condition from the property read and returns the proxy, not the property', () => {
                    const subject = new Subject();
                    const proxy = new HigherOrderWhenProxy(subject);

                    const result = proxy.__get('active');

                    expect(result).to.equal(proxy);
                    expect(result).never.to.equal(true);
                });

                it('a truthy property makes the next access read through to the target', () => {
                    const subject = new Subject();
                    const proxy = new HigherOrderWhenProxy(subject);

                    proxy.__get('active');

                    expect(proxy.__get('active')).to.equal(true);
                });

                it('a falsy property makes the next access hand back the target', () => {
                    const subject = new Subject();
                    subject.active = false;
                    const proxy = new HigherOrderWhenProxy(subject);

                    proxy.__get('active');

                    expect(proxy.__get('active')).to.equal(subject);
                });

                it('negates a truthy captured property when asked to', () => {
                    const subject = new Subject();
                    const proxy = new HigherOrderWhenProxy(subject).negateConditionOnCapture();

                    proxy.__get('active');

                    expect(proxy.__get('active')).to.equal(subject);
                });

                it('negates a falsy captured property when asked to, so the next access reads through', () => {
                    const subject = new Subject();
                    subject.active = false;
                    const proxy = new HigherOrderWhenProxy(subject).negateConditionOnCapture();

                    proxy.__get('active');

                    expect(proxy.__get('active')).to.equal(false);
                });

                it('captures 0 as falsy and negates it to truthy, as PHP does, even though Luau itself treats 0 as truthy', () => {
                    const subject = new Subject();
                    const plain = new HigherOrderWhenProxy(subject);
                    const negated = new HigherOrderWhenProxy(subject).negateConditionOnCapture();

                    plain.__get('count');
                    negated.__get('count');

                    expect(plain.__get('active')).to.equal(subject);
                    expect(negated.__get('active')).to.equal(true);
                });
            });

            describe('once a condition is set', () => {
                it('reads the property through to the target when the condition is truthy', () => {
                    const subject = new Subject();

                    const result = new HigherOrderWhenProxy(subject).condition(true).__get('active');

                    expect(result).to.equal(true);
                });

                it('hands back the target itself when the condition is falsy', () => {
                    const subject = new Subject();

                    const result = new HigherOrderWhenProxy(subject).condition(false).__get('active');

                    expect(result).to.equal(subject);
                });
            });
        });

        describe('__call()', () => {
            describe('before a condition is set', () => {
                it('invokes the method on the target with its parameters and returns the proxy, not the result', () => {
                    const subject = new Subject();
                    const proxy = new HigherOrderWhenProxy(subject);

                    const result = proxy.___call('activate', ['capture']);

                    expect(subject.calls[0]).to.equal('activate:capture');
                    expect(result).to.equal(proxy);
                    expect(result).never.to.equal('activated:capture');
                });

                it('a truthy method result makes the next call forward', () => {
                    const subject = new Subject();
                    const proxy = new HigherOrderWhenProxy(subject);

                    proxy.___call('isActive', []);

                    expect(proxy.___call('activate', ['forwarded'])).to.equal('activated:forwarded');
                });

                it('a falsy method result makes the next call hand back the target without invoking it', () => {
                    const subject = new Subject();
                    subject.active = false;
                    const proxy = new HigherOrderWhenProxy(subject);

                    proxy.___call('isActive', []);

                    expect(proxy.___call('activate', ['skipped'])).to.equal(subject);
                    expect(subject.calls.size()).to.equal(1);
                });

                it('negates a truthy captured method result when asked to', () => {
                    const subject = new Subject();
                    const proxy = new HigherOrderWhenProxy(subject).negateConditionOnCapture();

                    proxy.___call('isActive', []);

                    expect(proxy.___call('activate', ['negated'])).to.equal(subject);
                });

                it('negates a falsy captured method result when asked to, so the next call forwards', () => {
                    const subject = new Subject();
                    subject.active = false;
                    const proxy = new HigherOrderWhenProxy(subject).negateConditionOnCapture();

                    proxy.___call('isActive', []);

                    expect(proxy.___call('activate', ['negated'])).to.equal('activated:negated');
                });
            });

            describe('once a condition is set', () => {
                it('forwards the call with its parameters and returns the result of the method itself when the condition is truthy', () => {
                    const subject = new Subject();

                    const result = new HigherOrderWhenProxy(subject).condition(true).___call('activate', ['forwarded']);

                    expect(result).to.equal('activated:forwarded');
                    expect(subject.calls[0]).to.equal('activate:forwarded');
                });

                it('forwards multiple parameters in order', () => {
                    const subject = new Subject();

                    const result = new HigherOrderWhenProxy(subject).condition(true).___call('rename', ['Taylor', 'Otwell']);

                    expect(result).to.equal('Taylor Otwell');
                    expect(subject.calls[0]).to.equal('rename:Taylor:Otwell');
                });

                it('binds the target as the receiver of the forwarded call', () => {
                    const subject = new Subject();
                    subject.active = false;

                    const result = new HigherOrderWhenProxy(subject).condition(true).___call('isActive', []);

                    expect(result).to.equal(false);
                    expect(subject.calls[0]).to.equal('isActive');
                });

                it('hands back the target without invoking the method when the condition is falsy', () => {
                    const subject = new Subject();

                    const result = new HigherOrderWhenProxy(subject).condition(false).___call('activate', ['skipped']);

                    expect(result).to.equal(subject);
                    expect(subject.calls.size()).to.equal(0);
                });
            });
        });

        describe('PHP truthiness of the condition', () => {
            it('treats 0, an empty string, "0", false and undefined as falsy, as PHP does', () => {
                const subject = new Subject();

                expect(new HigherOrderWhenProxy(subject).condition(0).__get('active')).to.equal(subject);
                expect(new HigherOrderWhenProxy(subject).condition('').__get('active')).to.equal(subject);
                expect(new HigherOrderWhenProxy(subject).condition('0').__get('active')).to.equal(subject);
                expect(new HigherOrderWhenProxy(subject).condition(false).__get('active')).to.equal(subject);
                expect(new HigherOrderWhenProxy(subject).condition(undefined).__get('active')).to.equal(subject);
            });

            it('treats a non-zero number, a non-empty string and true as truthy', () => {
                const subject = new Subject();

                expect(new HigherOrderWhenProxy(subject).condition(1).__get('active')).to.equal(true);
                expect(new HigherOrderWhenProxy(subject).condition(-1).__get('active')).to.equal(true);
                expect(new HigherOrderWhenProxy(subject).condition('yes').__get('active')).to.equal(true);
                expect(new HigherOrderWhenProxy(subject).condition('false').__get('active')).to.equal(true);
                expect(new HigherOrderWhenProxy(subject).condition(true).__get('active')).to.equal(true);
            });

            // A documented divergence, see `truthy()` in Illuminate/Support/
            // helpers: PHP's `if ([])` is false, but only the scalar cases of
            // PHP truthiness are replicated, so an empty table counts as
            // truthy here.
            it('treats an empty table as truthy, unlike PHP', () => {
                const subject = new Subject();

                expect(new HigherOrderWhenProxy(subject).condition([]).__get('active')).to.equal(true);
            });
        });

        describe('magic dispatch views', () => {
            it('captures the condition from a property read on the pending view, then resolves the call after it', () => {
                const subject = new Subject();
                const pending = new HigherOrderWhenProxy(subject) as unknown as PendingHigherOrderWhenProxy<Subject>;

                const result = pending.active.activate('two-hop');

                expect(result).to.equal('activated:two-hop');
            });

            it('captures the condition from a method call on the pending view, invoking it for real', () => {
                const subject = new Subject();
                const pending = new HigherOrderWhenProxy(subject) as unknown as PendingHigherOrderWhenProxy<Subject>;

                const resolved: ResolvedHigherOrderWhenProxy<Subject> = pending.isActive();
                const result = resolved.activate('two-hop');

                expect(subject.calls[0]).to.equal('isActive');
                expect(result).to.equal('activated:two-hop');
            });

            // One proxy serves one capture and one resolve; a chain past the
            // second hop is a plain access on whatever that hop returned.
            it('resolves a property read on the second hop, whichever way the first hop captured', () => {
                const subject = new Subject();
                const viaProperty = new HigherOrderWhenProxy(subject) as unknown as PendingHigherOrderWhenProxy<Subject>;
                const viaMethod = new HigherOrderWhenProxy(subject) as unknown as PendingHigherOrderWhenProxy<Subject>;

                const afterProperty: boolean | Subject = viaProperty.active.active;
                const afterMethod: boolean | Subject = viaMethod.isActive().active;

                expect(afterProperty).to.equal(true);
                expect(afterMethod).to.equal(true);
            });

            it('a falsy capture on the pending view makes the resolving hop hand back the target untouched', () => {
                const subject = new Subject();
                subject.active = false;
                const pending = new HigherOrderWhenProxy(subject) as unknown as PendingHigherOrderWhenProxy<Subject>;

                const result = pending.isActive().activate('skipped');

                expect(result).to.equal(subject);
                expect(subject.calls.size()).to.equal(1);
            });

            it('a pending view set to negate inverts what its first hop captured', () => {
                const subject = new Subject();
                const pending = new HigherOrderWhenProxy(subject).negateConditionOnCapture() as unknown as PendingHigherOrderWhenProxy<Subject>;

                const result = pending.active.activate('negated');

                expect(result).to.equal(subject);
            });

            it('the resolved view reads a property through to the target when the condition is truthy', () => {
                const subject = new Subject();
                const resolved = new HigherOrderWhenProxy(subject).condition(true) as unknown as ResolvedHigherOrderWhenProxy<Subject>;

                const result: boolean | Subject = resolved.active;

                expect(result).to.equal(true);
            });

            it('the resolved view forwards a call with its parameters when the condition is truthy', () => {
                const subject = new Subject();
                const resolved = new HigherOrderWhenProxy(subject).condition(true) as unknown as ResolvedHigherOrderWhenProxy<Subject>;

                const result: string | Subject = resolved.rename('Taylor', 'Otwell');

                expect(result).to.equal('Taylor Otwell');
                expect(subject.calls[0]).to.equal('rename:Taylor:Otwell');
            });

            it('the resolved view hands back the target without calling anything when the condition is falsy', () => {
                const subject = new Subject();
                const resolved = new HigherOrderWhenProxy(subject).condition(false) as unknown as ResolvedHigherOrderWhenProxy<Subject>;

                const result = resolved.activate('skipped');

                expect(result).to.equal(subject);
                expect(subject.calls.size()).to.equal(0);
            });
        });
    });
};
