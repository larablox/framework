// Matches the two extracted surfaces (php.json / ts.json) file to file and
// member to member, applies aliases, exclusions and approvals, and produces
// the rows for files.csv / members.csv plus the per-component summary.

function stripExt(path)
{
    return path.replace(/\.(php|ts)$/, '');
}

function componentOf(path)
{
    const slash = path.indexOf('/');
    return slash === -1 ? '(root)' : path.slice(0, slash);
}

function globToRegExp(glob)
{
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '.*');
    return new RegExp(`^${escaped}$`);
}

function normalizePhpMemberName(name)
{
    return name === '__construct' ? 'constructor' : name;
}

// Member names like "constructor" must never fall through to
// Object.prototype -- always look registries up with an own-property check.
function ownProp(object, key)
{
    return Object.hasOwn(object, key) ? object[key] : undefined;
}

export function memberKey(phpPath, declName, phpMemberName)
{
    return `${phpPath}#${declName}#${phpMemberName}`;
}

// Methods keep their historical kindless keys; every other kind carries a
// `@kind` suffix so a property can live beside its same-named method
// ($pipes beside pipes()) without colliding in the registries.
export function approvalKey(phpPath, declName, memberName, kind)
{
    const base = memberKey(phpPath, declName, memberName);
    return kind === 'method' || kind === 'function' ? base : `${base}@${kind}`;
}

// A registry entry's status maps onto impl_status directly: `pending` is a
// review awaiting promotion, `decision` is a divergence awaiting the user's
// call, `rejected` is a review that found the port wrong. Anything else --
// historical entries included -- reads as approved.
function implStatusOf(approvalStatus)
{
    return approvalStatus === 'pending' || approvalStatus === 'decision' || approvalStatus === 'rejected'
        ? approvalStatus
        : 'approved';
}

