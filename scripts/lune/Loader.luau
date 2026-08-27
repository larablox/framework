--!nolint
--[[
	Loads compiled roblox-ts modules outside a DataModel.

	Two things stand between `out-tests/` and Lune. A compiled module opens with
	`local TS = _G[script]` and reaches its imports through `TS.import(script,
	...)`, so it needs a `script` of its own and a shared `_G` -- neither of
	which a plain `require` can hand it. That is what `luau.load`'s
	`environment` is for here.

	The second is `RuntimeLib` itself, and the decision worth stating: it is
	**not** reimplemented. The real one is loaded through this same mechanism,
	with `game` and `require` shimmed underneath it, so import resolution,
	circular-dependency detection and `TS.try`/`TS.generator`/`TS.async` are
	the compiler's own code rather than our reading of it. The only thing this
	file knows about roblox-ts is where the file lives.
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")

local Globals = require("./Globals")
local Tree = require("./Tree")

local Loader = {}

--[[
	The tree `test.project.json` mounts, rebuilt. Kept deliberately parallel to
	that file: a mount added there has to be added here too, and the two
	drifting apart is a run that passes on a tree Studio never sees.
]]
local function buildTree(root: string): any
	local replicatedStorage = Tree.folder("ReplicatedStorage", nil)

	Tree.attach(replicatedStorage, Tree.fromDirectory("Illuminate", root .. "/out-tests/src/Illuminate"))
	Tree.attach(replicatedStorage, Tree.fromDirectory("IlluminateTests", root .. "/out-tests/tests/Illuminate"))

	local nodeModules = Tree.attach(replicatedStorage, Tree.folder("node_modules", nil))
	Tree.attach(nodeModules, Tree.fromDirectory("@rbxts", root .. "/node_modules/@rbxts"))
	Tree.attach(nodeModules, Tree.fromDirectory("@larablox", root .. "/node_modules/@larablox"))

	local include = Tree.attach(
		replicatedStorage,
		Tree.fromDirectory("rbxts_include", root .. "/node_modules/roblox-ts/include")
	)
	local includeModules = Tree.attach(include, Tree.folder("node_modules", nil))
	Tree.attach(includeModules, Tree.fromDirectory("@rbxts", root .. "/node_modules/@rbxts"))

	return replicatedStorage
end

--[[ Open a place: a tree, a shared `_G`, and the runtime that goes in it. ]]
function Loader.open(root: string): any
	local replicatedStorage = buildTree(root)
	local globals = Globals.build(replicatedStorage)

	local sharedG = {}
	local loaded: { [any]: { value: any } } = {}
	local requireNode: (any) -> any

	function requireNode(node: any): any
		local cached = loaded[node]
		if cached then
			return cached.value
		end

		local file = rawget(node, "_file")
		if file == nil then
			error(`attempt to require {node:GetFullName()}, which is a {node.ClassName}`, 2)
		end

		local environment: { [string]: any } = {}
		for key, value in globals do
			environment[key] = value
		end
		environment.script = node
		environment._G = sharedG
		environment.require = requireNode

		local chunk = luau.load(fs.readFile(file), {
			debugName = file,
			environment = environment,
			injectGlobals = true,
		})

		local value = chunk()
		loaded[node] = { value = value }
		return value
	end

	local runtime = requireNode(replicatedStorage.rbxts_include.RuntimeLib)

	return {
		ReplicatedStorage = replicatedStorage,
		TS = runtime,
		require = requireNode,
	}
end

return Loader
