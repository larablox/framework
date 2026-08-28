// Extracts the class surface of src/Illuminate into the same JSON shape the
// PHP extractor produces, using the TypeScript compiler API (parse only, no
// type checking).

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const printer = ts.createPrinter({ removeComments: true });

function sha1(text) {
	return createHash("sha1").update(text).digest("hex");
}

function hashNode(node, sourceFile) {
	const printed = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
	return sha1(printed.replace(/\s+/g, " ").trim());
}

function listFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...listFiles(full));
		} else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
			out.push(full);
		}
	}
	return out.sort();
}

function visibilityOf(node) {
	const flags = ts.getCombinedModifierFlags(node);
	if (flags & ts.ModifierFlags.Private) return "private";
	if (flags & ts.ModifierFlags.Protected) return "protected";
	return "public";
}

function isStatic(node) {
	return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) !== 0;
}

function isAbstract(node) {
	return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Abstract) !== 0;
}

function memberName(node) {
	const name = node.name;
	if (!name) return null;
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) {
		return name.text;
	}
	return null; // computed name
}

function lineSpan(node, sourceFile) {
	const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
	const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
	return [start, end];
}

// `XPublicShape` and `XShape` mirror the mixin factory `X`; all three merge
// into one declaration named `X`, comparable to the PHP trait.
function baseName(name) {
	return name.replace(/(Public)?Shape$/, "");
}

/** One merge group: the member sink for a declaration and its Shape mirrors. */
function freshGroup(name, kind, abstract) {
	return { name, kind, abstract, heritage: [], mergedFrom: [], sink: new Map(), accessors: new Map() };
}

function addMember(sink, member) {
	const existing = sink.get(member.name);
	if (existing && existing.hash !== null && member.hash === null) {
		return; // keep the implementation over a Shape mirror
	}
	if (existing && existing.hash === null && member.hash === null && existing.kind === member.kind) {
		return; // first declaration wins between equals
	}
	sink.set(member.name, member);
}

function collectClassMembers(node, sourceFile, group) {
	for (const member of node.members ?? []) {
		if (ts.isConstructorDeclaration(member)) {
			for (const param of member.parameters) {
				const flags = ts.getCombinedModifierFlags(param);
				const paramVisibility =
					flags & ts.ModifierFlags.Private
						? "private"
						: flags & ts.ModifierFlags.Protected
							? "protected"
							: flags & (ts.ModifierFlags.Public | ts.ModifierFlags.Readonly)
								? "public"
								: null;
				if (paramVisibility !== null && ts.isIdentifier(param.name)) {
					addMember(group.sink, {
						name: param.name.text,
						kind: "property",
						visibility: paramVisibility,
						static: false,
						abstract: false,
						declaration: group.name,
						hash: null,
						lines: lineSpan(param, sourceFile),
					});
				}
			}
			addMember(group.sink, {
				name: "constructor",
				kind: "method",
				visibility: visibilityOf(member),
				static: false,
				abstract: false,
				declaration: group.name,
				hash: member.body ? hashNode(member, sourceFile) : null,
				lines: lineSpan(member, sourceFile),
			});
			continue;
		}

		const name = memberName(member);
		if (name === null) continue;

		if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
			addMember(group.sink, {
				name,
				kind: "method",
				visibility: visibilityOf(member),
				static: isStatic(member),
				abstract: isAbstract(member) || ts.isMethodSignature(member),
				declaration: group.name,
				hash: member.body ? hashNode(member, sourceFile) : null,
				lines: lineSpan(member, sourceFile),
			});
		} else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
			addMember(group.sink, {
				name,
				kind: "property",
				visibility: visibilityOf(member),
				static: isStatic(member),
				abstract: false,
				declaration: group.name,
				hash: null,
				lines: lineSpan(member, sourceFile),
			});
		} else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
			const key = `${isStatic(member) ? "static:" : ""}${name}`;
			let slot = group.accessors.get(key);
			if (!slot) {
				slot = {
					name,
					static: isStatic(member),
					visibility: visibilityOf(member),
					get: null,
					set: null,
					lines: lineSpan(member, sourceFile),
				};
				group.accessors.set(key, slot);
			}
			const hash = member.body ? hashNode(member, sourceFile) : null;
			if (ts.isGetAccessorDeclaration(member)) slot.get = hash;
			else slot.set = hash;
		}
	}
}

function classExpressionsIn(node) {
	const found = [];
	const visit = (child) => {
		if (ts.isClassExpression(child) || ts.isClassDeclaration(child)) {
			found.push(child);
		}
		ts.forEachChild(child, visit);
	};
	ts.forEachChild(node, visit);
	return found;
}

