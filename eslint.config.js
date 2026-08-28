import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import stylistic from '@stylistic/eslint-plugin';
import robloxTs from 'eslint-plugin-roblox-ts';

export default [
    {
        // `index.d.ts` is hand-written and belongs to no tsconfig project --
        // it exists only to satisfy a consumer's implicit type-library scan.
        // `.workbench` is a separate npm project with its own dependencies, and
        // CI installs only this one -- so linting it from here fails on a
        // runner with "Scope @larablox ... was not found". It lints itself:
        // `.workbench/eslint.config.js`, or `npm run workbench:lint`.
        ignores: [
            'out/**',
            'out-tests/**',
            'index.d.ts',
            '.workbench/**',
            // The parity reference checkout and its generated reports are not
            // this project's code (`npm run parity`).
            '.upstream/**',
            'reports/**',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2018,
                sourceType: 'module',
                project: ['./tsconfig.json', './tsconfig.tests.json'],
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'roblox-ts': robloxTs,
            '@stylistic': stylistic,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...robloxTs.configs.recommended.rules,
            // Formatting itself is dprint's job (npm run lint:fix runs it);
            // eslint-config-prettier keeps the stylistic core rules out of
            // the way so the two do not fight.
            ...prettierConfig.rules,

            // dprint preserves authored line breaks but never invents them;
            // the array shape upstream writes is enforced here instead: two
            // or more elements go one per line (patterns are left alone --
            // pcall destructuring stays inline, as upstream tuples do not).
            '@stylistic/array-element-newline': ['warn', { ArrayExpression: 'always' }],
            '@stylistic/array-bracket-newline': ['warn', { multiline: true }],

            // Imports go through `baseUrl`, never relatively. In the framework
            // that is simply the convention; in a game it is load-bearing.
            // `server/`, `client/` and `shared/` are separate DataModel
            // locations, and roblox-ts emits a hard service path for each --
            // so a client file reaching into server code compiles and then
            // fails at run time, because `ServerScriptService` is not
            // replicated. Written absolutely, the crossing is visible on the
            // import line; hidden behind `../../`, it is not.
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            group: ['./*', '../*'],
                            message:
                                'Import through baseUrl (`Illuminate/...`, `server/...`, `client/...`) rather than relatively.',
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
        files: ['tests/**/*.ts'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
];