export function compare({ php, ts, aliases, exclusions, approvals, conventions, component })
{
    const phpFiles = php.files;
    const tsFiles = ts.files;
    const fileAliases = aliases.files ?? {};
    const memberAliases = aliases.members ?? {};
    const pathExclusions = (exclusions.paths ?? []).map((entry) => ({ ...entry, regex: globToRegExp(entry.glob) }));
    const memberExclusions = exclusions.members ?? {};
    const traitExclusions = exclusions.traits ?? {};
    const heritageExclusions = exclusions.heritage ?? {};
    const markerDecorators = (conventions ?? {}).markerDecorators ?? {};

    const inComponent = (path) => component === undefined || componentOf(path) === component;

    const pairs = [];
    const consumedTs = new Set();

    for (const phpPath of Object.keys(phpFiles).sort()) {
        // An alias wins over the same-path match: Support/Stringable.php maps
        // to Str.ts even though a Stringable.ts (a re-export) exists.
        const aliased = ownProp(fileAliases, phpPath);
        if (aliased && tsFiles[aliased]) {
            pairs.push({ phpPath, tsPath: aliased, status: 'renamed' });
            consumedTs.add(aliased);
            continue;
        }
        const direct = `${stripExt(phpPath)}.ts`;
        if (tsFiles[direct]) {
            pairs.push({ phpPath, tsPath: direct, status: 'matched' });
            consumedTs.add(direct);
            continue;
        }
        pairs.push({ phpPath, tsPath: null, status: 'missing_in_port' });
    }
    for (const tsPath of Object.keys(tsFiles).sort()) {
        if (!consumedTs.has(tsPath)) {
            pairs.push({ phpPath: null, tsPath, status: 'extra_in_port' });
        }
    }

    const fileRows = [];
    const memberRows = [];
    const staleKeys = [];

    for (const pair of pairs) {
        const anchorPath = pair.phpPath ?? pair.tsPath;
        if (!inComponent(anchorPath)) continue;

        let status = pair.status;
        let waiver = '';
        let exclusionReason = '';
        if (status === 'missing_in_port' || status === 'extra_in_port') {
            const exclusion = pathExclusions.find((entry) => entry.regex.test(anchorPath));
            if (exclusion) {
                status = 'excluded';
                waiver = exclusion.kind ?? 'deferred';
                exclusionReason = exclusion.reason ?? '';
            }
        }

        const row = {
            component: componentOf(anchorPath),
            status,
            waiver,
            laravel_path: pair.phpPath ?? '',
            port_path: pair.tsPath ?? '',
            laravel_kinds: '',
            laravel_members: 0,
            port_members: 0,
            members_both: 0,
            members_missing_in_port: 0,
            members_extra_in_port: 0,
            parity_pct: '',
            impl_approved: 0,
            impl_pending: 0,
            impl_decision: 0,
            impl_rejected: 0,
            impl_stale: 0,
            impl_unreviewed: 0,
            note: exclusionReason,
        };

        const notes = [];
        const phpData = pair.phpPath ? phpFiles[pair.phpPath] : null;
        const tsData = pair.tsPath ? tsFiles[pair.tsPath] : null;

        if (phpData) {
            row.laravel_kinds = phpData.declarations.map((d) => d.kind).join('+');
            row.laravel_members = phpData.declarations.reduce((n, d) => n + d.members.length, 0);
            // The same member universe fidelity is measured over, needed for
            // coverage when this file is waived as deferred.
            row._ppSelfMembers = phpData.declarations.reduce(
                (n, d) => n + d.members.filter((m) => m.visibility !== 'private' && m.origin === 'self').length,
                0,
            );
            for (const decl of phpData.declarations) {
                if (decl.uses.length > 0) notes.push(`uses:${decl.uses.join(',')}`);
                for (const note of decl.notes) notes.push(note);
                // Every `uses:` trait gets its own members.csv row, so a
                // missing mixin is visible where members are read -- not only
                // as a file note. A waived trait (exclusions.traits) reads as
                // excluded/deferred with its reason.
                if (tsData) {
                    const relationRow = (short, kind, status, implStatus, note, phpHash = '', tsHash = '') => ({
                        component: row.component,
                        laravel_path: pair.phpPath,
                        declaration: decl.name,
                        member: short,
                        kind,
                        status,
                        origin: 'self',
                        php_visibility: '',
                        php_static: '',
                        ts_visibility: '',
                        ts_static: '',
                        impl_status: implStatus,
                        vendor_deps: '',
                        php_line: '',
                        ts_line: '',
                        php_hash: phpHash,
                        ts_hash: tsHash,
                        note,
                    });
                    const tsHeritage = tsData.declarations.flatMap((d) => d.extends ?? []);
                    const tsNotes = tsData.declarations.flatMap((d) => d.notes ?? []);
                    const tsDecorators = tsData.declarations.flatMap((d) => d.decorators ?? []);

                    // One relation of any kind: waived, missing, or present.
                    // A present relation is reviewable like a member -- its
                    // "hashes" are the FQCN and the matched heritage text, so
                    // a rewritten mixin chain or a changed upstream relation
                    // flips the entry stale. A marker interface additionally
                    // owes its validating class decorator (markerDecorators),
                    // the runtime half of what PHP's instanceof checked.
                    const relation = (kind, fqcn, waivers, missingStatus, label, notePrefix) => {
                        const short = fqcn.split('\\').pop();
                        const waiver = ownProp(waivers, fqcn) ?? ownProp(waivers, short);
                        if (waiver) {
                            memberRows.push(relationRow(short, kind, 'excluded', 'deferred', waiver));
                            return;
                        }
                        const matched = tsHeritage.find((heritage) => heritage.includes(short))
                            ?? tsNotes.find((note) => note.includes(short));
                        if (matched === undefined) {
                            notes.push(`[missing ${label}: ${short}]`);
                            row.impl_rejected++;
                            memberRows.push(relationRow(short, kind, missingStatus, 'rejected', `${notePrefix}:${fqcn}`));
                            return;
                        }
                        const requiredDecorator = kind === 'implements' ? ownProp(markerDecorators, short) : undefined;
                        if (requiredDecorator !== undefined && !tsDecorators.includes(requiredDecorator)) {
                            notes.push(`[missing decorator: @${requiredDecorator}]`);
                            row.impl_rejected++;
                            memberRows.push(relationRow(short, kind, 'both', 'rejected', `${notePrefix}:${fqcn} [missing decorator: @${requiredDecorator}]`));
                            return;
                        }
                        const phpHash = `rel:${fqcn}`;
                        const tsHash = `rel:${matched}`;
                        const reviewKey = approvalKey(pair.phpPath, decl.name, short, kind);
                        const approval = ownProp(approvals, reviewKey);
                        const noteParts = [`${notePrefix}:${fqcn}`];
                        let implStatus;
                        if (!approval) {
                            implStatus = 'unreviewed';
                            row.impl_unreviewed++;
                        } else if (approval.php_hash === phpHash && approval.ts_hash === tsHash) {
                            implStatus = implStatusOf(approval.status);
                            row[`impl_${implStatus}`]++;
                        } else {
                            implStatus = 'stale';
                            row.impl_stale++;
                            staleKeys.push(reviewKey);
                        }
                        if (approval?.note) noteParts.push(approval.note);
                        memberRows.push(relationRow(short, kind, 'both', implStatus, noteParts.join(' '), phpHash, tsHash));
                    };

                    for (const trait of decl.uses) {
                        relation('trait', trait, traitExclusions, 'missing_mixin', 'mixin', 'uses');
                    }
                    for (const iface of decl.implements) {
                        relation('implements', iface, heritageExclusions, 'missing_interface', 'interface', 'implements');
                    }
                    for (const parent of decl.extends) {
                        relation('extends', parent, heritageExclusions, 'missing_parent', 'parent', 'extends');
                    }
                }
            }
        }
        if (tsData) {
            row.port_members = tsData.declarations.reduce((n, d) => n + d.members.length, 0);
        }
        if (row.note === '' && notes.length > 0) row.note = notes.join(' ');

        if (phpData && tsData) {
            compareMembers(pair, phpData, tsData, row, memberRows, {
                memberAliases: memberAliases[pair.phpPath] ?? {},
                memberExclusions,
                approvals,
                staleKeys,
            });
        }

        fileRows.push(row);
    }

    fileRows.sort((a, b) =>
        a.component.localeCompare(b.component)
        || (a.laravel_path || a.port_path).localeCompare(b.laravel_path || b.port_path)
    );
    memberRows.sort(
        (a, b) =>
            a.component.localeCompare(b.component)
            || a.laravel_path.localeCompare(b.laravel_path)
            || a.declaration.localeCompare(b.declaration)
            || a.member.localeCompare(b.member),
    );

    return { fileRows, memberRows, staleKeys, summary: summarize(fileRows) };
}

