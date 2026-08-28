// Parity runner: extracts both surfaces, compares them, writes the CSV
// report, and manages the review registries (approvals/exclusions).
//
//   npm run parity                          full run, writes reports/parity/
//   npm run parity -- --component Queue     limit the report to one component
//   npm run parity -- --approve "<key>"     mark one member as reviewed
//   npm run parity -- --approve-file "<laravel_path>"
//   npm run parity -- --revoke "<key>"
//   npm run parity -- --exclude "<key>" --reason "..."
//   npm run parity -- --list stale|unreviewed [--component X]
//   npm run parity -- --show "<key>"        print both bodies side by side
//   npm run parity -- --check               exit 1 when anything went stale
//
// A key is `laravel_path#Declaration#member`, e.g. "Queue/Worker.php#Worker#daemon".

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FILE_COLUMNS, MEMBER_COLUMNS, compare, memberKey, summaryText, toCsv } from "./compare.mjs";
import { extractTs } from "./extract-ts.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..", "..");
const upstreamDir = join(root, ".upstream");
const upstreamSrc = join(upstreamDir, "vendor", "laravel", "framework", "src", "Illuminate");
const vendorRoot = join(upstreamDir, "vendor");
const portSrc = join(root, "src", "Illuminate");
const reportsDir = join(root, "reports", "parity");
const aliasesPath = join(scriptDir, "aliases.json");
const exclusionsPath = join(scriptDir, "exclusions.json");
const approvalsPath = join(scriptDir, "approvals.json");

function fail(message) {
	console.error(message);
	process.exit(1);
}

