--!nolint
--[[
	The Roblox globals the framework reaches for, as much of each as `src/`
	actually uses -- checked by grep, not guessed, and deliberately narrow: a
	shim that answers more than the real thing would is a test that passes for
	the wrong reason.

	Three things are deliberately **not** shimmed, and all three are stubbed to
	raise rather than left missing, so that a spec reaching one says what
	happened instead of dying on a nil index:

	- `DataStoreService` and `MemoryStoreService`. Five spec files are about
	  those services and nothing else, and a fake of them would only assert
	  what we already believe about the platform (see `agent_docs/testing.md`,
	  "a platform limit asserted instead of checked" -- that exact mistake is
	  already in this repo's history).
	- The datatypes `Support/Serializer` builds -- `CFrame`, `Color3`, `Enum`,
	  `UDim`, `UDim2`, `Vector2`, `Vector3`. Reproducing `CFrame` in order to
	  test `CFrame` handling proves nothing; those branches belong in Studio.

	`Instance` is not among them: nothing here constructs one, and the tree in
	`Tree.luau` stands in for the ones that are navigated.
]]

local datetime = require("@lune/datetime")
local serde = require("@lune/serde")
local task = require("@lune/task")

local Globals = {}

local function unavailable(name: string)
	return setmetatable({}, {
		__index = function(_, key)
			error(
				`{name}.{key} is not available under Lune. Specs that need it `
					.. `run in Studio or through Open Cloud, not here.`,
				2
			)
		end,
	})
end

local HttpService = {}

function HttpService.JSONEncode(_self: any, value: any): string
	return serde.encode("json", value)
end

function HttpService.JSONDecode(_self: any, value: string): any
	return serde.decode("json", value)
end

--[[ `Str.uuid()` and the specs' store names are all this is asked for. ]]
function HttpService.GenerateGUID(_self: any, wrapped: boolean?): string
	local hex = string.gsub("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx", "[xy]", function(char)
		local value = math.random(0, 15)
		if char == "y" then
			value = bit32.bor(bit32.band(value, 0x3), 0x8)
		end
		return string.format("%X", value)
	end)

	if wrapped == false then
		return hex
	end
	return "{" .. hex .. "}"
end

local RunService = {}

function RunService.IsServer(): boolean
	return true
end

function RunService.IsClient(): boolean
	return false
end

function RunService.IsStudio(): boolean
	return false
end

function RunService.IsRunning(): boolean
	return false
end

local Stats = {}

--[[
	Roblox reports the whole server's memory; the nearest true thing here is
	the Luau heap. Answering a constant would be worse than a rough number:
	`Worker.memoryExceeded()` compares against it, and a hard zero turns that
	comparison into one that can only ever go one way.
]]
function Stats.GetTotalMemoryUsageMb(_self: any): number
	return collectgarbage("count") / 1024
end

--[[
	Only TestEZ's own reporters reach for this, and this runner does not use
	them -- but `TestBootstrap` requires `TextReporter` on the way in, so the
	service has to exist for the module to load at all.
]]
local TestService = {}

function TestService.Message(_self: any, message: string)
	print(message)
end

function TestService.Error(_self: any, message: string)
	print(message)
end

function TestService.Checkpoint(_self: any, message: string)
	print(message)
end

local Players = {}

function Players.GetPlayerByUserId(_self: any, _userId: number): any
	return nil
end

function Players.GetPlayers(_self: any): { any }
	return {}
end

--[[ Built once the tree exists: `ReplicatedStorage` is a node in it. ]]
function Globals.build(replicatedStorage: any): { [string]: any }
	local services: { [string]: any } = {
		HttpService = HttpService,
		RunService = RunService,
		Stats = Stats,
		Players = Players,
		TestService = TestService,
		ReplicatedStorage = replicatedStorage,
		DataStoreService = unavailable("DataStoreService"),
		MemoryStoreService = unavailable("MemoryStoreService"),
	}

	local game = {
		Loaded = {
			Wait = function() end,
		},
	}

	function game.GetService(_self: any, name: string): any
		local service = services[name]
		if service == nil then
			error(`{name} is not shimmed under Lune`, 2)
		end
		return service
	end

	function game.IsLoaded(_self: any): boolean
		return true
	end

	--[[
		Roblox's `DateTime`, the four members `src/` uses.

		Userdata rather than a table, and that is the whole point of the
		`newproxy`: a table is walked field by field by anything comparing
		structurally -- `expectDeepEqual` in `tests/Illuminate/TestHelpers.ts`
		does exactly that -- so two shims built from one instant would compare
		equal here and not in Studio, where the real thing is opaque and has no
		equality by value. The `__type` on the metatable is what `typeof` below
		reads; Luau's own `typeof` does not honour it, that part is Roblox's.
	]]
	local DateTime = {}

	local function moment(millis: number): any
		local value = newproxy(true)
		local meta = getmetatable(value)

		meta.__type = "DateTime"
		meta.__index = {
			UnixTimestamp = millis // 1000,
			UnixTimestampMillis = millis,
		}

		return value
	end

	function DateTime.now(): any
		return moment(datetime.now().unixTimestampMillis)
	end

	function DateTime.fromUnixTimestamp(seconds: number): any
		return moment(math.floor(seconds * 1000))
	end

	function DateTime.fromUnixTimestampMillis(millis: number): any
		return moment(millis)
	end

	--[[ Roblox's `typeof`, which reads `__type` where Luau's does not. ]]
	local function robloxTypeof(value: any): string
		if type(value) == "userdata" then
			local meta = getmetatable(value)

			if type(meta) == "table" and meta.__type ~= nil then
				return meta.__type
			end
		end

		return typeof(value)
	end

	return {
		game = game,
		task = task,
		DateTime = DateTime,
		typeof = robloxTypeof,

		CFrame = unavailable("CFrame"),
		Color3 = unavailable("Color3"),
		Enum = unavailable("Enum"),
		UDim = unavailable("UDim"),
		UDim2 = unavailable("UDim2"),
		Vector2 = unavailable("Vector2"),
		Vector3 = unavailable("Vector3"),
	}
end

return Globals
