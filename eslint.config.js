import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import robloxTs from "eslint-plugin-roblox-ts";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
	{
		ignores: ["out/**", "out-tests/**"],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2018,
				sourceType: "module",
				project: ["./tsconfig.json", "./tsconfig.tests.json"],
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
		},
	},
];
