-- Recovers PHP's func_num_args() - the true count of arguments a caller
-- passed, including a trailing explicit `nil`/`undefined` - which no
-- TypeScript-compiled function body can determine on its own: rbxtsc always
-- lowers a `...args: T[]` rest parameter to `local args = { ... }` before any
-- of that body's own code runs, and a Luau table built that way can't tell
-- a trailing `nil` element from no element at all (`#{ nil }` and `#{}` are
-- both 0). table.pack(...) records the true count via select('#', ...) into
-- its own `.n` field - but only if it runs on the *original*, still-live
-- `...`, before any TS-compiled body gets a chance to collapse it.
-- decoratePackedArgs supplies that missing earlier step: it wraps the
-- compiled method with a raw, hand-written function that receives the real
-- call untouched, packs it itself, and hands off to the original method
-- with the packed table prepended.
--
-- Safe under reentrancy and concurrent coroutines: `_args` is a fresh local
-- per call, passed explicitly down the call chain - never a shared or
-- global slot - so nothing is left for a nested or interleaved call to
-- overwrite.
local TableArgs = {}

function TableArgs.decoratePackedArgs(cls, methodName)
	local original = cls[methodName]

	cls[methodName] = function(self, ...)
		local _args = table.pack(...)

		return original(self, _args, ...)
	end
end

return TableArgs
