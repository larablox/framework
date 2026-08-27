--!nolint
--[[
	The suite's entry point under Lune: the same specs, no Studio, no DataModel.

	What it gives up is stated once, here. Five spec files are about
	`DataStoreService` and `MemoryStoreService` and nothing else, and there is
	no honest way to run them outside Roblox -- a fake of those services would
	assert what we already believe about the platform, which is the mistake
	`agent_docs/testing.md` records under "a platform limit asserted instead of
	checked". They are skipped here and named in the report, so a green Lune
	run never reads as a green suite.

	Everything else -- planning, running, the PHPUnit-shaped report -- is what
	`scripts/studio/RunTests.server.luau` does, minus the overlapping: what
	that buys is removed latency on service calls, and there are no service
	calls left.

	Usage: `lune run scripts/lune/RunTests [filter]`
]]

local process = require("@lune/process")
local Loader = require("./Loader")

local COLUMNS = 63

--[[
	The spec files that wait on a Roblox service. The same five
	`RunTests.server.luau` overlaps, for the same reason they are the five: they
	are the ones that talk to the platform.
]]
local SKIPPED = {
	DataStoreFailedJobProvider = true,
	DataStoreStore = true,
	MemoryStoreQueue = true,
	MemoryStoreStore = true,
	Size = true,
}

local place = Loader.open(process.args[2] or ".")
local TS = place.TS
local ReplicatedStorage = place.ReplicatedStorage

local FRAMEWORK = ReplicatedStorage.Illuminate
local SPECS = ReplicatedStorage.IlluminateTests

local testez = ReplicatedStorage.rbxts_include.node_modules["@rbxts"].testez.src
local TestBootstrap = place.require(testez.TestBootstrap)
local TestEnum = place.require(testez.TestEnum)
local TestPlanner = place.require(testez.TestPlanner)
local TestRunner = place.require(testez.TestRunner)
local TestSession = place.require(testez.TestSession)

-- ---------------------------------------------------------------------
-- Selecting what to run
-- ---------------------------------------------------------------------

--[[ TestEZ builds `path` leaf-first; reversed it reads like the source tree. ]]
local function dottedPath(path)
	local parts = {}

	for index = #path, 1, -1 do
		table.insert(parts, path[index])
	end

	return table.concat(parts, ".")
end

local function comparable(text)
	return (text:gsub("[/\\]", "."):lower())
end

local function filterSegments(text)
	local filter = comparable(text):gsub("%.ts$", ""):gsub("%.spec$", "")
	local parts = {}

	for part in filter:gmatch("[^%.]+") do
		table.insert(parts, part)
	end

	return parts
end

--[[
	The longest suffix of the filter that names anything at all -- resolved once
	against the whole suite, not per spec. See `RunTests.server.luau` for why
	the difference matters.
]]
local function resolveNeedle(modules, segments)
	for start = 1, #segments do
		local candidate = table.concat(segments, ".", start)

		for _, module in ipairs(modules) do
			if string.find(comparable(dottedPath(module.path)), candidate, 1, true) ~= nil then
				return candidate
			end
		end
	end

	return nil
end

local function matching(modules, filter)
	if filter == "" then
		return modules
	end

	local needle = resolveNeedle(modules, filterSegments(filter))

	if needle == nil then
		return {}
	end

	local kept = {}

	for _, module in ipairs(modules) do
		if string.find(comparable(dottedPath(module.path)), needle, 1, true) ~= nil then
			table.insert(kept, module)
		end
	end

	return kept
end

-- ---------------------------------------------------------------------
-- Warm-up
-- ---------------------------------------------------------------------

--[[
	Same reason as in Studio: a compiled module gets its `_G[script]` only when
	reached through `TS.import`, and TestEZ requires plainly. The framework and
	the specs are two separately-compiled trees, so both need it.
]]
local function moduleScripts(root)
	local found = {}

	for _, instance in ipairs(root:GetDescendants()) do
		if instance:IsA("ModuleScript") then
			table.insert(found, instance)
		end
	end

	return found
end

local function warmUp()
	local trees = { FRAMEWORK, SPECS }
	local total = 0
	local startedAt = os.clock()

	for _, root in ipairs(trees) do
		for _, instance in ipairs(moduleScripts(root)) do
			total += 1

			local ok, err = pcall(function()
				return TS.import(root, instance)
			end)

			if not ok then
				print(("Failed to warm up %s: %s"):format(instance:GetFullName(), tostring(err)))
			end
		end
	end

	print(("Warmed up %d modules in %.1fs"):format(total, os.clock() - startedAt))
end

-- ---------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------

local Progress = {}
Progress.__index = Progress

function Progress.new(total)
	return setmetatable({ total = total, done = 0, row = {} }, Progress)
end