function compareMembers(pair, phpData, tsData, fileRow, memberRows, ctx)
{
    const tsDeclByName = new Map(tsData.declarations.map((d) => [d.name, d]));
    const tsClassLike = tsData.declarations.filter((d) => d.kind !== 'functions');
    const consumed = new Map(tsData.declarations.map((d) => [d.name, new Set()]));

    const phpPublicProtected = { both: 0, missing: 0 };

    // PHP allows a property and a method to share a name; TS does not. Match
    // in two passes so the TS member goes to the PHP member of the same
    // category first (method-like vs data-like), and only then cross-kind.
    const categoryOf = (
        kind,
    ) => (kind === 'method' || kind === 'function' ? 'call' : kind === 'accessor' ? 'either' : 'data');

    for (const decl of phpData.declarations) {
        let tsDecl = tsDeclByName.get(decl.name) ?? null;
        if (!tsDecl && decl.kind === 'functions') tsDecl = tsDeclByName.get('(functions)') ?? null;
        if (!tsDecl && decl.kind !== 'functions' && tsClassLike.length === 1) tsDecl = tsClassLike[0];

        const tsMembers = new Map((tsDecl?.members ?? []).map((m) => [m.name, m]));

        // A leading underscore is the port's convention for a PHP name the
        // TS side cannot use as-is -- a reserved word (`_with`) or a
        // property/method collision (`_pipes` beside `pipes()`) -- so `_x`
        // is tried automatically when no member is named `x`.
        const tsNamesFor = (phpMember) => {
            const normalized = normalizePhpMemberName(phpMember.name);
            const aliased = ownProp(ctx.memberAliases, `${phpMember.name}@${phpMember.kind}`)
                ?? ownProp(ctx.memberAliases, phpMember.name) ?? ownProp(ctx.memberAliases, normalized);
            return aliased !== undefined ? [aliased] : [normalized, `_${normalized}`];
        };

        const assigned = new Map();
        const claimedTsNames = new Set();
        for (const phpMember of decl.members) {
            for (const tsName of tsNamesFor(phpMember)) {
                const candidate = tsMembers.get(tsName);
                if (!candidate || claimedTsNames.has(tsName)) continue;
                const phpCategory = categoryOf(phpMember.kind);
                const tsCategory = categoryOf(candidate.kind);
                if (phpCategory === tsCategory || (tsCategory === 'either' && phpCategory === 'data')) {
                    assigned.set(phpMember, candidate);
                    claimedTsNames.add(tsName);
                    break;
                }
            }
        }
        for (const phpMember of decl.members) {
            if (assigned.has(phpMember)) continue;
            for (const tsName of tsNamesFor(phpMember)) {
                const candidate = tsMembers.get(tsName);
                if (candidate && !claimedTsNames.has(tsName)) {
                    assigned.set(phpMember, candidate);
                    claimedTsNames.add(tsName);
                    break;
                }
            }
        }

        for (const phpMember of decl.members) {
            const normalized = normalizePhpMemberName(phpMember.name);
            const tsMember = assigned.get(phpMember) ?? null;
            const tsName = tsMember?.name ?? tsNamesFor(phpMember)[0];
            if (tsMember && tsDecl) consumed.get(tsDecl.name)?.add(tsMember.name);

            const key = memberKey(pair.phpPath, decl.name, phpMember.name);
            const noteParts = [];
            if (phpMember.name.startsWith('__') && phpMember.name !== '__construct') noteParts.push('php-magic');
            if (tsName !== normalized) noteParts.push(`aliased:${tsName}`);
            if (tsMember && tsMember.kind !== phpMember.kind) noteParts.push(`ts-kind:${tsMember.kind}`);

            let status = tsMember ? 'both' : 'missing_in_port';
            // `key@kind` disambiguates a property/method name collision.
            const exclusion = ownProp(ctx.memberExclusions, `${key}@${phpMember.kind}`)
                ?? ownProp(ctx.memberExclusions, key);
            if (!tsMember && exclusion) {
                status = 'excluded';
                const waiverKind = exclusion.kind ?? 'deferred';
                noteParts.push(`[${waiverKind}]`, exclusion.reason ?? '');
                if (waiverKind === 'deferred' && phpMember.visibility !== 'private' && phpMember.origin === 'self') {
                    fileRow._deferredMembers = (fileRow._deferredMembers ?? 0) + 1;
                }
                if (exclusion.php_hash && phpMember.hash && exclusion.php_hash !== phpMember.hash) {
                    noteParts.push('[STALE exclusion: upstream body changed]');
                    ctx.staleKeys.push(key);
                }
            }

            // A waived member's impl_status carries the waiver kind, so the
            // column never reads as an unexplained blank.
            let implStatus = status === 'excluded' ? (exclusion.kind ?? 'deferred') : '';
            const reviewKey = approvalKey(pair.phpPath, decl.name, phpMember.name, phpMember.kind);
            if (status === 'both') {
                const reviewable = phpMember.hash !== null && tsMember.hash !== null;
                if (!reviewable) {
                    implStatus = 'n/a';
                } else {
                    const approval = ownProp(ctx.approvals, reviewKey);
                    if (!approval) {
                        implStatus = 'unreviewed';
                        fileRow.impl_unreviewed++;
                    } else if (approval.php_hash === phpMember.hash && approval.ts_hash === tsMember.hash) {
                        // Claude's review ends at `pending` (a mirror ready
                        // for promotion), `decision` (a divergence awaiting
                        // the user's call) or `rejected`; only a person
                        // promotes to `approved` (--approve, run by the user
                        // or on the user's explicit instruction).
                        implStatus = implStatusOf(approval.status);
                        fileRow[`impl_${implStatus}`]++;
                    } else {
                        implStatus = 'stale';
                        fileRow.impl_stale++;
                        ctx.staleKeys.push(reviewKey);
                    }
                    if (approval?.note) noteParts.push(approval.note);
                }
            }

            if (status === 'both') fileRow.members_both++;
            if (status === 'missing_in_port') fileRow.members_missing_in_port++;
            if (phpMember.visibility !== 'private' && phpMember.origin === 'self') {
                if (status === 'both') phpPublicProtected.both++;
                if (status === 'missing_in_port') phpPublicProtected.missing++;
            }

            memberRows.push({
                component: fileRow.component,
                laravel_path: pair.phpPath,
                declaration: decl.name,
                member: phpMember.name,
                kind: phpMember.kind,
                status,
                origin: phpMember.origin,
                php_visibility: phpMember.visibility,
                php_static: phpMember.static ? 'static' : '',
                ts_visibility: tsMember?.visibility ?? '',
                ts_static: tsMember ? (tsMember.static ? 'static' : '') : '',
                impl_status: implStatus,
                vendor_deps: (phpMember.vendorDeps ?? []).join(';'),
                php_line: phpMember.lines?.[0] ?? '',
                ts_line: tsMember?.lines?.[0] ?? '',
                php_hash: phpMember.hash ?? '',
                ts_hash: tsMember?.hash ?? '',
                note: noteParts.filter(Boolean).join(' '),
            });
        }
    }

    // Port members with no upstream counterpart inside a matched pair. They
    // are reviewable too: an approval records ts_hash with php_hash null, and
    // goes stale when the port edits the member.
    for (const tsDecl of tsData.declarations) {
        const used = consumed.get(tsDecl.name) ?? new Set();
        for (const tsMember of tsDecl.members) {
            if (used.has(tsMember.name)) continue;
            fileRow.members_extra_in_port++;
            const noteParts = [];
            let implStatus = '';
            if (tsMember.hash !== null) {
                const reviewKey = approvalKey(pair.phpPath, tsDecl.name, tsMember.name, tsMember.kind);
                const approval = ownProp(ctx.approvals, reviewKey);
                if (!approval) {
                    implStatus = 'unreviewed';
                    fileRow.impl_unreviewed++;
                } else if ((approval.php_hash ?? null) === null && approval.ts_hash === tsMember.hash) {
                    implStatus = implStatusOf(approval.status);
                    fileRow[`impl_${implStatus}`]++;
                } else {
                    implStatus = 'stale';
                    fileRow.impl_stale++;
                    ctx.staleKeys.push(reviewKey);
                }
                if (approval?.note) noteParts.push(approval.note);
            }
            memberRows.push({
                component: fileRow.component,
                laravel_path: pair.phpPath,
                declaration: tsDecl.name,
                member: tsMember.name,
                kind: tsMember.kind,
                status: 'extra_in_port',
                origin: 'self',
                php_visibility: '',
                php_static: '',
                ts_visibility: tsMember.visibility,
                ts_static: tsMember.static ? 'static' : '',
                impl_status: implStatus,
                vendor_deps: '',
                php_line: '',
                ts_line: tsMember.lines?.[0] ?? '',
                php_hash: '',
                ts_hash: tsMember.hash ?? '',
                note: noteParts.join(' '),
            });
        }
    }

    const denominator = phpPublicProtected.both + phpPublicProtected.missing;
    if (denominator > 0) {
        fileRow.parity_pct = String(Math.round((phpPublicProtected.both / denominator) * 100));
    }
}

