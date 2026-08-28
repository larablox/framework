import { Reflector } from 'Illuminate/Support/Reflector';
import { RuntimeException } from 'Illuminate/Exception';

const HttpService = game.GetService('HttpService');
const Players = game.GetService('Players');

/** Thrown when a value cannot be turned into a payload, or read back from one. */
export class SerializationException extends RuntimeException
{}

/**
 * Thrown when a serialized `Instance` reference no longer resolves.
 *
 * PHP: `Illuminate\Database\Eloquent\ModelNotFoundException`, which
 * `CallQueuedHandler` catches to honour `deleteWhenMissingModels`. A model that
 * was deleted between queueing and running is the same situation as a player
 * who has left.
 */
export class InstanceNotFoundException extends SerializationException
{}

/** The key a class envelope is tagged with. */
const CLASS_KEY = '__class';

/** The key a datatype envelope is tagged with. */
const TYPE_KEY = '__type';

/** name -> class, the substitute for PHP's autoloader. */
const namesToClasses = new Map<string, object>();

/** class -> name, so a class is named the same way every time. */
const classesToNames = new Map<object, string>();

/**
 * PHP: the language's own `serialize()` / `unserialize()`.
 *
 * There is no counterpart on this platform, and the queue is built on one: a
 * job travels to its storage as a string and comes back as an object. What PHP
 * gets for free costs two things here.
 *
 * **A registry instead of an autoloader.** PHP writes the fully qualified class
 * name and lets the autoloader find the class again; class-strings do not exist
 * in Luau, so a class is registered under a name. `serialize()` registers what
 * it meets, which covers a round trip inside one server; a job read back on a
 * *different* server has to have had its class registered there, which is what
 * `register()` is for.
 *
 * **No closures and no Instances.** A function cannot cross into a payload --
 * neither can it in PHP, which is why `laravel/serializable-closure` exists.
 * An `Instance` is stored the way `SerializesModels` stores an Eloquent model:
 * as an identifier that is resolved again on the way out, and an identifier
 * that no longer resolves raises `InstanceNotFoundException`.
 *
 * Object identity and cycles are lost: PHP's format carries back-references,
 * JSON does not, so a cycle is reported rather than silently truncated.
 */
export class Serializer
{
    /** Make a class resolvable by name when a payload is read back. */
    public static register(target: object, name?: string): void
    {
        const registered = name ?? Reflector.className(target);

        const existing = namesToClasses.get(registered);

        if (existing !== undefined && existing !== target) {
            throw new SerializationException(
                `Two classes are registered as [${registered}]; give one of them another name.`,
            );
        }

        namesToClasses.set(registered, target);
        classesToNames.set(target, registered);
    }

    /** The name a class is serialized under, registering it if it is new. */
    public static nameOf(target: object): string
    {
        const known = classesToNames.get(target);

        if (known !== undefined) {
            return known;
        }

        Serializer.register(target);

        return classesToNames.get(target) as string;
    }

    /** The class registered under the given name, if any. */
    public static resolve(name: string): object | undefined
    {
        return namesToClasses.get(name);
    }

    /** PHP: `serialize($value)`. */
    public static serialize(value: unknown): string
    {
        const encoded = encode(value, new Map<object, boolean>());

        const [ok, result] = pcall(() => HttpService.JSONEncode(encoded as defined));

        if (!ok) {
            throw new SerializationException(`Unable to encode payload: ${tostring(result)}`);
        }

        return result as string;
    }

    /** PHP: `unserialize($payload)`. */
    public static unserialize(payload: string): unknown
    {
        const [ok, decoded] = pcall(() => HttpService.JSONDecode(payload));

        if (!ok) {
            throw new SerializationException(`Unable to decode payload: ${tostring(decoded)}`);
        }

        return decode(decoded);
    }
}

