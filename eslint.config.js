import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import robloxTs from "eslint-plugin-roblox-ts";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
	{
		// `index.d.ts` is hand-written and belongs to no tsconfig project --
		// it exists only to satisfy a consumer's implicit type-library scan.
		ignores: [
			"out/**",
			"out-tests/**",
			"index.d.ts",
			".workbench/out/**",
			".workbench/include/**",
		],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2018,
				sourceType: "module",
				project: [
					"./tsconfig.json",
					"./tsconfig.tests.json",
					"./.workbench/tsconfig.json",
				],
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

			// Imports go through `baseUrl`, never relatively. In the framework
			// that is simply the convention; in a game it is load-bearing.
			// `server/`, `client/` and `shared/` are separate DataModel
			// locations, and roblox-ts emits a hard service path for each --
			// so a client file reaching into server code compiles and then
			// fails at run time, because `ServerScriptService` is not
			// replicated. Written absolutely, the crossing is visible on the
			// import line; hidden behind `../../`, it is not.
			"no-restricted-imports": [
				"warn",
				{
					patterns: [
						{
							group: ["./*", "../*"],
							message:
								"Import through baseUrl (`Illuminate/...`, `server/...`, `client/...`) rather than relatively.",
						},
					],
				},
			],
		},
	},
	{
		// The specs are exempt because there is no absolute path for them to
		// use: `tsconfig.tests.json` sets `baseUrl` to `src`, and a spec's
		// helpers live under `tests/`. `rootDirs` merges the two for output and
		// for relative resolution across them, which is what a spec reaching
		// for `../TestHelpers` is relying on -- baseUrl would look under `src`
		// and find nothing.
		files: ["tests/**/*.ts"],
		rules: {
			"no-restricted-imports": "off",
		},
	},
];