function parseArgs(argv) {
	const args = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith("--")) {
			const name = arg.slice(2);
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("--")) {
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

function readJson(path, fallback) {
	if (!existsSync(path)) return fallback;
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonSorted(path, value) {
	const sorted = Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
	writeFileSync(path, JSON.stringify(sorted, null, 4) + "\n");
}

function upstreamVersion() {
	try {
		const lock = JSON.parse(readFileSync(join(upstreamDir, "composer.lock"), "utf8"));
		return lock.packages.find((entry) => entry.name === "laravel/framework")?.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

function ensureUpstream() {
	if (existsSync(upstreamSrc)) return;
	console.error("Upstream checkout missing; running composer install in .upstream ...");
	const result = spawnSync("composer", ["install", "--no-scripts", "--no-plugins", "--ignore-platform-reqs", "--no-interaction"], {
		cwd: upstreamDir,
		shell: true,
		stdio: "inherit",
	});
	if (result.error || result.status !== 0) {
		fail("composer install failed. Install composer (getcomposer.org) and make sure it is in PATH.");
	}
	if (!existsSync(upstreamSrc)) {
		fail(`composer install ran but ${upstreamSrc} still does not exist.`);
	}
}

function extractPhp() {
	const outPath = join(reportsDir, "php.json");
	const result = spawnSync("php", [join(scriptDir, "extract-php.php"), upstreamSrc, vendorRoot, outPath], {
		encoding: "utf8",
	});
	if (result.error) {
		fail("php not found in PATH; the parity extractor needs the PHP CLI.");
	}
	if (result.status !== 0) {
		fail(`extract-php.php failed:\n${result.stderr || result.stdout}`);
	}
	return JSON.parse(readFileSync(outPath, "utf8"));
}

function findPhpMember(php, key) {
	const [path, declName, memberName] = key.split("#");
	const decl = php.files[path]?.declarations.find((d) => d.name === declName);
	const member = decl?.members.find((m) => m.name === memberName);
	return member ? { path, decl, member } : null;
}

function findTsMember(php, ts, aliases, key) {
	const [phpPath, declName, phpMemberName] = key.split("#");
	const direct = phpPath.replace(/\.php$/, ".ts");
	const tsPath = ts.files[direct] ? direct : (aliases.files ?? {})[phpPath];
	const tsData = tsPath ? ts.files[tsPath] : null;
	if (!tsData) return null;
	const classLike = tsData.declarations.filter((d) => d.kind !== "functions");
	const tsDecl =
		tsData.declarations.find((d) => d.name === declName) ?? (declName === "(functions)" ? null : classLike.length === 1 ? classLike[0] : null);
	if (!tsDecl) return null;
	const normalized = phpMemberName === "__construct" ? "constructor" : phpMemberName;
	const memberAliases = (aliases.members ?? {})[phpPath] ?? {};
	const ownProp = (object, key) => (Object.hasOwn(object, key) ? object[key] : undefined);
	const tsName = ownProp(memberAliases, phpMemberName) ?? ownProp(memberAliases, normalized) ?? normalized;
	const member = tsDecl.members.find((m) => m.name === tsName);
	return member ? { path: tsPath, decl: tsDecl, member } : null;
}

function printSlice(label, absolutePath, lines) {
	console.log(`--- ${label} (${absolutePath}:${lines ? lines[0] : "?"}) ---`);
	if (!existsSync(absolutePath) || !lines) {
		console.log("(source unavailable)");
		return;
	}
	const content = readFileSync(absolutePath, "utf8").split(/\r?\n/);
	console.log(content.slice(lines[0] - 1, lines[1]).join("\n"));
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const component = typeof args.component === "string" ? args.component : undefined;

	ensureUpstream();
	mkdirSync(reportsDir, { recursive: true });

	const php = extractPhp();
	const ts = extractTs(portSrc);
	writeFileSync(join(reportsDir, "ts.json"), JSON.stringify(ts));

	const aliases = readJson(aliasesPath, { files: {}, members: {} });
	const exclusions = readJson(exclusionsPath, { paths: [], members: {} });
	const approvals = readJson(approvalsPath, {});

	let result = compare({ php, ts, aliases, exclusions, approvals, component });

	// ---- registry commands ------------------------------------------------
	let registriesChanged = false;
	const approvableRows = () =>
		result.memberRows.filter((row) => row.status === "both" && row.php_hash !== "" && row.ts_hash !== "" && row.impl_status !== "n/a");

	if (typeof args.approve === "string") {
		const row = approvableRows().find((r) => memberKey(r.laravel_path, r.declaration, r.member) === args.approve);
		if (!row) fail(`No reviewable member found for key: ${args.approve}`);
		approvals[args.approve] = { php_hash: row.php_hash, ts_hash: row.ts_hash, approved_at: new Date().toISOString().slice(0, 10) };
		registriesChanged = true;
		console.log(`approved: ${args.approve}`);
	}

	if (typeof args["approve-file"] === "string") {
		const rows = approvableRows().filter((r) => r.laravel_path === args["approve-file"]);
		if (rows.length === 0) fail(`No reviewable members found in pair: ${args["approve-file"]}`);
		for (const row of rows) {
			const key = memberKey(row.laravel_path, row.declaration, row.member);
			approvals[key] = { php_hash: row.php_hash, ts_hash: row.ts_hash, approved_at: new Date().toISOString().slice(0, 10) };
			console.log(`approved: ${key}`);
		}
		registriesChanged = true;
	}

	if (typeof args.revoke === "string") {
		if (!approvals[args.revoke]) fail(`No approval recorded for key: ${args.revoke}`);
		delete approvals[args.revoke];
		registriesChanged = true;
		console.log(`revoked: ${args.revoke}`);
	}

	if (typeof args.exclude === "string") {
		if (typeof args.reason !== "string") fail("--exclude needs --reason \"...\"");
		const found = findPhpMember(php, args.exclude);
		if (!found) fail(`No upstream member found for key: ${args.exclude}`);
		exclusions.members ??= {};
		exclusions.members[args.exclude] = { php_hash: found.member.hash ?? null, reason: args.reason };
		writeJsonSorted(exclusionsPath, { paths: exclusions.paths ?? [], members: exclusions.members });
		registriesChanged = true;
		console.log(`excluded: ${args.exclude}`);
	}

	if (registriesChanged) {
		writeJsonSorted(approvalsPath, approvals);
		result = compare({ php, ts, aliases, exclusions, approvals, component });
	}

	// ---- reports ----------------------------------------------------------
	writeFileSync(join(reportsDir, "files.csv"), toCsv(result.fileRows, FILE_COLUMNS));
	writeFileSync(join(reportsDir, "members.csv"), toCsv(result.memberRows, MEMBER_COLUMNS));
	const summary = summaryText(result.summary, upstreamVersion());
	writeFileSync(join(reportsDir, "summary.md"), summary);

	// ---- query commands ---------------------------------------------------
	if (typeof args.list === "string") {
		const wanted = args.list;
		if (wanted !== "stale" && wanted !== "unreviewed") fail("--list takes 'stale' or 'unreviewed'");
		const rows = result.memberRows.filter((row) => row.impl_status === wanted || (wanted === "stale" && row.note.includes("STALE exclusion")));
		for (const row of rows) {
			console.log(memberKey(row.laravel_path, row.declaration, row.member));
		}
		console.log(`${rows.length} ${wanted} member(s)`);
		return;
	}

	if (typeof args.show === "string") {
		const phpFound = findPhpMember(php, args.show);
		if (!phpFound) fail(`No upstream member found for key: ${args.show}`);
		const phpFile = phpFound.member.file ? join(vendorRoot, phpFound.member.file) : join(upstreamSrc, phpFound.path);
		printSlice("laravel", phpFile, phpFound.member.lines);
		const tsFound = findTsMember(php, ts, aliases, args.show);
		if (tsFound) {
			printSlice("port", join(portSrc, tsFound.path), tsFound.member.lines);
		} else {
			console.log("--- port ---\n(no counterpart)");
		}
		return;
	}

	process.stdout.write("\n" + summary + "\n");
	console.log(`reports: ${join("reports", "parity")}${component ? ` (component: ${component})` : ""}`);

	if (args.check) {
		if (result.staleKeys.length > 0) {
			console.error(`\nSTALE (${result.staleKeys.length}):`);
			for (const key of result.staleKeys) console.error(`  ${key}`);
			process.exit(1);
		}
		console.log("check: nothing stale");
	}
}

main();