function Progress:flush()
	if #self.row == 0 then
		return
	end

	print(("%s%s  %d / %d (%3d%%)"):format(
		table.concat(self.row),
		string.rep(" ", COLUMNS - #self.row),
		self.done,
		self.total,
		math.min(math.floor(self.done / math.max(self.total, 1) * 100), 100)
	))

	self.row = {}
end

function Progress:mark(symbol)
	self.done += 1
	table.insert(self.row, symbol)

	if #self.row == COLUMNS then
		self:flush()
	end
end

--[[
	Report each leaf as it finishes. TestEZ offers no per-test hook, so the
	three `TestSession` methods that write an outcome are wrapped for the
	duration of the run; every session reaches them through `__index`.
]]
local function watch(progress)
	local original = {
		setSuccess = TestSession.setSuccess,
		setError = TestSession.setError,
		setSkipped = TestSession.setSkipped,
	}

	local function isLeaf(session)
		local node = session.nodeStack[#session.nodeStack]

		return node ~= nil
			and node.planNode ~= nil
			and node.planNode.type == TestEnum.NodeType.It
	end

	function TestSession:setSuccess()
		original.setSuccess(self)

		if isLeaf(self) then
			progress:mark(".")
		end
	end

	function TestSession:setError(message)
		original.setError(self, message)

		if isLeaf(self) then
			progress:mark("F")
		end
	end

	function TestSession:setSkipped()
		original.setSkipped(self)

		if isLeaf(self) then
			progress:mark("S")
		end
	end

	return function()
		TestSession.setSuccess = original.setSuccess
		TestSession.setError = original.setError
		TestSession.setSkipped = original.setSkipped
	end
end

-- ---------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------

local function fullPhrase(node)
	local parts = {}
	local current = node.planNode

	while current ~= nil and current.phrase ~= nil do
		table.insert(parts, 1, current.phrase)
		current = current.parent
	end

	return table.concat(parts, " > ")
end

--[[
	An `expect` failure names TestRunner, not the assertion that tripped, so the
	first spec frame of the traceback is carried along with the message.
]]
local function describeError(node)
	if node.errors[1] == nil then
		return "(no message)"
	end

	local text = tostring(node.errors[1])
	local message = string.match(text, "^[^\n]*") or "(no message)"

	local head, rest = string.match(message, "^([^:]+:%d+): (.*)$")

	if head ~= nil and string.find(head, "testez", 1, true) ~= nil then
		message = rest
	end

	local frame = string.match(text, "(IlluminateTests[%w%.]*spec:%d+)")

	if frame ~= nil and not string.find(message, frame, 1, true) then
		message = message .. "\n   " .. frame
	end

	return message
end

local function collectFailures(results)
	local failures = {}

	results:visitAllNodes(function(node)
		if
			node.status ~= TestEnum.TestStatus.Failure
			or node.planNode.type ~= TestEnum.NodeType.It
		then
			return
		end

		table.insert(failures, {
			phrase = fullPhrase(node),
			message = describeError(node),
		})
	end)

	table.sort(failures, function(first, second)
		return first.phrase < second.phrase
	end)

	return failures
end

local function report(results, elapsed, skipped)
	local failures = collectFailures(results)
	local total = results.successCount + results.failureCount + results.skippedCount

	print("")
	print(("Time: %.1fs"):format(elapsed))
	print("")

	if #failures == 0 then
		if results.skippedCount > 0 then
			print(("OK (%d tests, %d skipped)"):format(total, results.skippedCount))
		else
			print(("OK (%d tests)"):format(total))
		end

		if #skipped > 0 then
			print("")
			print(("%d spec files were not run -- they need a real Roblox service:"):format(#skipped))

			for _, name in ipairs(skipped) do
				print("   " .. name)
			end
		end

		return
	end

	if #failures == 1 then
		print("There was 1 failure:")
	else
		print(("There were %d failures:"):format(#failures))
	end

	for index, failure in ipairs(failures) do
		print("")
		print(("%d) %s"):format(index, failure.phrase))
		print("   " .. failure.message)
	end

	print("")
	print(("FAILURES!\nTests: %d, Failures: %d."):format(total, results.failureCount))

	process.exit(1)
end

-- ---------------------------------------------------------------------
-- Run
-- ---------------------------------------------------------------------

print("Larablox framework test suite (Lune)")
print("")

warmUp()

local filter = process.args[1] or ""
local available = TestBootstrap:getModules(SPECS)
local modules = {}
local skipped = {}

for _, module in ipairs(matching(available, filter)) do
	if SKIPPED[module.path[1]] then
		table.insert(skipped, dottedPath(module.path))
	else
		table.insert(modules, module)
	end
end

table.sort(skipped)

-- Reported and exited rather than raised: a filter that matched nothing is a
-- typo, not a crash, and Lune would print a traceback through this file that
-- says nothing about the typo. "OK (0 tests)" is not on offer either -- it
-- reads like good news.
if #modules == 0 then
	if filter == "" then
		print("No specs found.")
		process.exit(1)
	end

	-- Matched, but every match was service-backed. Saying "no spec matched"
	-- here sends the reader looking for a typo they did not make.
	if #skipped > 0 then
		print(("Every spec matching \"%s\" needs a real Roblox service:"):format(filter))

		for _, name in ipairs(skipped) do
			print("   " .. name)
		end

		print("Run those in Studio or through Open Cloud; see agent_docs/testing.md.")
		process.exit(1)
	end

	print(("No spec matched \"%s\". Spec paths look like:"):format(filter))

	for index = 1, math.min(#available, 5) do
		print("   " .. dottedPath(available[index].path))
	end

	process.exit(1)
end

local plan = TestPlanner.createPlan(modules)

local testCount = #plan:findNodes(function(node)
	return node.type == TestEnum.NodeType.It
end)

print("")

if filter ~= "" then
	print(("Filtered to \"%s\" -- %d of the suite's specs"):format(filter, #modules))

	if #modules <= 10 then
		for _, module in ipairs(modules) do
			print("   " .. dottedPath(module.path))
		end
	end
end

print(("Running %d tests"):format(testCount))
print("")

local progress = Progress.new(testCount)
local restore = watch(progress)
local startedAt = os.clock()

local ok, results = pcall(TestRunner.runPlan, plan)

local elapsed = os.clock() - startedAt

restore()
progress:flush()

if not ok then
	error(results, 0)
end

report(results, elapsed, skipped)
