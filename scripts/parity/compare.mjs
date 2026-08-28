// Matches the two extracted surfaces (php.json / ts.json) file to file and
// member to member, applies aliases, exclusions and approvals, and produces
// the rows for files.csv / members.csv plus the per-component summary.

const REVIEWABLE_KINDS = new Set(["method", "function", "accessor"]);

function stripExt(path) {
	return path.replace(/\.(php|ts)$/, "");
}

function componentOf(path) {
	const slash = path.indexOf("/");
	return slash === -1 ? "(root)" : path.slice(0, slash);
}

function globToRegExp(glob) {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
	return new RegExp(`^${escaped}$`);
}

function normalizePhpMemberName(name) {
	return name === "__construct" ? "constructor" : name;
}

// Member names like "constructor" must never fall through to
// Object.prototype -- always look registries up with an own-property check.
function ownProp(object, key) {
	return Object.hasOwn(object, key) ? object[key] : undefined;
}

export function memberKey(phpPath, declName, phpMemberName) {
	return `${phpPath}#${declName}#${phpMemberName}`;
}

export function compare({ php, ts, aliases, exclusions, approvals, component }) {
	const phpFiles = php.files;
	const tsFiles = ts.files;
	const fileAliases = aliases.files ?? {};
	const memberAliases = aliases.members ?? {};
	const pathExclusions = (exclusions.paths ?? []).map((entry) => ({ ...entry, regex: globToRegExp(entry.glob) }));
	const memberExclusions = exclusions.members ?? {};

	const inComponent = (path) => component === undefined || componentOf(path) === component;

	const pairs = [];
	const consumedTs = new Set();

	for (const phpPath of Object.keys(phpFiles).sort()) {
		// An alias wins over the same-path match: Support/Stringable.php maps
		// to Str.ts even though a Stringable.ts (a re-export) exists.
		const aliased = ownProp(fileAliases, phpPath);
		if (aliased && tsFiles[aliased]) {
			pairs.push({ phpPath, tsPath: aliased, status: "renamed" });
			consumedTs.add(aliased);
			continue;
		}
		const direct = `${stripExt(phpPath)}.ts`;
		if (tsFiles[direct]) {
			pairs.push({ phpPath, tsPath: direct, status: "matched" });
			consumedTs.add(direct);
			continue;
		}
		pairs.push({ phpPath, tsPath: null, status: "missing_in_port" });
	}
	for (const tsPath of Object.keys(tsFiles).sort()) {
		if (!consumedTs.has(tsPath)) {
			pairs.push({ phpPath: null, tsPath, status: "extra_in_port" });
		}
	}

	const fileRows = [];
	const memberRows = [];
	const staleKeys = [];

	for (const pair of pairs) {
		const anchorPath = pair.phpPath ?? pair.tsPath;
		if (!inComponent(anchorPath)) continue;

		let status = pair.status;
		let exclusionReason = "";
		if (status === "missing_in_port" || status === "extra_in_port") {
			const exclusion = pathExclusions.find((entry) => entry.regex.test(anchorPath));
			if (exclusion) {
				status = "excluded";
				exclusionReason = exclusion.reason ?? "";
			}
		}

		const row = {
			component: componentOf(anchorPath),
			status,
			laravel_path: pair.phpPath ?? "",
			port_path: pair.tsPath ?? "",
			laravel_kinds: "",
			laravel_members: 0,
			port_members: 0,
			members_both: 0,
			members_missing_in_port: 0,
			members_extra_in_port: 0,
			parity_pct: "",
			impl_approved: 0,
			impl_stale: 0,
			impl_unreviewed: 0,
			note: exclusionReason,
		};

		const notes = [];
		const phpData = pair.phpPath ? phpFiles[pair.phpPath] : null;
		const tsData = pair.tsPath ? tsFiles[pair.tsPath] : null;

		if (phpData) {
			row.laravel_kinds = phpData.declarations.map((d) => d.kind).join("+");
			row.laravel_members = phpData.declarations.reduce((n, d) => n + d.members.length, 0);
			for (const decl of phpData.declarations) {
				if (decl.uses.length > 0) notes.push(`uses:${decl.uses.join(",")}`);
				for (const note of decl.notes) notes.push(note);
			}
		}
		if (tsData) {
			row.port_members = tsData.declarations.reduce((n, d) => n + d.members.length, 0);
		}
		if (row.note === "" && notes.length > 0) row.note = notes.join(" ");

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

	fileRows.sort((a, b) => a.component.localeCompare(b.component) || (a.laravel_path || a.port_path).localeCompare(b.laravel_path || b.port_path));
	memberRows.sort(
		(a, b) =>
			a.component.localeCompare(b.component) ||
			a.laravel_path.localeCompare(b.laravel_path) ||
			a.declaration.localeCompare(b.declaration) ||
			a.member.localeCompare(b.member),
	);

	return { fileRows, memberRows, staleKeys, summary: summarize(fileRows) };
}

function compareMembers(pair, phpData, tsData, fileRow, memberRows, ctx) {
	const tsDeclByName = new Map(tsData.declarations.map((d) => [d.name, d]));
	const tsClassLike = tsData.declarations.filter((d) => d.kind !== "functions");
	const consumed = new Map(tsData.declarations.map((d) => [d.name, new Set()]));

	const phpPublicProtected = { both: 0, missing: 0 };

	// PHP allows a property and a method to share a name; TS does not. Match
	// in two passes so the TS member goes to the PHP member of the same
	// category first (method-like vs data-like), and only then cross-kind.
	const categoryOf = (kind) => (kind === "method" || kind === "function" ? "call" : kind === "accessor" ? "either" : "data");

	for (const decl of phpData.declarations) {
		let tsDecl = tsDeclByName.get(decl.name) ?? null;
		if (!tsDecl && decl.kind === "functions") tsDecl = tsDeclByName.get("(functions)") ?? null;
		if (!tsDecl && decl.kind !== "functions" && tsClassLike.length === 1) tsDecl = tsClassLike[0];

		const tsMembers = new Map((tsDecl?.members ?? []).map((m) => [m.name, m]));

		const tsNameFor = (phpMember) => {
			const normalized = normalizePhpMemberName(phpMember.name);
			return ownProp(ctx.memberAliases, `${phpMember.name}@${phpMember.kind}`) ?? ownProp(ctx.memberAliases, phpMember.name) ?? ownProp(ctx.memberAliases, normalized) ?? normalized;
		};

		const assigned = new Map();
		const claimedTsNames = new Set();
		for (const phpMember of decl.members) {
			const tsName = tsNameFor(phpMember);
			const candidate = tsMembers.get(tsName);
			if (!candidate || claimedTsNames.has(tsName)) continue;
			const phpCategory = categoryOf(phpMember.kind);
			const tsCategory = categoryOf(candidate.kind);
			if (phpCategory === tsCategory || (tsCategory === "either" && phpCategory === "data")) {
				assigned.set(phpMember, candidate);
				claimedTsNames.add(tsName);
			}
		}
		for (const phpMember of decl.members) {
			if (assigned.has(phpMember)) continue;
			const tsName = tsNameFor(phpMember);
			const candidate = tsMembers.get(tsName);
			if (candidate && !claimedTsNames.has(tsName)) {
				assigned.set(phpMember, candidate);
				claimedTsNames.add(tsName);
			}
		}

		for (const phpMember of decl.members) {
			const normalized = normalizePhpMemberName(phpMember.name);
			const tsName = tsNameFor(phpMember);
			const tsMember = assigned.get(phpMember) ?? null;
			if (tsMember && tsDecl) consumed.get(tsDecl.name)?.add(tsMember.name);

			const key = memberKey(pair.phpPath, decl.name, phpMember.name);
			const noteParts = [];
			if (phpMember.name.startsWith("__") && phpMember.name !== "__construct") noteParts.push("php-magic");
			if (tsName !== normalized) noteParts.push(`aliased:${tsName}`);
			if (tsMember && tsMember.kind !== phpMember.kind) noteParts.push(`ts-kind:${tsMember.kind}`);

			let status = tsMember ? "both" : "missing_in_port";
			// `key@kind` disambiguates a property/method name collision.
			const exclusion = ownProp(ctx.memberExclusions, `${key}@${phpMember.kind}`) ?? ownProp(ctx.memberExclusions, key);
			if (!tsMember && exclusion) {
				status = "excluded";
				noteParts.push(exclusion.reason ?? "");
				if (exclusion.php_hash && phpMember.hash && exclusion.php_hash !== phpMember.hash) {
					noteParts.push("[STALE exclusion: upstream body changed]");
					ctx.staleKeys.push(key);
				}
			}

			let implStatus = "";
			if (status === "both") {
				const reviewable = REVIEWABLE_KINDS.has(phpMember.kind) && phpMember.hash !== null && tsMember.hash !== null;
				if (!reviewable) {
					implStatus = "n/a";
				} else {
					const approval = ownProp(ctx.approvals, key);
					if (!approval) {
						implStatus = "unreviewed";
						fileRow.impl_unreviewed++;
					} else if (approval.php_hash === phpMember.hash && approval.ts_hash === tsMember.hash) {
						implStatus = "approved";
						fileRow.impl_approved++;
					} else {
						implStatus = "stale";
						fileRow.impl_stale++;
						ctx.staleKeys.push(key);
					}
				}
			}

			if (status === "both") fileRow.members_both++;
			if (status === "missing_in_port") fileRow.members_missing_in_port++;
			if (phpMember.visibility !== "private" && phpMember.origin === "self") {
				if (status === "both") phpPublicProtected.both++;
				if (status === "missing_in_port") phpPublicProtected.missing++;
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
				php_static: phpMember.static ? "static" : "",
				ts_visibility: tsMember?.visibility ?? "",
				ts_static: tsMember ? (tsMember.static ? "static" : "") : "",
				impl_status: implStatus,
				vendor_deps: (phpMember.vendorDeps ?? []).join(";"),
				php_line: phpMember.lines?.[0] ?? "",
				ts_line: tsMember?.lines?.[0] ?? "",
				php_hash: phpMember.hash ?? "",
				ts_hash: tsMember?.hash ?? "",
				note: noteParts.filter(Boolean).join(" "),
			});
		}
	}

	// Port members with no upstream counterpart inside a matched pair.
	for (const tsDecl of tsData.declarations) {
		const used = consumed.get(tsDecl.name) ?? new Set();
		for (const tsMember of tsDecl.members) {
			if (used.has(tsMember.name)) continue;
			fileRow.members_extra_in_port++;
			memberRows.push({
				component: fileRow.component,
				laravel_path: pair.phpPath,
				declaration: tsDecl.name,
				member: tsMember.name,
				kind: tsMember.kind,
				status: "extra_in_port",
				origin: "self",
				php_visibility: "",
				php_static: "",
				ts_visibility: tsMember.visibility,
				ts_static: tsMember.static ? "static" : "",
				impl_status: "",
				vendor_deps: "",
				php_line: "",
				ts_line: tsMember.lines?.[0] ?? "",
				php_hash: "",
				ts_hash: tsMember.hash ?? "",
				note: "",
			});
		}
	}

	const denominator = phpPublicProtected.both + phpPublicProtected.missing;
	if (denominator > 0) {
		fileRow.parity_pct = String(Math.round((phpPublicProtected.both / denominator) * 100));
	}
}