/** Turn one value into something `JSONEncode` accepts. */
function encode(value: unknown, seen: Map<object, boolean>): unknown
{
    if (typeIs(value, 'number') || typeIs(value, 'string') || typeIs(value, 'boolean')) {
        return value;
    }

    if (typeIs(value, 'function')) {
        throw new SerializationException('Serialization of a function is not allowed.');
    }

    if (typeIs(value, 'Instance')) {
        return encodeInstance(value);
    }

    if (typeIs(value, 'Vector3')) {
        return { [TYPE_KEY]: 'vector3', x: value.X, y: value.Y, z: value.Z };
    }

    if (typeIs(value, 'Vector2')) {
        return { [TYPE_KEY]: 'vector2', x: value.X, y: value.Y };
    }

    if (typeIs(value, 'CFrame')) {
        // Spelled out: a LuaTuple inside an array literal nests instead of
        // flattening, and the twelve components have to stay a flat list.
        const [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] = value.GetComponents();

        return {
            [TYPE_KEY]: 'cframe',
            components: [
                x,
                y,
                z,
                r00,
                r01,
                r02,
                r10,
                r11,
                r12,
                r20,
                r21,
                r22,
            ],
        };
    }

    if (typeIs(value, 'Color3')) {
        return { [TYPE_KEY]: 'color3', r: value.R, g: value.G, b: value.B };
    }

    if (typeIs(value, 'UDim')) {
        return {
            [TYPE_KEY]: 'udim',
            scale: value.Scale,
            offset: value.Offset,
        };
    }

    if (typeIs(value, 'UDim2')) {
        return {
            [TYPE_KEY]: 'udim2',
            components: [
                value.X.Scale,
                value.X.Offset,
                value.Y.Scale,
                value.Y.Offset,
            ],
        };
    }

    if (typeIs(value, 'DateTime')) {
        return {
            [TYPE_KEY]: 'datetime',
            millis: value.UnixTimestampMillis,
        };
    }

    if (typeIs(value, 'EnumItem')) {
        return {
            [TYPE_KEY]: 'enum',
            enum: tostring(value.EnumType),
            name: value.Name,
        };
    }

    if (typeIs(value, 'table')) {
        // A class itself, not an instance of one: PHP would be carrying its
        // name as a class-string, and so does this.
        if (isClassTable(value as object)) {
            return {
                [TYPE_KEY]: 'class',
                name: Serializer.nameOf(value as object),
            };
        }

        return encodeTable(value as object, seen);
    }

    throw new SerializationException(`Serialization of a [${typeOf(value)}] value is not supported.`);
}

/** An `Instance` becomes an identifier, never the instance itself. */
function encodeInstance(instance: Instance): unknown
{
    if (instance.IsA('Player')) {
        return {
            [TYPE_KEY]: 'instance',
            class: 'Player',
            id: instance.UserId,
        };
    }

    return {
        [TYPE_KEY]: 'instance',
        path: instance.GetFullName(),
    };
}

/** A table is a class instance, a list or a map. */
function encodeTable(value: object, seen: Map<object, boolean>): unknown
{
    if (seen.get(value) === true) {
        throw new SerializationException('Serialization of a cyclic value is not supported.');
    }

    seen.set(value, true);

    const klass = Reflector.isInstance(value) ? Reflector.classOf(value) : undefined;

    const entries = value as unknown as Record<string, unknown>;

    let encoded: unknown;

    if (isList(entries)) {
        const items = new Array<defined>();

        for (const item of value as Array<unknown>) {
            items.push(encode(item, seen) as defined);
        }

        encoded = items;
    } else if (hasOnlyStringKeys(entries)) {
        const fields: Record<string, unknown> = {};

        for (const [key, item] of pairs(entries)) {
            fields[key as string] = encode(item, seen);
        }

        encoded = fields;
    } else {
        const pairsList = new Array<defined>();

        for (const [key, item] of pairs(entries)) {
            pairsList.push([
                encode(key, seen),
                encode(item, seen),
            ] as unknown as defined);
        }

        encoded = { [TYPE_KEY]: 'map', entries: pairsList };
    }

    seen.delete(value);

    if (klass === undefined) {
        return encoded;
    }

    return { [CLASS_KEY]: Serializer.nameOf(klass), fields: encoded };
}

/** Read one encoded value back. */
function decode(value: unknown): unknown
{
    if (!typeIs(value, 'table')) {
        return value;
    }

    const entries = value as unknown as Record<string, unknown>;

    const className = entries[CLASS_KEY];

    if (typeIs(className, 'string')) {
        return decodeClass(className, entries.fields);
    }

    const tag = entries[TYPE_KEY];

    if (typeIs(tag, 'string')) {
        return decodeTagged(tag, entries);
    }

    if (isList(entries)) {
        const items = new Array<defined>();

        for (const item of value as Array<unknown>) {
            items.push(decode(item) as defined);
        }

        return items;
    }

    const fields: Record<string, unknown> = {};

    for (const [key, item] of pairs(entries)) {
        fields[key as string] = decode(item);
    }

    return fields;
}

/**
 * Rebuild an instance of a registered class.
 *
 * The constructor is never called -- PHP's `unserialize()` does not call one
 * either -- so a job comes back with exactly the state it was queued with.
 */
