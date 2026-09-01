// Parity runner: extracts both surfaces, compares them, writes the CSV
// report, and manages the review registries (approvals/exclusions).
//
//   npm run parity                          full run, writes reports/parity/
//   npm run parity -- --component Queue     limit the report to one component
//   npm run parity -- --propose "<key>"     record a review as pending human approval
//   npm run parity -- --propose-file "<laravel_path>"
//   npm run parity -- --approve "<key>"     promote to approved -- a person's call:
//   npm run parity -- --approve-file "..."  run by the user, or on their explicit ask
//   npm run parity -- --revoke "<key>"
//   npm run parity -- --exclude "<key>" --reason "..."
//   npm run parity -- --decision "<key>"    a divergence awaiting the user's call
//   npm run parity -- --reject "<key>"      the review found the port wrong
//   npm run parity -- --list stale|unreviewed|pending|decision|rejected [--component X]
//   npm run parity -- --show "<key>"        print both bodies side by side
//   npm run parity -- --check               exit 1 when anything went stale
//
// A key is `laravel_path#Declaration#member`, e.g. "Queue/Worker.php#Worker#daemon".

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FILE_COLUMNS, MEMBER_COLUMNS, approvalKey, compare, memberKey, summaryText, toCsv } from './compare.mjs';
import { extractTs } from './extract-ts.mjs';
import { verifyMember } from './verify.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const upstreamDir = join(root, '.upstream');
const upstreamSrc = join(upstreamDir, 'vendor', 'laravel', 'framework', 'src', 'Illuminate');
const vendorRoot = join(upstreamDir, 'vendor');
const portSrc = join(root, 'src', 'Illuminate');
const reportsDir = join(root, 'reports', 'parity');
const aliasesPath = join(scriptDir, 'aliases.json');
const exclusionsPath = join(scriptDir, 'exclusions.json');
const approvalsPath = join(scriptDir, 'approvals.json');

function fail(message)
{
    console.error(message);
    process.exit(1);
}

function parseArgs(argv)
{
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const name = arg.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                args[name] = next;
                i++;
            } else {
                args[name] = true;
            }
        } else {
            args._.push(arg);
        }
    }
    return args;
}

