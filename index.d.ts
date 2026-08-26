// Not a real barrel -- consumers deep-import (`@larablox/framework/out/Illuminate/...`).
//
// This file exists because roblox-ts will not resolve a scoped deep import
// unless the scope directory is listed in the consumer's `typeRoots`, and
// listing it makes TypeScript try to load every package under
// `node_modules/@larablox` as an implicit global type library -- which fails
// unless the package has a `types` entry pointing somewhere.
//
// `@larablox/monolog` satisfies the same scan with a generated `out/index.d.ts`.
// This one is checked in rather than generated, because `declaration` is off
// here: turning it on makes `rbxtsc` fail with TS4094 on every mixin, which is
// the trait pattern the whole port is built on. See `CLAUDE.md`.
export {};
