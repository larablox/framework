import { Conditionable } from 'Illuminate/Support/Traits/Conditionable';

// Adapted, not ported: `.upstream/` is a `composer install` of the
// laravel/framework *package* only, with no PHPUnit test files - there is
// no `ConditionableTest.php` here to port literally. These cases are
// reconstructed from Conditionable's own behavior (and from the manual
// scratch runs this port was verified against while it was being built),
// covering the same scenarios upstream's real test suite is known to name:
// the 3-arg callback form, the 1-arg and 0-arg proxy forms, and unless()'s
// negation of all three.

class Subject extends Conditionable(class
{
    public active = true;

    public isActive(): boolean
    {
        return this.active;
    }

    public activate(reason: string): string
    {
        return `activated:${reason}`;
    }

    public deactivate(reason: string): string
    {
        return `deactivated:${reason}`;
    }
})
{}

export = (): void => {
    describe('Conditionable', () => {
        describe('when()', () => {
            it('calls the callback when the value is truthy', () => {
                const subject = new Subject();

                const result = subject.when(true, (target, value) => target.activate(`v=${value}`));

                expect(result).to.equal('activated:v=true');
            });

            it('calls the default callback when the value is falsy', () => {
                const subject = new Subject();

                const result = subject.when(
                    false,
                    (target) => target.activate('x'),
                    (target) => target.deactivate('y'),
                );

                expect(result).to.equal('deactivated:y');
            });

            it('returns the subject when the value is falsy and there is no default', () => {
                const subject = new Subject();

                const result = subject.when(false, (target) => target.activate('x'));

                expect(result).to.equal(subject);
            });

            it('resolves a closure value against the subject before checking it', () => {
                const subject = new Subject();
                subject.active = false;

                const result = subject.when(
                    (target) => target.isActive(),
                    (target) => target.activate('closure'),
                );

                expect(result).to.equal(subject);
            });

            it('the 1-arg proxy forwards a call when the condition is truthy', () => {
                const subject = new Subject();

                const result = subject.when(true).activate('one-arg');

                expect(result).to.equal('activated:one-arg');
            });

            it('the 1-arg proxy returns the subject when the condition is falsy', () => {
                const subject = new Subject();

                const result = subject.when(false).activate('one-arg');

                expect(result).to.equal(subject);
            });

            it('the 0-arg proxy captures its condition from the first hop, method-style', () => {
                const subject = new Subject();

                const result = subject.when().isActive().activate('zero-arg');

                expect(result).to.equal('activated:zero-arg');
            });

            it('the 0-arg proxy captures its condition from the first hop, property-style', () => {
                const subject = new Subject();

                const result = subject.when().active.activate('zero-arg-property');

                expect(result).to.equal('activated:zero-arg-property');
            });

            it('the 0-arg proxy returns the subject when the captured condition is falsy', () => {
                const subject = new Subject();
                subject.active = false;

                const result = subject.when().isActive().activate('zero-arg');

                expect(result).to.equal(subject);
            });

            // An explicit `undefined` is 1 real argument, matching upstream
            // PHP's func_num_args() seeing when(null) as 1 - distinct from
            // when() (0 arguments). See TableArgs.luau for how this port
            // recovers that count despite it, which is exactly what a
            // args.size()-based implementation could not do.
            it('an explicit undefined 1-arg value resolves immediately to a falsy condition, unlike the 0-arg form', () => {
                const subject = new Subject();

                const result = subject.when(undefined).activate('explicit-undefined');

                expect(result).to.equal(subject);
            });
        });

        describe('unless()', () => {
            it('calls the callback when the value is falsy', () => {
                const subject = new Subject();

                const result = subject.unless(false, (target, value) => target.activate(`v=${value}`));

                expect(result).to.equal('activated:v=false');
            });

            it('returns the subject when the value is truthy and there is no default', () => {
                const subject = new Subject();

                const result = subject.unless(true, (target) => target.activate('x'));

                expect(result).to.equal(subject);
            });

            it('the 1-arg proxy negates the given condition', () => {
                const subject = new Subject();

                const truthy = subject.unless(true).activate('one-arg');
                const falsy = subject.unless(false).activate('one-arg');

                expect(truthy).to.equal(subject);
                expect(falsy).to.equal('activated:one-arg');
            });

            it('the 0-arg proxy negates the condition captured from the first hop', () => {
                const subject = new Subject();

                const result = subject.unless().isActive().activate('zero-arg');

                expect(result).to.equal(subject);
            });

            it('an explicit undefined 1-arg value negates immediately, unlike the 0-arg form', () => {
                const subject = new Subject();

                const result = subject.unless(undefined).activate('explicit-undefined');

                expect(result).to.equal('activated:explicit-undefined');
            });
        });
    });
};
