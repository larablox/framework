/// <reference types="@rbxts/testez/globals" />
import { ArrayStore } from "Illuminate/Cache/ArrayStore";
import { CacheHit } from "Illuminate/Cache/Events/CacheHit";
import { CacheMissed } from "Illuminate/Cache/Events/CacheMissed";
import { ForgettingKey } from "Illuminate/Cache/Events/ForgettingKey";
import { KeyForgetFailed } from "Illuminate/Cache/Events/KeyForgetFailed";
import { KeyForgotten } from "Illuminate/Cache/Events/KeyForgotten";
import { KeyWriteFailed } from "Illuminate/Cache/Events/KeyWriteFailed";
import { KeyWritten } from "Illuminate/Cache/Events/KeyWritten";
import { Repository } from "Illuminate/Cache/Repository";
import { RetrievingKey } from "Illuminate/Cache/Events/RetrievingKey";
import { WritingKey } from "Illuminate/Cache/Events/WritingKey";
import type { Dispatcher } from "Illuminate/Contracts/Events/Dispatcher";
import type { Store } from "Illuminate/Contracts/Cache/Store";

/**
 * PHP: `Illuminate\Tests\Cache\CacheEventsTest`.
 *
 * No mocking framework here (see `Repository.spec.ts`'s class comment on
 * `FakeStore`) -- `FakeDispatcher` below records every dispatched event
 * instead of a `Dispatcher` mock wired with per-call `shouldReceive()`
 * expectations, and each `it()` asserts the recording afterward.
 *
 * `Repository.ts`'s class comment says tags are not ported (no store here
 * supports them). Every `tags('taylor')->...` half of each PHP test case
 * below is dropped for that reason -- the untagged half of the same test
 * already covers the event-dispatch mechanics being checked.
 *
 * This port's `Repository` (see its own class comment and `get`/`put`/
 * `forget`/`clear` bodies) fires six of the nine ported events --
 * `RetrievingKey`, `CacheHit`, `CacheMissed`, `WritingKey`, `KeyWritten`/
 * `KeyWriteFailed`, `ForgettingKey`, `KeyForgotten`/`KeyForgetFailed` -- and
 * nothing for `clear()`/`flushLocks()`: there is no `CacheFlushing`/
 * `CacheFlushed`/`CacheFlushFailed`/`CacheLocksFlushing`/
 * `CacheLocksFlushed`/`CacheLocksFlushFailed` class in
 * `Illuminate/Cache/Events`, and no `RetrievingManyKeys`/`WritingManyKeys`
 * either -- `many()`/`putMany()` just loop `get()`/`put()`, each firing its
 * own single-key event. `testFlushTriggersEvents`,
 * `testFlushLocksTriggersEvents`, `testFlushFailureDoesDispatchEvent`,
 * `testFlushLocksFailureDoesDispatchEvent` are not ported for this reason --
 * there is nothing here for them to assert on.
 */

/** Records every event handed to `dispatch()`, in order. */
class FakeDispatcher implements Dispatcher {
    public dispatched = new Array<object>();

    public dispatch(event: unknown): unknown {
        this.dispatched.push(event as object);

        return undefined;
    }

    public listen(): void {}
    public hasListeners(): boolean {
        return false;
    }
    public subscribe(): void {}
    public until(): unknown {
        return undefined;
    }
    public push(): void {}
    public flush(): void {}
    public forget(): void {}
    public forgetPushed(): void {}
}

/** A `Store` whose `forget()`/`flushLocks()` always fail, to drive the *Failed events. */
class FailingForgetStore extends ArrayStore implements Store {
    public forget(): boolean {
        return false;
    }
}

function getRepository(dispatcher: FakeDispatcher): Repository {
    const repository = new Repository(new ArrayStore(), { store: "array" });
    repository.put("baz", "qux", 99);
    repository.setEventDispatcher(dispatcher as unknown as Dispatcher);

    return repository;
}

