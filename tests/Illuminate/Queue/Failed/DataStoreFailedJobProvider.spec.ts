/// <reference types="@rbxts/testez/globals" />
import { DataStoreFailedJobProvider } from 'Illuminate/Queue/Failed/DataStoreFailedJobProvider';
import { RuntimeException } from 'Illuminate/Exception';
import { Str } from 'Illuminate/Support/Str';
import type { JobPayload } from 'Illuminate/Contracts/Queue/Job';

/**
 * PHP: `Illuminate\Tests\Queue\DatabaseFailedJobProviderTest` and
 * `DatabaseUuidFailedJobProviderTest`.
 *
 * Both upstream files exercise the same `FailedJobProviderInterface` surface
 * against a real SQLite table -- the only real difference between them is an
 * autoincrement `id` versus a `uuid` primary key. `DataStoreFailedJobProvider`
 * always keys by `Str::orderedUuid()` (see its source), matching the *uuid*
 * file's shape, so this is one merged file exercising the real
 * `DataStoreService` (reachable only from a running Studio session with API
 * access enabled) rather than mocking a query builder. Each test uses its own
 * `storeName`/`prefix`, generated from `HttpService.GenerateGUID`, so tests
 * never see each other's failures.
 *
 * **Ordering diverges from both upstream files.** PHP's autoincrement file
 * orders `ids()`/`all()` by `id` descending (`testCanGetAllFailedJobIds`
 * asserts `[4, 3, 2, 1]`); the uuid file orders ascending by insertion, which
 * happens to match `id` order there too. `DataStoreFailedJobProvider.all()`
 * sorts by `failed_at` ascending instead (see its class comment: ids are only
 * ordered within one server, so there is no `id desc` to sort by), so every
 * ordering assertion below checks insertion order via `failed_at`, not the
 * literal `[4, 3, 2, 1]`/uuid-list upstream asserts.
 *
 * Not ported: `testCanProperlyLogFailedJob`'s mixed-encoding exception string
 * (`mb_convert_encoding` round-tripping ISO-8859-1) -- `exception` is stored
 * here via `tostring(exception)` on a Luau value, with no encoding conversion
 * step to exercise. Schema-building helpers (`createDatabaseWithFailedJobTable`,
 * `createSimpleDatabaseWithFailedJobTable`) have no equivalent: there is no
 * schema to build against `DataStoreService`.
 */

const HttpService = game.GetService('HttpService');

function freshProvider(): DataStoreFailedJobProvider
{
    return new DataStoreFailedJobProvider(HttpService.GenerateGUID(false), '');
}

/**
 * A minimal stand-in for a `JobPayload`.
 *
 * PHP's fixtures hand `log()` a JSON string (`json_encode(['uuid' => ...])`);
 * there is no JSON step here -- `log()` takes the live payload table and
 * serializes it itself (see `DataStoreFailedJobProvider.serializePayload()`).
 */
function payloadFor(uuid: string): JobPayload
{
    return { uuid } as unknown as JobPayload;
}

