# Vendored TestEZ core

`node_modules/@rbxts/testez`'s runtime (`src/*.lua`) uses Roblox's
Instance-based `require(script.Parent.X)` to resolve its own internal
modules. Lune's `require()` only resolves plain string paths -- there is no
`script` global, and passing an Instance to `require()` fails outright
(confirmed empirically: `bad argument #1 to 'require' (string expected, got
userdata)`). Loading `@rbxts/testez` unmodified under Lune isn't possible.

These files are `@rbxts/testez@0.4.2-ts.0`'s `TestEnum`, `Expectation`,
`Context`, `ExpectationContext`, `TestPlan`, `TestPlanner`, `TestSession`,
`TestResults`, `TestRunner` and `LifecycleHooks` -- copied verbatim (Apache
2.0, https://github.com/roblox-ts/testez) except every `require(script.Parent.X)`
rewritten to `require("./X")`. Nothing else changed; update these alongside
any future `@rbxts/testez` version bump.

Not vendored, deliberately: `TestBootstrap` (scans an Instance tree for
`.spec` ModuleScripts -- `scripts/lune/RunTests.luau` builds its module list
by walking `out-tests/` on disk instead) and the `Reporters/` (`TextReporter`
calls `game:GetService("TestService")`, unavailable outside Roblox --
`RunTests.luau` has its own).
