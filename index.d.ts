// Not a real barrel -- consumers deep-import (`@larablox/framework/out/Illuminate/...`).
//
// This file exists because roblox-ts will not resolve a scoped deep import
// unless the scope directory is listed in the consumer's `typeRoots`, and
// listing it makes TypeScript try to load every package under
// `node_modules/@larablox` as an implicit global type library -- which fails
// unless the package has a `types` entry pointing somewhere.
//
// `@larablox/monolog` satisfies the same scan with a generated `out/index.d.ts`.
// This one is checked in because there is nothing to generate it from -- the
// package has no barrel, only the per-module declarations `declaration: true`
// emits beside the Luau in `out/Illuminate`. See `CLAUDE.md`.
export {};
