/// <reference types="@rbxts/testez/globals" />
import { Container } from 'Illuminate/Container/Container';

/**
 * PHP: `Illuminate\Tests\Container\ContainerTaggingTest`.
 *
 * `testTaggedServicesAreLazyLoaded` is adapted, not skipped: upstream verifies
 * laziness with a partial mock of `Container` (`createPartialMock(...,
 * ['make'])`) that expects `make()` exactly once. This codebase has no mocking
 * framework (`CLAUDE.md`), so the adaptation below proves the same thing a
 * different way -- a `resolving()` callback on each tagged class counts how
 * many were actually built while only the first entry of the lazy sequence is
 * consumed, which is exactly what "lazy loaded" means here.
 */
export = (): void => {
    describe('Container tagging', () => {
        // PHP's `IContainerTaggedContractStub` interface is not reproduced: it
        // has no runtime trace in Luau and neither of these two tests actually
        // checks against it, only against the concrete classes.
        class ContainerImplementationTaggedStub
        {}

        class ContainerImplementationTaggedStubTwo
        {}

        it('tag()/tagged() group bindings and resolve every tagged entry', () => {
            // PHP: ContainerTaggingTest::testContainerTags
            const container = new Container();
            container.tag(ContainerImplementationTaggedStub, [
                'foo',
                'bar',
            ]);
            container.tag(ContainerImplementationTaggedStubTwo, ['foo']);

            expect(container.tagged('bar').count()).to.equal(1);
            expect(container.tagged('foo').count()).to.equal(2);

            const fooResults = container.tagged('foo').toArray();
            const barResults = container.tagged('bar').toArray();

            expect(fooResults[0] instanceof ContainerImplementationTaggedStub).to.equal(true);
            expect(barResults[0] instanceof ContainerImplementationTaggedStub).to.equal(true);
            expect(fooResults[1] instanceof ContainerImplementationTaggedStubTwo).to.equal(true);

            const container2 = new Container();
            container2.tag([
                ContainerImplementationTaggedStub,
                ContainerImplementationTaggedStubTwo,
            ], ['foo']);
            expect(container2.tagged('foo').count()).to.equal(2);

            const fooResults2 = container2.tagged('foo').toArray();
            expect(fooResults2[0] instanceof ContainerImplementationTaggedStub).to.equal(true);
            expect(fooResults2[1] instanceof ContainerImplementationTaggedStubTwo).to.equal(true);

            expect(container2.tagged('this_tag_does_not_exist').count()).to.equal(0);
        });

        it('tagged() only builds an entry once iteration actually reaches it', () => {
            // PHP: ContainerTaggingTest::testTaggedServicesAreLazyLoaded (adapted -- see class comment)
            const container = new Container();

            let builtCount = 0;
            container.resolving(ContainerImplementationTaggedStub, () => {
                builtCount++;
            });
            container.resolving(ContainerImplementationTaggedStubTwo, () => {
                builtCount++;
            });

            container.tag(ContainerImplementationTaggedStub, ['foo']);
            container.tag(ContainerImplementationTaggedStubTwo, ['foo']);

            const tagged = container.tagged('foo');

            const fooResults = new Array<unknown>();
            for (const foo of tagged.getIterator()) {
                fooResults[fooResults.size()] = foo;
                break;
            }

            expect(tagged.count()).to.equal(2);
            expect(fooResults[0] instanceof ContainerImplementationTaggedStub).to.equal(true);
            expect(builtCount).to.equal(1);
        });

        it('a lazily loaded tagged sequence can be iterated multiple times', () => {
            // PHP: ContainerTaggingTest::testLazyLoadedTaggedServicesCanBeLoopedOverMultipleTimes
            const container = new Container();
            container.tag(ContainerImplementationTaggedStub, 'foo');
            container.tag(ContainerImplementationTaggedStubTwo, ['foo']);

            const services = container.tagged('foo');

            const firstPass = new Array<unknown>();
            for (const foo of services.getIterator()) {
                firstPass[firstPass.size()] = foo;
            }

            expect(firstPass[0] instanceof ContainerImplementationTaggedStub).to.equal(true);
            expect(firstPass[1] instanceof ContainerImplementationTaggedStubTwo).to.equal(true);

            const secondPass = new Array<unknown>();
            for (const foo of services.getIterator()) {
                secondPass[secondPass.size()] = foo;
            }

            expect(secondPass[0] instanceof ContainerImplementationTaggedStub).to.equal(true);
            expect(secondPass[1] instanceof ContainerImplementationTaggedStubTwo).to.equal(true);
        });
    });
};