function extractFile(sourceFile) {
	const declarations = [];
	const functionMembers = [];

	/** @type {Map<string, ReturnType<typeof freshGroup>>} */
	const groups = new Map();

	const groupFor = (rawName, kind, abstract) => {
		const name = baseName(rawName);
		let group = groups.get(name);
		if (!group) {
			group = freshGroup(name, kind, abstract);
			groups.set(name, group);
		} else if (group.kind === "shape" && kind !== "shape") {
			group.kind = kind;
			group.abstract = abstract;
		}
		group.mergedFrom.push(rawName);
		return group;
	};

	const handleClassLike = (node, rawName, kind) => {
		const group = groupFor(rawName, kind, ts.canHaveModifiers(node) ? isAbstract(node) : false);
		for (const clause of node.heritageClauses ?? []) {
			for (const type of clause.types) {
				const text = type.expression.getText(sourceFile);
				if (baseName(text) !== group.name && !group.heritage.includes(text)) {
					group.heritage.push(text);
				}
			}
		}
		collectClassMembers(node, sourceFile, group);
	};

	const walkStatements = (statements) => {
		for (const statement of statements) {
			if (ts.isClassDeclaration(statement) && statement.name) {
				const rawName = statement.name.text;
				const isShape = /(Public)?Shape$/.test(rawName) && baseName(rawName) !== rawName;
				handleClassLike(statement, rawName, isShape ? "shape" : "class");
			} else if (ts.isInterfaceDeclaration(statement)) {
				handleClassLike(statement, statement.name.text, "interface");
			} else if (ts.isEnumDeclaration(statement)) {
				const group = groupFor(statement.name.text, "enum", false);
				for (const member of statement.members) {
					const name = memberName(member);
					if (name !== null) {
						addMember(group.sink, {
							name,
							kind: "case",
							visibility: "public",
							static: false,
							abstract: false,
							declaration: group.name,
							hash: null,
							lines: lineSpan(member, sourceFile),
						});
					}
				}
			} else if (ts.isFunctionDeclaration(statement) && statement.name) {
				const classes = classExpressionsIn(statement);
				if (classes.length > 0) {
					// Mixin factory: its class expression carries the real bodies.
					const group = groupFor(statement.name.text, "mixin", false);
					for (const cls of classes) {
						collectClassMembers(cls, sourceFile, group);
					}
				} else {
					functionMembers.push({
						name: statement.name.text,
						kind: "function",
						visibility: "public",
						static: false,
						abstract: false,
						declaration: "(functions)",
						hash: statement.body ? hashNode(statement, sourceFile) : null,
						lines: lineSpan(statement, sourceFile),
					});
				}
			} else if (ts.isVariableStatement(statement)) {
				for (const decl of statement.declarationList.declarations) {
					if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
					if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
						functionMembers.push({
							name: decl.name.text,
							kind: "function",
							visibility: "public",
							static: false,
							abstract: false,
							declaration: "(functions)",
							hash: hashNode(decl.initializer, sourceFile),
							lines: lineSpan(decl, sourceFile),
						});
					} else if (ts.isClassExpression(decl.initializer)) {
						const group = groupFor(decl.name.text, "class", false);
						collectClassMembers(decl.initializer, sourceFile, group);
					}
				}
			} else if (ts.isModuleDeclaration(statement) && statement.body && ts.isModuleBlock(statement.body)) {
				walkStatements(statement.body.statements);
			}
		}
	};

	walkStatements(sourceFile.statements);

	for (const group of groups.values()) {
		for (const slot of group.accessors.values()) {
			addMember(group.sink, {
				name: slot.name,
				kind: "accessor",
				visibility: slot.visibility,
				static: slot.static,
				abstract: false,
				declaration: group.name,
				hash: slot.get === null && slot.set === null ? null : sha1(`${slot.get ?? ""}|${slot.set ?? ""}`),
				lines: slot.lines,
			});
		}
		declarations.push({
			name: group.name,
			kind: group.kind === "shape" ? "class" : group.kind,
			abstract: group.abstract,
			extends: group.heritage,
			implements: [],
			uses: [],
			notes: group.mergedFrom.length > 1 ? [`merged:${group.mergedFrom.join("+")}`] : [],
			members: [...group.sink.values()],
		});
	}

	if (functionMembers.length > 0) {
		declarations.push({
			name: "(functions)",
			kind: "functions",
			abstract: false,
			extends: [],
			implements: [],
			uses: [],
			notes: [],
			members: functionMembers,
		});
	}

	return { namespace: "", declarations };
}

export function extractTs(srcRoot) {
	const files = {};
	for (const path of listFiles(srcRoot)) {
		const relPath = relative(srcRoot, path).replaceAll("\\", "/");
		const text = readFileSync(path, "utf8");
		const sourceFile = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);
		files[relPath] = extractFile(sourceFile);
	}
	return { files };
}