export = (): void => {
    describe("Cache events", () => {
        // PHP: CacheEventsTest::testHasTriggersEvents (untagged half only, see class comment)
        it("has() fires RetrievingKey then CacheMissed/CacheHit", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.has("foo")).to.equal(false);
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect((dispatcher.dispatched[0] as RetrievingKey).key).to.equal(
                "foo",
            );
            expect(dispatcher.dispatched[1] instanceof CacheMissed).to.equal(
                true,
            );

            dispatcher.dispatched.clear();
            expect(repository.has("baz")).to.equal(true);
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof CacheHit).to.equal(true);
            expect((dispatcher.dispatched[1] as CacheHit).value).to.equal(
                "qux",
            );
        });

        // PHP: CacheEventsTest::testGetTriggersEvents (untagged, non-array-keys half; see class comment)
        it("get() fires RetrievingKey then CacheMissed/CacheHit", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.get("foo")).to.equal(undefined);
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof CacheMissed).to.equal(
                true,
            );

            dispatcher.dispatched.clear();
            expect(repository.get("baz")).to.equal("qux");
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof CacheHit).to.equal(true);
        });

        // PHP: CacheEventsTest::testPullTriggersEvents
        it("pull() fires RetrievingKey, CacheHit, ForgettingKey, KeyForgotten", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.pull("baz")).to.equal("qux");
            expect(dispatcher.dispatched.size()).to.equal(4);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof CacheHit).to.equal(true);
            expect(dispatcher.dispatched[2] instanceof ForgettingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[3] instanceof KeyForgotten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testPutTriggersEvents (untagged, non-putMany half; see class comment.
        // putMany's dispatch shape -- one WritingKey/KeyWritten pair per key,
        // no batched WritingManyKeys -- is already implied by this case, since
        // `Repository.putMany()` just loops `put()`.)
        it("put() fires WritingKey then KeyWritten, with the resolved seconds", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            repository.put("foo", "bar", 99);

            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof WritingKey).to.equal(
                true,
            );
            expect((dispatcher.dispatched[0] as WritingKey).value).to.equal(
                "bar",
            );
            expect((dispatcher.dispatched[0] as WritingKey).seconds).to.equal(
                99,
            );
            expect(dispatcher.dispatched[1] instanceof KeyWritten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testAddTriggersEvents (untagged half; see class comment)
        it("add() fires RetrievingKey/CacheMissed (the probing get()) then WritingKey/KeyWritten", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.add("foo", "bar", 99)).to.equal(true);
            expect(dispatcher.dispatched.size()).to.equal(4);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof CacheMissed).to.equal(
                true,
            );
            expect(dispatcher.dispatched[2] instanceof WritingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[3] instanceof KeyWritten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testForeverTriggersEvents (untagged half; see class comment)
        it("forever() fires WritingKey/KeyWritten with seconds undefined", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            repository.forever("foo", "bar");

            expect(dispatcher.dispatched.size()).to.equal(2);
            expect((dispatcher.dispatched[0] as WritingKey).seconds).to.equal(
                undefined,
            );
            expect(dispatcher.dispatched[1] instanceof KeyWritten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testRememberTriggersEvents (untagged half; see class comment)
        it("remember() on a miss fires RetrievingKey/CacheMissed then WritingKey/KeyWritten", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.remember("foo", 99, () => "bar")).to.equal("bar");
            expect(dispatcher.dispatched.size()).to.equal(4);
            expect(dispatcher.dispatched[0] instanceof RetrievingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof CacheMissed).to.equal(
                true,
            );
            expect(dispatcher.dispatched[2] instanceof WritingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[3] instanceof KeyWritten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testRememberForeverTriggersEvents (untagged half; see class comment)
        it("rememberForever() on a miss fires RetrievingKey/CacheMissed then WritingKey/KeyWritten", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.rememberForever("foo", () => "bar")).to.equal(
                "bar",
            );
            expect(dispatcher.dispatched.size()).to.equal(4);
            expect(dispatcher.dispatched[2] instanceof WritingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[3] instanceof KeyWritten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testForgetTriggersEvents (untagged half; see class comment)
        it("forget() fires ForgettingKey then KeyForgotten", () => {
            const dispatcher = new FakeDispatcher();
            const repository = getRepository(dispatcher);

            expect(repository.forget("baz")).to.equal(true);
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof ForgettingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof KeyForgotten).to.equal(
                true,
            );
        });

        // PHP: CacheEventsTest::testForgetDoesTriggerFailedEventOnFailure
        it("forget() fires ForgettingKey then KeyForgetFailed when the store refuses", () => {
            const dispatcher = new FakeDispatcher();
            const repository = new Repository(new FailingForgetStore());
            repository.setEventDispatcher(dispatcher as unknown as Dispatcher);

            expect(repository.forget("baz")).to.equal(false);
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof ForgettingKey).to.equal(
                true,
            );
            expect(
                dispatcher.dispatched[1] instanceof KeyForgetFailed,
            ).to.equal(true);
        });

        // PHP: no direct upstream equivalent -- `put()` fires KeyWriteFailed
        // the same way `forget()` fires KeyForgetFailed above; there is no
        // PHP test for the write-failure half specifically (`ArrayStore.put()`
        // never fails), so this exercises it with a store whose `put()`
        // always fails, the same substitute pattern as `FailingForgetStore`.
        it("put() fires WritingKey then KeyWriteFailed when the store refuses", () => {
            class FailingPutStore extends ArrayStore implements Store {
                public put(): boolean {
                    return false;
                }
            }

            const dispatcher = new FakeDispatcher();
            const repository = new Repository(new FailingPutStore());
            repository.setEventDispatcher(dispatcher as unknown as Dispatcher);

            expect(repository.put("foo", "bar", 99)).to.equal(false);
            expect(dispatcher.dispatched.size()).to.equal(2);
            expect(dispatcher.dispatched[0] instanceof WritingKey).to.equal(
                true,
            );
            expect(dispatcher.dispatched[1] instanceof KeyWriteFailed).to.equal(
                true,
            );
        });
    });
};
