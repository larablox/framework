--!nolint
--[[
	A virtual instance tree over the filesystem, enough of one for compiled
	roblox-ts to walk.

	The generated code navigates by instance -- `script.Parent.Parent`, then
	`WaitForChild` per path segment (see `TS.import` in
	`node_modules/roblox-ts/include/RuntimeLib.lua`). Lune has no DataModel, so
	the tree is rebuilt here from the directories Rojo would have mounted,
	following the same two rules Rojo uses: a `.lua`/`.luau` file becomes a
	`ModuleScript` named without its extension, and a directory becomes a
	`Folder` -- or a `ModuleScript` with children, if it holds an `init` file.

	The whole tree is read up front, which is not the obvious choice and is not
	negotiable: `script.Parent.Foo` resolves through `__index`, and Lune's
	`fs.readDir` yields, which a metamethod may not do ("attempt to yield across
	metamethod/C-call boundary"). So the filesystem is touched during
	construction and never again during a lookup.
]]

local fs = require("@lune/fs")

local Tree = {}

local methods = {}
local nodeMeta

local function newNode(name: string, className: string, file: string?): any
	return setmetatable({
		Name = name,
		ClassName = className,
		Parent = nil,
		_file = file,
		_kids = {},
	}, nodeMeta)
end

function methods.FindFirstChild(self: any, name: string): any
	return rawget(self, "_kids")[name]
end

function methods.WaitForChild(self: any, name: string): any
	local child = rawget(self, "_kids")[name]
	if child == nil then
		error(`{self:GetFullName()} has no child named "{name}"`, 2)
	end
	return child
end

function methods.GetChildren(self: any): { any }
	local list = {}
	for _, child in rawget(self, "_kids") do
		table.insert(list, child)
	end
	table.sort(list, function(a, b)
		return a.Name < b.Name
	end)
	return list
end

function methods.GetDescendants(self: any): { any }
	local found = {}
	for _, child in self:GetChildren() do
		table.insert(found, child)
		for _, descendant in child:GetDescendants() do
			table.insert(found, descendant)
		end
	end
	return found
end

function methods.IsA(self: any, className: string): boolean
	if self.ClassName == className or className == "Instance" then
		return true
	end
	return className == "LuaSourceContainer" and self.ClassName == "ModuleScript"
end

function methods.GetFullName(self: any): string
	local parts = {}
	local node: any = self
	while node do
		table.insert(parts, 1, node.Name)
		node = node.Parent
	end
	return table.concat(parts, ".")
end

--[[ `RunService:IsStudio()` is false here, so `isPlugin` never asks. ]]
function methods.FindFirstAncestorWhichIsA(_self: any, _className: string): any
	return nil
end

nodeMeta = {
	__index = function(self, key)
		local method = methods[key]
		if method then
			return method
		end
		return rawget(self, "_kids")[key]
	end,

	__tostring = function(self)
		return self.Name
	end,
}

--[[ Hang a node under a parent. ]]
function Tree.attach(parent: any, child: any): any
	rawget(parent, "_kids")[child.Name] = child
	child.Parent = parent
	return child
end

--[[ A `Folder` with nothing on disk behind it, for the mount points. ]]
function Tree.folder(name: string): any
	return newNode(name, "Folder", nil)
end

--[[
	A directory, as whichever of the two Rojo would have made it, with
	everything under it.
]]
function Tree.fromDirectory(name: string, dir: string): any
	local init: string? = nil

	for _, candidate in { "init.luau", "init.lua" } do
		local path = dir .. "/" .. candidate
		if fs.isFile(path) then
			init = path
			break
		end
	end

	local node = if init ~= nil then newNode(name, "ModuleScript", init) else newNode(name, "Folder", nil)

	for _, entry in fs.readDir(dir) do
		local path = dir .. "/" .. entry
		local child

		if fs.isDir(path) then
			child = Tree.fromDirectory(entry, path)
		elseif entry:match("%.luau?$") and not entry:match("%.d%.luau?$") then
			local childName = (entry:gsub("%.luau?$", ""))
			if childName ~= "init" then
				child = newNode(childName, "ModuleScript", path)
			end
		end

		if child then
			Tree.attach(node, child)
		end
	end

	return node
end

return Tree