function summarize(fileRows)
{
    const byComponent = new Map();
    for (const row of fileRows) {
        let entry = byComponent.get(row.component);
        if (!entry) {
            entry = {
                component: row.component,
                files: 0,
                matched: 0,
                deferred: 0,
                impossible: 0,
                port_only: 0,
                missing: 0,
                extra: 0,
                members_both: 0,
                members_missing: 0,
                members_deferred: 0,
                members_unported: 0,
                approved: 0,
                pending: 0,
                decision: 0,
                rejected: 0,
                stale: 0,
                unreviewed: 0,
            };
            byComponent.set(row.component, entry);
        }
        entry.files++;
        if (row.status === 'matched' || row.status === 'renamed') entry.matched++;
        if (row.status === 'excluded') {
            if (row.waiver === 'deferred') {
                entry.deferred++;
                entry.members_deferred += row._ppSelfMembers ?? 0;
            } else if (row.waiver === 'port-only') {
                entry.port_only++;
            } else {
                entry.impossible++;
            }
        }
        if (row.status === 'missing_in_port') {
            entry.missing++;
            entry.members_unported += row._ppSelfMembers ?? 0;
        }
        if (row.status === 'extra_in_port') entry.extra++;
        entry.members_both += row.members_both;
        entry.members_missing += row.members_missing_in_port;
        entry.members_deferred += row._deferredMembers ?? 0;
        entry.approved += row.impl_approved;
        entry.pending += row.impl_pending;
        entry.decision += row.impl_decision;
        entry.rejected += row.impl_rejected;
        entry.stale += row.impl_stale;
        entry.unreviewed += row.impl_unreviewed;
    }
    return [...byComponent.values()].sort((a, b) => a.component.localeCompare(b.component));
}