function readJson(path, fallback)
{
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJsonSorted(path, value)
{
    const sorted = Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(path, JSON.stringify(sorted, null, 4) + '\n');
}

function upstreamVersion()
{
    try {
        const lock = JSON.parse(readFileSync(join(upstreamDir, 'composer.lock'), 'utf8'));
        return lock.packages.find((entry) => entry.name === 'laravel/framework')?.version ?? 'unknown';
    } catch {
        return 'unknown';
    }
}

function ensureUpstream()
{
    if (existsSync(upstreamSrc)) return;
    console.error('Upstream checkout missing; running composer install in .upstream ...');
    const result = spawnSync('composer', [
        'install',
        '--no-scripts',
        '--no-plugins',
        '--ignore-platform-reqs',
        '--no-interaction',
    ], {
        cwd: upstreamDir,
        shell: true,
        stdio: 'inherit',
    });
    if (result.error || result.status !== 0) {
        fail('composer install failed. Install composer (getcomposer.org) and make sure it is in PATH.');
    }
    if (!existsSync(upstreamSrc)) {
        fail(`composer install ran but ${upstreamSrc} still does not exist.`);
    }
}

function extractPhp()
{
    const outPath = join(reportsDir, 'php.json');
    const result = spawnSync('php', [join(scriptDir, 'extract-php.php'), upstreamSrc, vendorRoot, outPath], {
        encoding: 'utf8',
    });
    if (result.error) {
        fail('php not found in PATH; the parity extractor needs the PHP CLI.');
    }
    if (result.status !== 0) {
        fail(`extract-php.php failed:\n${result.stderr || result.stdout}`);
    }
    return JSON.parse(readFileSync(outPath, 'utf8'));
}

function findPhpMember(php, key)
{
    const [path, declName, memberRef] = key.split('#');
    // `member@kind` disambiguates a PHP property/method name collision --
    // without honouring it, an --exclude of the method would pin the
    // *property's* hash (null) and the waiver could never go stale.
    const [memberName, kind] = (memberRef ?? '').split('@');
    const decl = php.files[path]?.declarations.find((d) => d.name === declName);
    const member = decl?.members.find((m) => m.name === memberName && (kind === undefined || m.kind === kind));
    return member ? { path, decl, member } : null;
}

function findTsMember(php, ts, aliases, key)
{
    const [phpPath, declName, memberRef] = key.split('#');
    const phpMemberName = (memberRef ?? '').split('@')[0];
    const direct = phpPath.replace(/\.php$/, '.ts');
    const tsPath = ts.files[direct] ? direct : (aliases.files ?? {})[phpPath];
    const tsData = tsPath ? ts.files[tsPath] : null;
    if (!tsData) return null;
    const classLike = tsData.declarations.filter((d) => d.kind !== 'functions');
    const tsDecl = tsData.declarations.find((d) => d.name === declName)
        ?? (declName === '(functions)' ? null : classLike.length === 1 ? classLike[0] : null);
    if (!tsDecl) return null;
    const normalized = phpMemberName === '__construct' ? 'constructor' : phpMemberName;
    const memberAliases = (aliases.members ?? {})[phpPath] ?? {};
    const ownProp = (object, key) => (Object.hasOwn(object, key) ? object[key] : undefined);
    const aliased = ownProp(memberAliases, phpMemberName) ?? ownProp(memberAliases, normalized);
    const candidates = aliased !== undefined ? [aliased] : [normalized, `_${normalized}`];
    const member = tsDecl.members.find((m) => candidates.includes(m.name));
    return member ? { path: tsPath, decl: tsDecl, member } : null;
}

function printSlice(label, absolutePath, lines)
{
    console.log(`--- ${label} (${absolutePath}:${lines ? lines[0] : '?'}) ---`);
    if (!existsSync(absolutePath) || !lines) {
        console.log('(source unavailable)');
        return;
    }
    const content = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    console.log(content.slice(lines[0] - 1, lines[1]).join('\n'));
}

function main()
{
    const args = parseArgs(process.argv.slice(2));
    const component = typeof args.component === 'string' ? args.component : undefined;

    ensureUpstream();
    mkdirSync(reportsDir, { recursive: true });

    const php = extractPhp();
    const ts = extractTs(portSrc);
    writeFileSync(join(reportsDir, 'ts.json'), JSON.stringify(ts));

    const aliases = readJson(aliasesPath, { files: {}, members: {} });
    const exclusions = readJson(exclusionsPath, { paths: [], members: {} });
    const approvals = readJson(approvalsPath, {});
    const conventions = readJson(join(scriptDir, 'conventions.json'), {});

    let result = compare({ php, ts, aliases, exclusions, approvals, conventions, component });

    // ---- registry commands ------------------------------------------------
    let registriesChanged = false;
    const rowKey = (row) => approvalKey(row.laravel_path, row.declaration, row.member, row.kind);
    const approvableRows = () =>
        result.memberRows.filter((row) =>
            (row.status === 'both' && row.php_hash !== '' && row.ts_hash !== '' && row.impl_status !== 'n/a')
            || (row.status === 'extra_in_port' && row.ts_hash !== '')
        );

    // A review lands at `pending` (--propose); only a person promotes to
    // `approved` (--approve) -- run by the user, or by Claude only on the
    // user's explicit instruction. Both record the current hashes, so either
    // state goes stale when a body changes.
    const today = () => new Date().toISOString().slice(0, 10);
    const record = (key, row, status) => {
        const existing = approvals[key] ?? {};
        approvals[key] = {
            ...existing,
            php_hash: row.php_hash === '' ? null : row.php_hash,
            ts_hash: row.ts_hash,
            status,
            ...(status === 'approved' ? { approved_at: today() } : { proposed_at: existing.proposed_at ?? today() }),
        };
        const said = { pending: 'proposed', decision: 'decision needed', rejected: 'rejected', approved: 'approved' };
        console.log(`${said[status]}: ${key}`);
    };

    if (typeof args.propose === 'string') {
        const row = approvableRows().find((r) => rowKey(r) === args.propose);
        if (!row) fail(`No reviewable member found for key: ${args.propose}`);
        record(args.propose, row, 'pending');
        registriesChanged = true;
    }

    // A divergence the review could not resolve on its own: recorded with the
    // current hashes so the question stays pinned to the code it is about.
    if (typeof args.decision === 'string') {
        const row = approvableRows().find((r) => rowKey(r) === args.decision);
        if (!row) fail(`No reviewable member found for key: ${args.decision}`);
        record(args.decision, row, 'decision');
        registriesChanged = true;
    }

    if (typeof args.reject === 'string') {
        const row = approvableRows().find((r) => rowKey(r) === args.reject);
        if (!row) fail(`No reviewable member found for key: ${args.reject}`);
        record(args.reject, row, 'rejected');
        registriesChanged = true;
    }

    if (typeof args['propose-file'] === 'string') {
        const rows = approvableRows().filter((r) => r.laravel_path === args['propose-file']);
        if (rows.length === 0) fail(`No reviewable members found in pair: ${args['propose-file']}`);
        for (const row of rows) {
            record(rowKey(row), row, 'pending');
        }
        registriesChanged = true;
    }

    if (typeof args.approve === 'string') {
        const row = approvableRows().find((r) => rowKey(r) === args.approve);
        if (!row) fail(`No reviewable member found for key: ${args.approve}`);
        record(args.approve, row, 'approved');
        registriesChanged = true;
    }

    if (typeof args['approve-file'] === 'string') {
        const rows = approvableRows().filter((r) => r.laravel_path === args['approve-file']);
        if (rows.length === 0) fail(`No reviewable members found in pair: ${args['approve-file']}`);
        for (const row of rows) {
            record(rowKey(row), row, 'approved');
        }
        registriesChanged = true;
    }

    // The user's batch promotion: everything the agent proposed as a perfect
    // mirror, approved in one pass. Human-run (or on explicit instruction),
    // like --approve.
    if (args['approve-pending']) {
        const rows = approvableRows().filter((row) => row.impl_status === 'pending');
        if (rows.length === 0) fail('No pending members' + (component ? ` in component: ${component}` : ''));
        for (const row of rows) {
            record(rowKey(row), row, 'approved');
        }
        registriesChanged = true;
    }

    // Refreshes ts_hash on stale entries whose php_hash still matches -- the
    // reformat case. The judgment that the edit was cosmetic stays with the
    // runner; upstream-side changes are never refreshed.
    if (args['refresh-cosmetic']) {
        let refreshed = 0;
        for (const row of approvableRows()) {
            if (row.impl_status !== 'stale') continue;
            const key = rowKey(row);
            const entry = approvals[key];
            if (!entry) continue;
            const phpUnchanged = (entry.php_hash ?? null) === (row.php_hash === '' ? null : row.php_hash);
            if (phpUnchanged && entry.ts_hash !== row.ts_hash) {
                entry.ts_hash = row.ts_hash;
                refreshed++;
                console.log(`refreshed: ${key}`);
            }
        }
        if (refreshed === 0) fail('No cosmetic stales to refresh (an upstream-side stale needs a real re-review)');
        registriesChanged = true;
    }

    if (typeof args.revoke === 'string') {
        if (!approvals[args.revoke]) fail(`No approval recorded for key: ${args.revoke}`);
        delete approvals[args.revoke];
        registriesChanged = true;
        console.log(`revoked: ${args.revoke}`);
    }

    if (typeof args.exclude === 'string') {
        if (typeof args.reason !== 'string') fail('--exclude needs --reason "..."');
        const kind = typeof args.kind === 'string' ? args.kind : 'deferred';
        if (kind !== 'deferred' && kind !== 'impossible') fail("--kind takes 'deferred' (default) or 'impossible'");
        const found = findPhpMember(php, args.exclude);
        if (!found) fail(`No upstream member found for key: ${args.exclude}`);
        exclusions.members ??= {};
        exclusions.members[args.exclude] = { php_hash: found.member.hash ?? null, kind, reason: args.reason };
        writeJsonSorted(exclusionsPath, {
            ...exclusions,
            paths: exclusions.paths ?? [],
            members: exclusions.members,
            traits: exclusions.traits ?? {},
            heritage: exclusions.heritage ?? {},
        });
        registriesChanged = true;
        console.log(`excluded: ${args.exclude}`);
    }

    if (registriesChanged) {
        writeJsonSorted(approvalsPath, approvals);
        result = compare({ php, ts, aliases, exclusions, approvals, conventions, component });
    }

    // ---- reports ----------------------------------------------------------
    writeFileSync(join(reportsDir, 'files.csv'), toCsv(result.fileRows, FILE_COLUMNS));
    writeFileSync(join(reportsDir, 'members.csv'), toCsv(result.memberRows, MEMBER_COLUMNS));
    const summary = summaryText(result.summary, upstreamVersion());
    writeFileSync(join(reportsDir, 'summary.md'), summary);

    // ---- query commands ---------------------------------------------------
    if (typeof args.list === 'string') {
        const wanted = args.list;
        if (!['stale', 'unreviewed', 'pending', 'decision', 'rejected'].includes(wanted)) {
            fail("--list takes 'stale', 'unreviewed', 'pending', 'decision' or 'rejected'");
        }
        const rows = result.memberRows.filter((row) =>
            row.impl_status === wanted || (wanted === 'stale' && row.note.includes('STALE exclusion'))
        );
        for (const row of rows) {
            console.log(rowKey(row));
        }
        console.log(`${rows.length} ${wanted} member(s)`);
        return;
    }

    // The verbatim verifier: prints the normalized-token residue between the
    // two bodies. Empty residue backs a `Verbatim.` tag; each printed run must
    // be justified by a conventions.json structural rule, or escalate.
    if (typeof args.verify === 'string') {
        const phpFound = findPhpMember(php, args.verify);
        const tsFound = findTsMember(php, ts, aliases, args.verify);
        if (!phpFound || !phpFound.member.lines) fail(`No upstream member with source found for key: ${args.verify}`);
        if (!tsFound || !tsFound.member.lines) fail(`No port member with source found for key: ${args.verify}`);
        const phpFile = phpFound.member.file
            ? join(vendorRoot, phpFound.member.file)
            : join(upstreamSrc, phpFound.path);
        const { residue, disagreeing, total } = verifyMember({
            scriptDir,
            phpFile,
            phpLines: phpFound.member.lines,
            tsFile: join(portSrc, tsFound.path),
            tsLines: tsFound.member.lines,
            conventions,
        });
        if (residue.length === 0) {
            console.log(`VERBATIM: token streams align (${total} tokens) -- 100% mirrored`);
        } else {
            const fidelity = total > 0 ? Math.round(((total - disagreeing) / total) * 100) : 100;
            console.log(`RESIDUE: ${residue.length} run(s), ${disagreeing}/${total} tokens disagree -- ${fidelity}% mirrored`);
            for (const run of residue) {
                console.log(`  php: ${run.php.join(' ') || '(nothing)'}`);
                console.log(`  ts : ${run.ts.join(' ') || '(nothing)'}`);
            }
        }
        return;
    }

    if (typeof args.show === 'string') {
        const phpFound = findPhpMember(php, args.show);
        const tsFound = findTsMember(php, ts, aliases, args.show);
        if (!phpFound && !tsFound) fail(`No member found for key: ${args.show}`);
        if (phpFound) {
            const phpFile = phpFound.member.file
                ? join(vendorRoot, phpFound.member.file)
                : join(upstreamSrc, phpFound.path);
            printSlice('laravel', phpFile, phpFound.member.lines);
        } else {
            console.log('--- laravel ---\n(no upstream twin)');
        }
        if (tsFound) {
            printSlice('port', join(portSrc, tsFound.path), tsFound.member.lines);
        } else {
            console.log('--- port ---\n(no counterpart)');
        }
        // The recorded judgment belongs next to the bodies it judges.
        const baseKey = args.show.split('@')[0];
        const approval = Object.hasOwn(approvals, args.show)
            ? approvals[args.show]
            : (Object.hasOwn(approvals, baseKey) ? approvals[baseKey] : undefined);
        if (approval) {
            const dates = [
                approval.proposed_at ? `proposed ${approval.proposed_at}` : '',
                approval.approved_at ? `approved ${approval.approved_at}` : '',
            ].filter(Boolean).join(', ');
            console.log(`--- review: ${approval.status}${dates ? ` (${dates})` : ''} ---`);
            if (approval.note) console.log(approval.note);
        }
        const memberWaivers = exclusions.members ?? {};
        const waiver = Object.hasOwn(memberWaivers, args.show)
            ? memberWaivers[args.show]
            : (Object.hasOwn(memberWaivers, baseKey) ? memberWaivers[baseKey] : undefined);
        if (waiver) {
            console.log(`--- waiver: ${waiver.kind ?? 'deferred'} ---`);
            if (waiver.reason) console.log(waiver.reason);
        }
        return;
    }

    process.stdout.write('\n' + summary + '\n');
    console.log(`reports: ${join('reports', 'parity')}${component ? ` (component: ${component})` : ''}`);

    if (args.check) {
        if (result.staleKeys.length > 0) {
            console.error(`\nSTALE (${result.staleKeys.length}):`);
            for (const key of result.staleKeys) console.error(`  ${key}`);
            process.exit(1);
        }
        console.log('check: nothing stale');
    }
}

main();