function decodeClass(name: string, fields: unknown): object
{
    const klass = Serializer.resolve(name);

    if (klass === undefined) {
        throw new SerializationException(
            `No class is registered as [${name}]. Register it before reading a payload that carries it.`,
        );
    }

    const restored = decode(fields) as object;

    return setmetatable(restored, klass as never);
}

/** Rebuild one of the tagged datatypes. */
function decodeTagged(tag: string, entries: Record<string, unknown>): unknown
{
    if (tag === 'vector3') {
        return new Vector3(entries.x as number, entries.y as number, entries.z as number);
    }

    if (tag === 'vector2') {
        return new Vector2(entries.x as number, entries.y as number);
    }

    if (tag === 'cframe') {
        const components = entries.components as Array<number>;

        return new CFrame(
            components[0],
            components[1],
            components[2],
            components[3],
            components[4],
            components[5],
            components[6],
            components[7],
            components[8],
            components[9],
            components[10],
            components[11],
        );
    }

    if (tag === 'color3') {
        return new Color3(entries.r as number, entries.g as number, entries.b as number);
    }

    if (tag === 'udim') {
        return new UDim(entries.scale as number, entries.offset as number);
    }

    if (tag === 'udim2') {
        const components = entries.components as Array<number>;

        return new UDim2(components[0], components[1], components[2], components[3]);
    }

    if (tag === 'datetime') {
        return DateTime.fromUnixTimestampMillis(entries.millis as number);
    }

    if (tag === 'enum') {
        return decodeEnum(entries.enum as string, entries.name as string);
    }

    if (tag === 'class') {
        const name = entries.name as string;

        const klass = Serializer.resolve(name);

        if (klass === undefined) {
            throw new SerializationException(
                `No class is registered as [${name}]. Register it before reading a payload that carries it.`,
            );
        }

        return klass;
    }

    if (tag === 'instance') {
        return decodeInstance(entries);
    }

    if (tag === 'map') {
        const restored = new Map<unknown, unknown>();

        for (const entry of entries.entries as Array<Array<unknown>>) {
            restored.set(decode(entry[0]), decode(entry[1]));
        }

        return restored;
    }

    throw new SerializationException(`Unknown payload tag [${tag}].`);
}

/** `Enum.Material.Plastic` from its two names. */
function decodeEnum(enumType: string, name: string): EnumItem
{
    const enums = Enum as unknown as Record<string, Record<string, EnumItem>>;

    const item = enums[enumType]?.[name];

    if (item === undefined) {
        throw new SerializationException(`Unknown enum item [Enum.${enumType}.${name}].`);
    }

    return item;
}

/** Resolve an identifier back to the instance it stands for. */
function decodeInstance(entries: Record<string, unknown>): Instance
{
    const className = entries.class;

    if (className === 'Player') {
        const player = Players.GetPlayerByUserId(entries.id as number);

        if (player === undefined) {
            throw new InstanceNotFoundException(`No player with id [${entries.id}] is in this server.`);
        }

        return player;
    }

    const path = entries.path as string;

    let current: Instance | undefined = game;

    for (const segment of path.split('.')) {
        current = current?.FindFirstChild(segment);
    }

    if (current === undefined) {
        throw new InstanceNotFoundException(`No instance is at [${path}] in this server.`);
    }

    return current;
}

/**
 * Tell a class table apart from a plain one.
 *
 * roblox-ts gives a class a metatable carrying `__tostring` and its parent,
 * while a plain table, an array and a `Map` have none. An instance has one too,
 * which is why `Reflector.isInstance()` rules it out first.
 */
function isClassTable(value: object): boolean
{
    return getmetatable(value) !== undefined && !Reflector.isInstance(value);
}

/** A table whose keys are exactly `1..n`. */
function isList(value: Record<string, unknown>): boolean
{
    let count = 0;

    for (const [key] of pairs(value)) {
        if (!typeIs(key, 'number')) {
            return false;
        }

        count += 1;
    }

    const list = value as unknown as Record<number, unknown>;

    for (let index = 1; index <= count; index++) {
        if (list[index] === undefined) {
            return false;
        }
    }

    return true;
}

/** A table that `JSONEncode` may write as a plain object. */
function hasOnlyStringKeys(value: Record<string, unknown>): boolean
{
    for (const [key] of pairs(value)) {
        if (!typeIs(key, 'string')) {
            return false;
        }

        if (key === CLASS_KEY || key === TYPE_KEY) {
            return false;
        }
    }

    return true;
}