export = (): void => {
    describe('DataStoreFailedJobProvider', () => {
        // PHP: DatabaseFailedJobProviderTest::testCanGetAllFailedJobIds /
        // DatabaseUuidFailedJobProviderTest::testGettingIdsOfAllFailedJobs
        it('ids() lists every logged failure, newest last', () => {
            const provider = freshProvider();

            expect(provider.ids().size()).to.equal(0);

            const first = provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException('one'));
            const second = provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException('two'));

            const ids = provider.ids();

            expect(ids.size()).to.equal(2);
            expect(ids[0]).to.equal(first);
            expect(ids[1]).to.equal(second);
        });

        // PHP: DatabaseUuidFailedJobProviderTest::testGettingIdsOfAllFailedJobs
        // (the queue-filtered branch)
        it('ids(queue) narrows the listing to one queue', () => {
            const provider = freshProvider();

            provider.log('connection-1', 'queue-1', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('connection-2', 'queue-2', payloadFor(Str.uuid()), new RuntimeException());

            expect(provider.ids('queue-1').size()).to.equal(1);
            expect(provider.ids('queue-2').size()).to.equal(1);
        });

        // PHP: DatabaseFailedJobProviderTest::testCanGetAllFailedJobs /
        // DatabaseUuidFailedJobProviderTest::testGettingAllFailedJobs
        it('all() returns every failure with its connection and queue', () => {
            const provider = freshProvider();

            expect(provider.all().size()).to.equal(0);

            provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('database', 'emails', payloadFor(Str.uuid()), new RuntimeException());

            const all = provider.all();

            // `all()` is newest-first (PHP: `orderBy('id', 'desc')`), so the
            // second failure logged comes back first.
            expect(all.size()).to.equal(2);
            expect(all[0].queue).to.equal('emails');
            expect(all[1].queue).to.equal('default');
        });

        // PHP: DatabaseFailedJobProviderTest::testCanRetrieveFailedJobsById /
        // DatabaseUuidFailedJobProviderTest::testFindingFailedJobsById
        it('find() returns a logged failure by id, and undefined for an unknown one', () => {
            const provider = freshProvider();

            const id = provider.log('connection-1', 'queue-1', payloadFor('uuid-1'), new RuntimeException());

            const found = provider.find(id);

            expect(found).to.be.ok();
            expect(found!.id).to.equal(id);
            expect(found!.queue).to.equal('queue-1');
            expect(found!.connection).to.equal('connection-1');
            expect(provider.find('not-an-id')).to.equal(undefined);
        });

        // PHP: DatabaseFailedJobProviderTest::testCanRemoveFailedJobsById /
        // DatabaseUuidFailedJobProviderTest::testRemovingJobsById
        it('forget() removes a failure and reports whether it existed', () => {
            const provider = freshProvider();

            const id = provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException());

            expect(provider.forget('not-an-id')).to.equal(false);
            expect(provider.find(id)).to.be.ok();
            expect(provider.forget(id)).to.equal(true);
            expect(provider.find(id)).to.equal(undefined);
        });

        // PHP: DatabaseFailedJobProviderTest::testCanFlushFailedJobs /
        // DatabaseUuidFailedJobProviderTest::testRemovingAllFailedJobs
        it('flush() with no argument removes every failure', () => {
            const provider = freshProvider();

            provider.log('connection-1', 'queue-1', payloadFor('uuid-1'), new RuntimeException());
            provider.log('connection-2', 'queue-2', payloadFor('uuid-2'), new RuntimeException());

            expect(provider.all().size()).to.equal(2);

            provider.flush();

            expect(provider.all().size()).to.equal(0);
        });

        // PHP: DatabaseFailedJobProviderTest::testCanFlushFailedJobs (hours branch)
        it('flush(hours) only removes failures older than the cutoff', () => {
            const provider = freshProvider();

            provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException());

            provider.flush(24);

            expect(provider.all().size()).to.equal(1);
        });

        // PHP: DatabaseFailedJobProviderTest::testCanPruneFailedJobs /
        // DatabaseUuidFailedJobProviderTest::testPruningFailedJobs
        it('prune() removes failures logged before the given timestamp', () => {
            const provider = freshProvider();

            provider.log('connection-1', 'queue-1', payloadFor('uuid-1'), new RuntimeException());
            provider.log('connection-2', 'queue-2', payloadFor('uuid-2'), new RuntimeException());

            // `all()` is newest-first, so the *last* entry is the oldest.
            // Upstream freezes the clock; without one, the two failures can
            // straddle a second boundary, and a cutoff taken from the newer
            // one would prune the older.
            const logged = provider.all();
            const before = logged[logged.size() - 1].failed_at;

            expect(provider.prune(before)).to.equal(0);
            expect(provider.all().size()).to.equal(2);

            expect(provider.prune(before + 3600)).to.equal(2);
            expect(provider.all().size()).to.equal(0);
        });

        // PHP: DatabaseFailedJobProviderTest::testJobsCanBeCounted /
        // DatabaseUuidFailedJobProviderTest::testJobsCanBeCounted
        it('count() counts every failure', () => {
            const provider = freshProvider();

            expect(provider.count()).to.equal(0);

            provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException());
            expect(provider.count()).to.equal(1);

            provider.log('database', 'default', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('another-connection', 'another-queue', payloadFor(Str.uuid()), new RuntimeException());
            expect(provider.count()).to.equal(3);
        });

        // PHP: DatabaseFailedJobProviderTest::testJobsCanBeCountedByConnection /
        // DatabaseUuidFailedJobProviderTest::testJobsCanBeCountedByConnection
        it('count(connection) narrows the count to one connection', () => {
            const provider = freshProvider();

            provider.log('connection-1', 'default', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('connection-2', 'default', payloadFor(Str.uuid()), new RuntimeException());

            expect(provider.count('connection-1')).to.equal(1);
            expect(provider.count('connection-2')).to.equal(1);

            provider.log('connection-1', 'default', payloadFor(Str.uuid()), new RuntimeException());

            expect(provider.count('connection-1')).to.equal(2);
            expect(provider.count('connection-2')).to.equal(1);
        });

        // PHP: DatabaseFailedJobProviderTest::testJobsCanBeCountedByQueue /
        // DatabaseUuidFailedJobProviderTest::testJobsCanBeCountedByQueue
        it('count(undefined, queue) narrows the count to one queue', () => {
            const provider = freshProvider();

            provider.log('database', 'queue-1', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('database', 'queue-2', payloadFor(Str.uuid()), new RuntimeException());

            expect(provider.count(undefined, 'queue-1')).to.equal(1);
            expect(provider.count(undefined, 'queue-2')).to.equal(1);
        });

        // PHP: DatabaseFailedJobProviderTest::testJobsCanBeCountedByQueueAndConnection /
        // DatabaseUuidFailedJobProviderTest::testJobsCanBeCountedByQueueAndConnection
        it('count(connection, queue) narrows by both', () => {
            const provider = freshProvider();

            provider.log('connection-1', 'queue-99', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('connection-1', 'queue-99', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('connection-2', 'queue-99', payloadFor(Str.uuid()), new RuntimeException());
            provider.log('connection-1', 'queue-1', payloadFor(Str.uuid()), new RuntimeException());

            expect(provider.count('connection-1', 'queue-99')).to.equal(2);
            expect(provider.count('connection-2', 'queue-99')).to.equal(1);
            expect(provider.count('connection-1', 'queue-1')).to.equal(1);
        });
    });
};