export function toCsv(rows, columns)
{
    const escape = (value) => {
        const text = String(value ?? '');
        return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const lines = [columns.join(',')];
    for (const row of rows) {
        lines.push(columns.map((column) => escape(row[column])).join(','));
    }

    // BOM so Excel picks UTF-8 instead of the ANSI codepage.
    return '\uFEFF' + lines.join('\n') + '\n';
}

export function summaryText(summary, upstreamVersion)
{
    // Two ratios, two questions. Fidelity: of what was ported, how much
    // matches. Coverage: of what is portable at all (deferred waivers
    // included, impossible ones not), how much has been ported.
    const fidelityOf = (entry) => {
        const denominator = entry.members_both + entry.members_missing;
        return denominator > 0 ? `${Math.round((entry.members_both / denominator) * 100)}%` : '-';
    };
    const coverageOf = (entry) => {
        // Missing members inside ported files, whole unported files, and
        // deferred waivers all count as lag; impossible and port-only do not.
        const denominator = entry.members_both + entry.members_missing + entry.members_unported
            + entry.members_deferred;
        return denominator > 0 ? `${Math.round((entry.members_both / denominator) * 100)}%` : '-';
    };

    const lines = [];
    lines.push(`# Parity summary`);
    lines.push('');
    lines.push(`Reference: laravel/framework ${upstreamVersion}`);
    lines.push('');
    lines.push(
        '| Component | Files | Matched | Deferred | Impossible | Port-only | Missing | Extra | Coverage | Fidelity | Approved | Pending | Decision | Rejected | Stale | Unreviewed |',
    );
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    const totals = {
        component: '**Total**',
        files: 0,
        matched: 0,
        deferred: 0,
        impossible: 0,
        port_only: 0,
        missing: 0,
        extra: 0,
        members_both: 0,
        members_missing: 0,
        members_deferred: 0,
        members_unported: 0,
        approved: 0,
        pending: 0,
        decision: 0,
        rejected: 0,
        stale: 0,
        unreviewed: 0,
    };
    const line = (entry) =>
        `| ${entry.component} | ${entry.files} | ${entry.matched} | ${entry.deferred} | ${entry.impossible} | ${entry.port_only} | ${entry.missing} | ${entry.extra} | ${
            coverageOf(entry)
        } | ${fidelityOf(entry)} | ${entry.approved} | ${entry.pending} | ${entry.decision} | ${entry.rejected} | ${entry.stale} | ${entry.unreviewed} |`;
    for (const entry of summary) {
        lines.push(line(entry));
        for (const key of Object.keys(totals)) {
            if (key !== 'component') totals[key] += entry[key];
        }
    }
    lines.push(line(totals));
    return lines.join('\n') + '\n';
}

export const FILE_COLUMNS = [
    'component',
    'status',
    'waiver',
    'laravel_path',
    'port_path',
    'laravel_kinds',
    'laravel_members',
    'port_members',
    'members_both',
    'members_missing_in_port',
    'members_extra_in_port',
    'parity_pct',
    'impl_approved',
    'impl_pending',
    'impl_decision',
    'impl_rejected',
    'impl_stale',
    'impl_unreviewed',
    'note',
];

export const MEMBER_COLUMNS = [
    'component',
    'laravel_path',
    'declaration',
    'member',
    'kind',
    'status',
    'origin',
    'php_visibility',
    'php_static',
    'ts_visibility',
    'ts_static',
    'impl_status',
    'vendor_deps',
    'php_line',
    'ts_line',
    'php_hash',
    'ts_hash',
    'note',
];