function summarize(fileRows) {
	const byComponent = new Map();
	for (const row of fileRows) {
		let entry = byComponent.get(row.component);
		if (!entry) {
			entry = {
				component: row.component,
				files: 0,
				matched: 0,
				excluded: 0,
				missing: 0,
				extra: 0,
				members_both: 0,
				members_missing: 0,
				approved: 0,
				stale: 0,
				unreviewed: 0,
			};
			byComponent.set(row.component, entry);
		}
		entry.files++;
		if (row.status === "matched" || row.status === "renamed") entry.matched++;
		if (row.status === "excluded") entry.excluded++;
		if (row.status === "missing_in_port") entry.missing++;
		if (row.status === "extra_in_port") entry.extra++;
		entry.members_both += row.members_both;
		entry.members_missing += row.members_missing_in_port;
		entry.approved += row.impl_approved;
		entry.stale += row.impl_stale;
		entry.unreviewed += row.impl_unreviewed;
	}
	return [...byComponent.values()].sort((a, b) => a.component.localeCompare(b.component));
}

export function toCsv(rows, columns) {
	const escape = (value) => {
		const text = String(value ?? "");
		return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	};
	const lines = [columns.join(",")];
	for (const row of rows) {
		lines.push(columns.map((column) => escape(row[column])).join(","));
	}

	// BOM so Excel picks UTF-8 instead of the ANSI codepage.
	return "\uFEFF" + lines.join("\n") + "\n";
}

