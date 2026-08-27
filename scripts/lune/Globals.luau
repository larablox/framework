--!nolint
--[[
	The Roblox globals the framework reaches for, as much of each as `src/`
	actually uses -- checked by grep, not guessed, and deliberately narrow: a
	shim that answers more than the real thing would is a test that passes for
	the wrong reason.

	`DataStoreService` and `MemoryStoreService` are **not** shimmed. Five spec
	files are about those services and nothing else, and a fake of them would
	only assert what we already believe about the platform (see
	`agent_docs/testing.md`, "a platform limit asserted instead of checked" --
	that exact mistake is already in this repo's history). They are stubbed to
	raise instead, so a spec that reaches one says so.
]]

local serde = require("@lune/serde")
local task = require("@lune/task")

local Globals = {}

--[[
	What marks a value as the `DateTime` shim.

	Luau honours a `__type` metafield only on userdata, so a table cannot
	report itself as a `DateTime` -- and `typeIs(value, "DateTime")` compiles to
	exactly `typeof(value) == "DateTime"`, which `Serializer` dispatches on.
	Rather than let that branch quietly go the wrong way, the metatable is the
	mark and `typeof` below is taught to read it.
]]
local momentMeta = {}

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
		Roblox's `DateTime`, the four members `src/` uses. Whole seconds and
		milliseconds since the epoch, which is all the framework asks of it.
	]]
	local DateTime = {}

	local function moment(millis: number): any
		return setmetatable({
			UnixTimestamp = millis // 1000,
			UnixTimestampMillis = millis,
		}, momentMeta)
	end

	function DateTime.now(): any
		return moment(math.floor(os.time() * 1000))
	end

	function DateTime.fromUnixTimestamp(seconds: number): any
		return moment(math.floor(seconds * 1000))
	end

	function DateTime.fromUnixTimestampMillis(millis: number): any
		return moment(millis)
	end

	--[[ Roblox's `typeof`, which answers `"DateTime"` where Luau says table. ]]
	local function robloxTypeof(value: any): string
		if type(value) == "table" and getmetatable(value) == momentMeta then
			return "DateTime"
		end
		return typeof(value)
	end

	return {
		game = game,
		task = task,
		DateTime = DateTime,
		typeof = robloxTypeof,
	}
end

return Globals
