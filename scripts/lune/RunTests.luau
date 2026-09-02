--[[
	Runs every *.spec.luau under out-tests/ through the vendored TestEZ core
	(scripts/lune/testez/ -- see its README for why @rbxts/testez's own
	files can't be required as-is under Lune) and prints the results.

	Bypasses TestEZ's own TestBootstrap:run(), which discovers specs by
	walking a real Roblox Instance tree (root:GetDescendants(), then
	require(moduleScriptInstance)) -- Lune has neither: no DataModel, and
	its own require() rejects an Instance outright. TestPlanner.createPlan()
	is the lower-level entry point TestBootstrap itself is built on, and it
	only wants a plain list of {method, path, pathStringForSorting} -- exactly
	what walking out-tests/ on disk can build by hand.

	Run from the project root: `lune run scripts/lune/RunTests`.
]]

local fs = require("@lune/fs")
local process = require("@lune/process")

local TestPlanner = require("./testez/TestPlanner")
local TestRunner = require("./testez/TestRunner")
local TestEnum = require("./testez/TestEnum")

local OUT_TESTS = "out-tests"

local function stripSpecSuffix(name)
	return (name:gsub("%.spec$", ""))
end

-- Finds every *.spec.luau under `dir`, returning {diskPath, pathSegments}
-- pairs -- pathSegments is the directory chain (leaf first) TestPlan uses to
-- build nested describe() groups purely from where a spec sits on disk,
-- mirroring how Roblox/testez's own getPath() reads it from the Instance
-- tree instead.
local function findSpecs(dir, segments, found)
	segments = segments or {}
	found = found or {}

	for _, name in fs.readDir(dir) do
		local fullPath = dir .. "/" .. name
		if fs.isDir(fullPath) then
			local nextSegments = table.clone(segments)
			table.insert(nextSegments, 1, name)
			findSpecs(fullPath, nextSegments, found)
		elseif name:match("%.spec%.luau$") then
			local leaf = stripSpecSuffix((name:gsub("%.luau$", "")))
			local pathSegments = table.clone(segments)
			table.insert(pathSegments, 1, leaf)
			table.insert(found, { diskPath = fullPath, pathSegments = pathSegments })
		end
	end

	return found
end

local specs = findSpecs(OUT_TESTS)

local modulesList = {}
for _, spec in specs do
	-- require() is relative to *this* script, not the process cwd fs.*
	-- uses -- this script lives at scripts/lune/, two levels below the
	-- project root that out-tests/ sits in.
	local relativePath = "../../" .. spec.diskPath:gsub("%.luau$", "")
	local method = require(relativePath)

	table.insert(modulesList, {
		method = method,
		path = spec.pathSegments,
		pathStringForSorting = table.concat(spec.pathSegments, " "):lower(),
	})
end

local plan = TestPlanner.createPlan(modulesList, nil, {})
local results = TestRunner.runPlan(plan)

local INDENT = "   "
local STATUS_SYMBOLS = {
	[TestEnum.TestStatus.Success] = "+",
	[TestEnum.TestStatus.Failure] = "-",
	[TestEnum.TestStatus.Skipped] = "~",
}

local function report(node, level)
	level = level or 0
	if node.status == TestEnum.TestStatus.Skipped then
		return
	end

	if node.planNode.type == TestEnum.NodeType.It then
		local symbol = STATUS_SYMBOLS[node.status] or "?"
		print(INDENT:rep(level) .. ("[%s] %s"):format(symbol, node.planNode.phrase))
		for _, message in node.errors do
			print(INDENT:rep(level + 1) .. message)
		end
	else
		print(INDENT:rep(level) .. node.planNode.phrase)
		for _, child in node.children do
			report(child, level + 1)
		end
	end
end

for _, child in results.children do
	report(child)
end

print("")
print(("%d passed, %d failed, %d skipped"):format(results.successCount, results.failureCount, results.skippedCount))

if results.failureCount > 0 or #results.errors > 0 then
	process.exit(1)
end