export function summaryText(summary, upstreamVersion) {
	const lines = [];
	lines.push(`# Parity summary`);
	lines.push("");
	lines.push(`Reference: laravel/framework ${upstreamVersion}`);
	lines.push("");
	lines.push("| Component | Files | Matched | Excluded | Missing | Extra | Member parity | Approved | Stale | Unreviewed |");
	lines.push("|---|---|---|---|---|---|---|---|---|---|");
	let totals = { files: 0, matched: 0, excluded: 0, missing: 0, extra: 0, both: 0, missingMembers: 0, approved: 0, stale: 0, unreviewed: 0 };
	for (const entry of summary) {
		const denominator = entry.members_both + entry.members_missing;
		const parity = denominator > 0 ? `${Math.round((entry.members_both / denominator) * 100)}%` : "-";
		lines.push(
			`| ${entry.component} | ${entry.files} | ${entry.matched} | ${entry.excluded} | ${entry.missing} | ${entry.extra} | ${parity} | ${entry.approved} | ${entry.stale} | ${entry.unreviewed} |`,
		);
		totals.files += entry.files;
		totals.matched += entry.matched;
		totals.excluded += entry.excluded;
		totals.missing += entry.missing;
		totals.extra += entry.extra;
		totals.both += entry.members_both;
		totals.missingMembers += entry.members_missing;
		totals.approved += entry.approved;
		totals.stale += entry.stale;
		totals.unreviewed += entry.unreviewed;
	}
	const totalDenominator = totals.both + totals.missingMembers;
	const totalParity = totalDenominator > 0 ? `${Math.round((totals.both / totalDenominator) * 100)}%` : "-";
	lines.push(
		`| **Total** | ${totals.files} | ${totals.matched} | ${totals.excluded} | ${totals.missing} | ${totals.extra} | ${totalParity} | ${totals.approved} | ${totals.stale} | ${totals.unreviewed} |`,
	);
	return lines.join("\n") + "\n";
}

export const FILE_COLUMNS = [
	"component",
	"status",
	"laravel_path",
	"port_path",
	"laravel_kinds",
	"laravel_members",
	"port_members",
	"members_both",
	"members_missing_in_port",
	"members_extra_in_port",
	"parity_pct",
	"impl_approved",
	"impl_stale",
	"impl_unreviewed",
	"note",
];

export const MEMBER_COLUMNS = [
	"component",
	"laravel_path",
	"declaration",
	"member",
	"kind",
	"status",
	"origin",
	"php_visibility",
	"php_static",
	"ts_visibility",
	"ts_static",
	"impl_status",
	"vendor_deps",
	"php_line",
	"ts_line",
	"php_hash",
	"ts_hash",
	"note",
];
