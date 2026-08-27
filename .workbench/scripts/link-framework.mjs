// Point `node_modules/@larablox/framework` at the framework being developed in
// the repository above, so that editing `src/` there and rebuilding is
// immediately visible here.
//
// This is deliberately not an npm `file:..` dependency. That symlinks the whole
// repository, and the repository contains this workbench -- so every file here
// becomes reachable as
// `node_modules/@larablox/framework/.workbench/src/...` and TypeScript starts
// resolving the workbench's own modules through the link. Linking `out/` alone
// has no such cycle: `out/` does not contain the workbench.
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const workbench = resolve(here, "..");
const framework = resolve(workbench, "..");

const built = join(framework, "out");

// A junction cannot be made to a directory that is not there, and on a fresh
// clone `out/` is not: it is a build artifact.
if (!existsSync(built)) {
    console.error(
        `No build to link: ${built} does not exist.\n` +
            "Run `npm run build` in the repository root first.",
    );

    process.exit(1);
}

const target = join(workbench, "node_modules", "@larablox", "framework");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

// A stub manifest: `typeRoots` lists `node_modules/@larablox`, which makes
// TypeScript load every package under it as an implicit type library, and that
// needs `types` to point somewhere. Same reason the real package ships a
// checked-in `index.d.ts`.
writeFileSync(
    join(target, "package.json"),
    `${JSON.stringify(
        {
            name: "@larablox/framework",
            version: "0.0.0-workbench",
            types: "index.d.ts",
        },
        undefined,
        4,
    )}\n`,
);

copyFileSync(join(framework, "index.d.ts"), join(target, "index.d.ts"));

// "junction" is the only symlink kind Windows grants without elevation; it is
// ignored on POSIX, where a plain directory symlink is made instead.
symlinkSync(built, join(target, "out"), "junction");

console.log(`linked @larablox/framework -> ${built}`);
