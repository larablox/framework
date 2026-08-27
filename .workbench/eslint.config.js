import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import robloxTs from "eslint-plugin-roblox-ts";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/**
 * The workbench lints itself.
 *
 * It is a separate npm project, and CI installs only the framework -- so a
 * runner has no `.workbench/node_modules`, and linting this from the root
 * config fails on every import with "Scope @larablox is declared in typeRoots
 * but was not found", plus whatever `lua-truthiness` reports once every
 * framework type has degraded to `any`. Gating the package's CI on a scratch
 * consumer would be the wrong trade anyway.
 *
 * The rules are the framework's, spelled out rather than mapped over its
 * config: only the TypeScript project differs, and a transform would be harder
 * to read than the six lines it saves. The plugins resolve out of the
 * repository's `node_modules` one directory up, which is why this needs no
 * dependencies of its own -- run it as `npm run workbench:lint` from the root.
 */
export default [
	{
		ignores: ["out/**", "include/**"],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2018,
				sourceType: "module",
				project: ["./tsconfig.json"],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
			"roblox-ts": robloxTs,
			prettier: prettierPlugin,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			...robloxTs.configs.recommended.rules,
			...prettierConfig.rules,
			"prettier/prettier": "warn",

			// The framework's rule, and this is the project it was written for:
			// `server/`, `client/` and `shared/` are separate DataModel
			// locations, and roblox-ts emits a hard service path for each -- so
			// a client file reaching into server code compiles and then fails
			// at run time, because `ServerScriptService` is not replicated.
			// Written absolutely, the crossing is visible on the import line.
			"no-restricted-imports": [
				"warn",
				{
					patterns: [
						{
							group: ["./*", "../*"],
							message:
								"Import through baseUrl (`server/...`, `client/...`, `shared/...`) rather than relatively.",
						},
					],
				},
			],
		},
	},
];
