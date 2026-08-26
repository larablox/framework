--[[
	The suite's entry point, mounted by `test.project.json` as
	`ServerScriptService.RunTests`.

	It drives TestEZ through the four steps `TestBootstrap:run()` documents --
	locate modules, plan, run, report -- rather than calling it, for one
	reason: `TestBootstrap` hands its reporter the *finished* tree, so a run
	says nothing at all until it is over. Between the module warm-up and a
	thousand-odd tests that is a long silence with no way to tell a slow run
	from a hung one.

	The output is PHPUnit's: a progress row per 63 tests, then a numbered list
	of failures, then the totals. `TextReporter` prints the whole plan tree
	instead, one line per test, which at this suite's size overflows Studio's
	log buffer and scrolls the failures out of reach before anyone can read
	them.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TS = require(ReplicatedStorage.rbxts_include.RuntimeLib)

local testez = ReplicatedStorage.rbxts_include.node_modules["@rbxts"].testez.src
local TestBootstrap = require(testez.TestBootstrap)
local TestEnum = require(testez.TestEnum)
local TestPlanner = require(testez.TestPlanner)
local TestRunner = require(testez.TestRunner)
local TestSession = require(testez.TestSession)

--[[ How many progress marks go on one row. ]]
local COLUMNS = 63

--[[ A test slower than this is worth naming; how many of them to name. ]]
local SLOW_SECONDS = 0.1
local SLOW_SHOWN = 10

local FRAMEWORK = ReplicatedStorage.Illuminate
local SPECS = ReplicatedStorage.IlluminateTests

-- ---------------------------------------------------------------------
-- Warm-up
-- ---------------------------------------------------------------------

--[[
	roblox-ts modules bootstrap their own `_G[script]` entry only when reached
	through `TS.import`, which TestEZ's plain, tree-walking `require()` never
	does. Warming every module up first means TestEZ's own `require()` calls
	hit Roblox's require cache instead of an unbootstrapped module. The
	framework and the specs are two separately-compiled trees (see
	`tsconfig.tests.json`'s `rootDirs` comment), so both need it -- same as
	`@larablox/monolog`'s own `RunTests`.
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

	for _, root in ipairs(trees) do
		total += #moduleScripts(root)
	end

	local startedAt = os.clock()

	for _, root in ipairs(trees) do
		for _, instance in ipairs(moduleScripts(root)) do
			local ok, err = pcall(function()
				return TS.import(root, instance)
			end)

			if not ok then
				warn(("Failed to warm up %s: %s"):format(instance:GetFullName(), tostring(err)))
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

	-- Padded so the counts line up whether the row is full or the last one.
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
	Report each leaf as it finishes.

	The three places a leaf's outcome is written are these `TestSession`
	methods, and every session reaches them through `TestSession.__index`, so
	wrapping the module wraps the run. There is no supported hook for this --
	`TestBootstrap` only takes an end-of-run reporter -- and the originals go
	back the moment the run is over.
]]
local function watch(progress, durations)
	local original = {
		pushNode = TestSession.pushNode,
		setSuccess = TestSession.setSuccess,
		setError = TestSession.setError,
		setSkipped = TestSession.setSkipped,
	}

	-- One variable and not a stack: an `It` never contains another `It`, and
	-- the run is sequential, so at most one test is ever being timed.
	local startedAt = nil

	-- `setError()` is written on a `Describe` as well, to roll its children
	-- up; only a leaf is a test.
	local function isLeaf(session)
		local node = session.nodeStack[#session.nodeStack]

		return node ~= nil
			and node.planNode ~= nil
			and node.planNode.type == TestEnum.NodeType.It
	end

	--[[
		The clock has to start somewhere, and `pushNode` is the only call
		TestEZ makes on the way *into* a test. Keyed by the plan node rather
		than by phrase: two tests may read the same, and the reporter walks
		result nodes that carry their plan node anyway.
	]]
	function TestSession:pushNode(planNode)
		original.pushNode(self, planNode)

		if planNode.type == TestEnum.NodeType.It then
			startedAt = os.clock()
		end
	end

	local function finish(session)
		if not isLeaf(session) then
			return false
		end

		if startedAt ~= nil then
			local node = session.nodeStack[#session.nodeStack]

			durations[node.planNode] = os.clock() - startedAt
			startedAt = nil
		end

		return true
	end

	function TestSession:setSuccess()
		original.setSuccess(self)

		if finish(self) then
			progress:mark(".")
		end
	end

	function TestSession:setError(message)
		original.setError(self, message)

		if finish(self) then
			progress:mark("F")
		end
	end

	function TestSession:setSkipped()
		original.setSkipped(self)

		if finish(self) then
			progress:mark("S")
		end
	end

	return function()
		TestSession.pushNode = original.pushNode
		TestSession.setSuccess = original.setSuccess
		TestSession.setError = original.setError
		TestSession.setSkipped = original.setSkipped
	end
end

-- ---------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------

--[[
	`planNode.phrase` is one level's text only; walking up `parent` rebuilds
	the full "describe > describe > it" path the tree reporter would indent.
]]
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
	An `expect` failure names TestRunner, not the assertion that tripped; the
	first spec frame of the traceback is the line the failure is actually on,
	and the log is close to unreadable without it.
]]
local function describeError(node)
	if node.errors[1] == nil then
		return "(no message)"
	end

	local text = tostring(node.errors[1])
	local message = string.match(text, "^[^\n]*") or "(no message)"

	-- Every `expect` failure is prefixed with TestRunner's own position, which
	-- is the same one every time and says nothing. A prefix pointing into the
	-- framework is worth keeping -- that one is where the error came from.
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
		-- Only leaves carry a useful message; a failed `describe` is just the
		-- roll-up of the `it`s beneath it.
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

--[[
	Name the tests the run is actually spent in.

	1141 tests at an average of 96 ms is not 1141 slow tests, it is a handful
	of very slow ones -- and which ones decides what is worth doing about it.
	Nothing is printed when there are none, so a fast run stays quiet.
]]
local function reportSlowest(results, durations, elapsed)
	local ranked = {}
	local spent = 0

	results:visitAllNodes(function(node)
		if node.planNode.type ~= TestEnum.NodeType.It then
			return
		end

		local seconds = durations[node.planNode]

		if seconds ~= nil and seconds >= SLOW_SECONDS then
			table.insert(ranked, { phrase = fullPhrase(node), seconds = seconds })
			spent += seconds
		end
	end)

	if #ranked == 0 then
		return
	end

	table.sort(ranked, function(first, second)
		return first.seconds > second.seconds
	end)

	local shown = math.min(#ranked, SLOW_SHOWN)

	print("")
	print(("Slowest tests (%d of %d over %dms, %.1fs of %.1fs):"):format(
		shown,
		#ranked,
		SLOW_SECONDS * 1000,
		spent,
		elapsed
	))
	print("")

	for index = 1, shown do
		print(("  %6.2fs  %s"):format(ranked[index].seconds, ranked[index].phrase))
	end
end

local function report(results, durations, elapsed)
	local failures = collectFailures(results)
	local total = results.successCount + results.failureCount + results.skippedCount

	print("")
	print(("Time: %.1fs"):format(elapsed))

	reportSlowest(results, durations, elapsed)

	print("")

	if #failures == 0 then
		if results.skippedCount > 0 then
			print(("OK (%d tests, %d skipped)"):format(total, results.skippedCount))
		else
			print(("OK (%d tests)"):format(total))
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

	-- Raised, not printed: a red line is what says the run did not pass.
	error(("FAILURES!\nTests: %d, Failures: %d."):format(total, results.failureCount), 0)
end

-- ---------------------------------------------------------------------
-- Run
-- ---------------------------------------------------------------------

print("Larablox framework test suite")
print("")

warmUp()

local plan = TestPlanner.createPlan(TestBootstrap:getModules(SPECS))

local testCount = #plan:findNodes(function(node)
	return node.type == TestEnum.NodeType.It
end)

print("")
print(("Running %d tests"):format(testCount))
print("")

local progress = Progress.new(testCount)
local durations = {}
local restore = watch(progress, durations)

local startedAt = os.clock()
local ok, results = pcall(TestRunner.runPlan, plan)
local elapsed = os.clock() - startedAt

restore()
progress:flush()

if not ok then
	error(results, 0)
end

report(results, durations, elapsed)
