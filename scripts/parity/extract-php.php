<?php

declare(strict_types=1);

// Extracts the class surface of the pinned laravel/framework checkout into
// JSON for the parity comparison (scripts/parity/compare.mjs). Token-based on
// purpose: the upstream tree is data here, not code to execute.
//
// Usage: php extract-php.php <illuminate-src-root> <vendor-root> <out-json>

error_reporting(E_ALL);

if ($argc < 4) {
    fwrite(STDERR, "usage: php extract-php.php <illuminate-src-root> <vendor-root> <out-json>\n");
    exit(2);
}

[, $srcRootArg, $vendorRootArg, $outPath] = $argv;
$srcRoot = normalizePath(realpath($srcRootArg) ?: $srcRootArg);
$vendorRoot = normalizePath(realpath($vendorRootArg) ?: $vendorRootArg);

/** @var array<string, list<string>> $psr4 prefix => dirs */
$psr4 = require $vendorRoot . '/composer/autoload_psr4.php';

function normalizePath(string $path): string
{
    return rtrim(str_replace('\\', '/', $path), '/');
}

// ---------------------------------------------------------------------------
// Single-file parser
// ---------------------------------------------------------------------------

final class FileSurface
{
    public string $namespace = '';

    /** @var array<string, string> alias => FQCN (class imports only) */
    public array $imports = [];

    /** @var list<array<string, mixed>> */
    public array $declarations = [];

    /** @var list<array<string, mixed>> top-level functions */
    public array $functions = [];
}

final class Parser
{
    /** @var list<array{0: int, 1: string, 2: int}|string> */
    private array $tokens;

    private int $pos = 0;

    private int $count;

    private int $line = 1;

    private FileSurface $surface;

    public function __construct(string $code)
    {
        $this->tokens = token_get_all($code);
        $this->count = count($this->tokens);
        $this->surface = new FileSurface();
    }

    public function parse(): FileSurface
    {
        $abstract = false;

        while ($this->pos < $this->count) {
            $token = $this->advance();
            if (! is_array($token)) {
                continue;
            }

            switch ($token[0]) {
                case T_NAMESPACE:
                    $this->surface->namespace = $this->readQualifiedName();
                    break;
                case T_USE:
                    $this->parseImport();
                    break;
                case T_ABSTRACT:
                    $abstract = true;
                    break;
                case T_CLASS:
                    if ($this->previousSignificantId() === T_DOUBLE_COLON) {
                        break; // Foo::class in a top-level expression
                    }
                    $this->parseDeclaration('class', $abstract);
                    $abstract = false;
                    break;
                case T_INTERFACE:
                    $this->parseDeclaration('interface', false);
                    break;
                case T_TRAIT:
                    $this->parseDeclaration('trait', false);
                    break;
                case T_ENUM:
                    $this->parseDeclaration('enum', false);
                    break;
                case T_FUNCTION:
                    $fn = $this->parseFunctionLike(startLine: $token[2]);
                    if ($fn !== null) {
                        $this->surface->functions[] = $fn;
                    }
                    break;
            }
        }

        return $this->surface;
    }

    /** @return array{0: int, 1: string, 2: int}|string|null */
    private function advance(): array|string|null
    {
        if ($this->pos >= $this->count) {
            return null;
        }
        $token = $this->tokens[$this->pos++];
        if (is_array($token)) {
            $this->line = $token[2] + substr_count($token[1], "\n");
        }

        return $token;
    }

    /** @return array{0: int, 1: string, 2: int}|string|null */
    private function peekSignificant(int $offset = 0): array|string|null
    {
        $seen = 0;
        for ($i = $this->pos; $i < $this->count; $i++) {
            $token = $this->tokens[$i];
            if (is_array($token) && in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            if ($seen === $offset) {
                return $token;
            }
            $seen++;
        }

        return null;
    }

    /** @return array{0: int, 1: string, 2: int}|string|null */
    private function nextSignificant(): array|string|null
    {
        while (($token = $this->advance()) !== null) {
            if (is_array($token) && in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            return $token;
        }

        return null;
    }

    private function previousSignificantId(): int|string|null
    {
        for ($i = $this->pos - 2; $i >= 0; $i--) {
            $token = $this->tokens[$i];
            if (is_array($token)) {
                if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                    continue;
                }

                return $token[0];
            }

            return $token;
        }

        return null;
    }

    private function readQualifiedName(): string
    {
        $name = '';
        while (($token = $this->peekSignificant()) !== null) {
            if (is_array($token) && in_array($token[0], [T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_NS_SEPARATOR], true)) {
                $name .= $token[1];
                $this->nextSignificant();
                continue;
            }
            break;
        }

        return ltrim($name, '\\');
    }

    private function parseImport(): void
    {
        // Skip `use function` / `use const`.
        $first = $this->peekSignificant();
        if (is_array($first) && in_array($first[0], [T_FUNCTION, T_CONST], true)) {
            $this->consumeUntilChar(';');

            return;
        }

        $prefix = $this->readQualifiedName();
        $token = $this->peekSignificant();

        if ($token === '{') { // group use: use A\{B, C as D};
            $this->nextSignificant();
            while (true) {
                $name = $this->readQualifiedName();
                if ($name === '') {
                    break;
                }
                $alias = $this->readAliasOrDefault($name);
                $this->surface->imports[$alias] = $prefix . '\\' . $name;
                $next = $this->nextSignificant();
                if ($next !== ',') {
                    break;
                }
            }
            $this->consumeUntilChar(';');

            return;
        }

        $alias = $this->readAliasOrDefault($prefix);
        $this->surface->imports[$alias] = $prefix;
        $this->consumeUntilChar(';');
    }

    private function readAliasOrDefault(string $name): string
    {
        $token = $this->peekSignificant();
        if (is_array($token) && $token[0] === T_AS) {
            $this->nextSignificant();
            $aliasToken = $this->nextSignificant();

            return is_array($aliasToken) ? $aliasToken[1] : $name;
        }
        $parts = explode('\\', $name);

        return end($parts);
    }

    private function consumeUntilChar(string $char): void
    {
        while (($token = $this->advance()) !== null) {
            if ($token === $char) {
                return;
            }
        }
    }

    private function skipBalanced(string $open, string $close): void
    {
        $depth = 1;
        while ($depth > 0 && ($token = $this->advance()) !== null) {
            if ($token === $open || ($open === '{' && $this->opensCurly($token))) {
                $depth++;
            } elseif ($token === $close) {
                $depth--;
            }
        }
    }

    /**
     * String interpolation (`"{$x}"`, `"${x}"`) opens a brace as an array
     * token but closes it with a plain `}` -- both sides must count.
     */
    private function opensCurly(array|string $token): bool
    {
        return is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true);
    }

    private function skipAttribute(): void
    {
        // T_ATTRIBUTE is the literal `#[`; consume to the matching `]`.
        $this->skipBalanced('[', ']');
    }

    private function parseDeclaration(string $kind, bool $abstract): void
    {
        $nameToken = $this->nextSignificant();
        if (! is_array($nameToken) || $nameToken[0] !== T_STRING) {
            return; // anonymous class in a top-level expression; nothing to record
        }

        $decl = [
            'name' => $nameToken[1],
            'kind' => $kind,
            'abstract' => $abstract,
            'extends' => [],
            'implements' => [],
            'uses' => [],
            'members' => [],
        ];

        while (($token = $this->nextSignificant()) !== null && $token !== '{') {
            if (is_array($token) && $token[0] === T_EXTENDS) {
                do {
                    $decl['extends'][] = $this->readQualifiedName();
                } while ($this->peekSignificant() === ',' && $this->nextSignificant() !== null);
            } elseif (is_array($token) && $token[0] === T_IMPLEMENTS) {
                do {
                    $decl['implements'][] = $this->readQualifiedName();
                } while ($this->peekSignificant() === ',' && $this->nextSignificant() !== null);
            }
            // Enum backing type (`: string`) and stray modifiers fall through here.
        }

        $this->parseBody($decl);
        $this->surface->declarations[] = $decl;
    }

    /** @param array<string, mixed> $decl */
    private function parseBody(array &$decl): void
    {
        $modifiers = $this->freshModifiers();
        // Tokens between the modifiers and the member name -- a property's
        // type, mostly. They belong to the declaration hash.
        $lead = [];

        while (($token = $this->advance()) !== null) {
            if ($token === '}') {
                return;
            }
            if (! is_array($token)) {
                if ($token === ';') {
                    $lead = [];
                } else {
                    $lead[] = $token;
                }
                continue;
            }

            switch ($token[0]) {
                case T_ATTRIBUTE:
                    $this->skipAttribute();
                    break;
                case T_PUBLIC:
                case T_PROTECTED:
                case T_PRIVATE:
                    $modifiers['visibility'] = strtolower($token[1]);
                    $lead = [];
                    break;
                case T_STATIC:
                    $modifiers['static'] = true;
                    $lead = [];
                    break;
                case T_ABSTRACT:
                    $modifiers['abstract'] = true;
                    $lead = [];
                    break;
                case T_VAR:
                    $modifiers['visibility'] = 'public';
                    $lead = [];
                    break;
                case T_USE:
                    do {
                        $decl['uses'][] = $this->readQualifiedName();
                    } while ($this->peekSignificant() === ',' && $this->nextSignificant() !== null);
                    if ($this->peekSignificant() === '{') {
                        $this->nextSignificant();
                        $this->skipBalanced('{', '}'); // conflict-resolution block
                    } else {
                        $this->consumeUntilChar(';');
                    }
                    $lead = [];
                    break;
                case T_CASE:
                    $caseName = $this->nextSignificant();
                    if (is_array($caseName) && $caseName[0] === T_STRING) {
                        $decl['members'][] = $this->member($caseName[1], 'case', 'public', $modifiers, null, [$caseName[2], $caseName[2]], []);
                    }
                    $this->consumeUntilChar(';');
                    $modifiers = $this->freshModifiers();
                    $lead = [];
                    break;
                case T_CONST:
                    $this->parseConst($decl, $modifiers);
                    $modifiers = $this->freshModifiers();
                    $lead = [];
                    break;
                case T_FUNCTION:
                    $method = $this->parseFunctionLike($token[2], $modifiers, $decl);
                    if ($method !== null) {
                        $decl['members'][] = $method;
                    }
                    $modifiers = $this->freshModifiers();
                    $lead = [];
                    break;
                case T_VARIABLE:
                    $first = count($decl['members']);
                    $decl['members'][] = $this->member(substr($token[1], 1), 'property', $modifiers['visibility'] ?? 'public', $modifiers, null, [$token[2], $token[2]], []);
                    $rest = $this->consumePropertyRest($decl, $modifiers);
                    $hash = sha1(implode("\x1f", array_merge(
                        [$modifiers['visibility'] ?? 'public', $modifiers['static'] ? 'static' : ''],
                        $lead,
                        [$token[1]],
                        $rest,
                    )));
                    for ($i = $first, $n = count($decl['members']); $i < $n; $i++) {
                        $decl['members'][$i]['hash'] = $hash;
                    }
                    $modifiers = $this->freshModifiers();
                    $lead = [];
                    break;
                default:
                    if (! in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                        $lead[] = $token[1];
                    }
                    break;
            }
        }
    }

    /** @return array{visibility: ?string, static: bool, abstract: bool} */
    private function freshModifiers(): array
    {
        return ['visibility' => null, 'static' => false, 'abstract' => false];
    }

    /**
     * @param array{visibility: ?string, static: bool, abstract: bool} $modifiers
     * @param list<string> $vendorDeps
     * @return array<string, mixed>
     */
    private function member(string $name, string $kind, string $visibility, array $modifiers, ?string $hash, ?array $lines, array $vendorDeps): array
    {
        return [
            'name' => $name,
            'kind' => $kind,
            'visibility' => $visibility,
            'static' => $modifiers['static'],
            'abstract' => $modifiers['abstract'],
            'origin' => 'self',
            'hash' => $hash,
            'lines' => $lines,
            'vendorDeps' => $vendorDeps,
        ];
    }

    /**
     * Everything after the first `$name` of a property declaration: default
     * value, further `, $names`, and 8.4 property hooks (`{ get; set; }`).
     * Returns the significant tokens consumed, for the declaration hash.
     *
     * @param array<string, mixed> $decl
     * @param array{visibility: ?string, static: bool, abstract: bool} $modifiers
     * @return list<string>
     */
    private function consumePropertyRest(array &$decl, array $modifiers): array
    {
        $collected = [];
        $depth = 0;
        while (($token = $this->advance()) !== null) {
            if ($token === '(' || $token === '[') {
                $depth++;
            } elseif ($token === ')' || $token === ']') {
                $depth--;
            } elseif ($token === '{' && $depth === 0) {
                $collected[] = '{';
                $this->skipBalanced('{', '}'); // property hooks

                return $collected;
            } elseif ($token === ';' && $depth === 0) {
                return $collected;
            } elseif (is_array($token) && $token[0] === T_VARIABLE && $depth === 0) {
                $decl['members'][] = $this->member(substr($token[1], 1), 'property', $modifiers['visibility'] ?? 'public', $modifiers, null, [$token[2], $token[2]], []);
            }
            $this->collectSignificant($collected, $token);
        }

        return $collected;
    }

    /**
     * @param array<string, mixed> $decl
     * @param array{visibility: ?string, static: bool, abstract: bool} $modifiers
     */
    private function parseConst(array &$decl, array $modifiers): void
    {
        $collected = [];
        $first = count($decl['members']);
        $depth = 0;
        while (($token = $this->advance()) !== null) {
            if ($token === ';' && $depth === 0) {
                break;
            }
            if ($token === '(' || $token === '[') {
                $depth++;
            } elseif ($token === ')' || $token === ']') {
                $depth--;
            }
            if (is_array($token) && $token[0] === T_STRING && $depth === 0 && $this->peekSignificant() === '=') {
                $decl['members'][] = $this->member($token[1], 'const', $modifiers['visibility'] ?? 'public', $modifiers, null, [$token[2], $token[2]], []);
            }
            $this->collectSignificant($collected, $token);
        }

        $hash = sha1(implode("\x1f", $collected));
        for ($i = $first, $n = count($decl['members']); $i < $n; $i++) {
            $decl['members'][$i]['hash'] = $hash;
        }
    }

    /**
     * Parses a named function or method from just after the `function` keyword.
     * Returns null for closures. Records promoted constructor properties into
     * $decl when given.
     *
     * @param array{visibility: ?string, static: bool, abstract: bool}|null $modifiers
     * @param array<string, mixed>|null $decl
     * @return array<string, mixed>|null
     */
    private function parseFunctionLike(int $startLine, ?array $modifiers = null, ?array &$decl = null): ?array
    {
        $next = $this->peekSignificant();
        if ($next === '&') {
            $this->nextSignificant();
            $next = $this->peekSignificant();
        }
        // PHP allows reserved words as method names (`finally`, `list`, ...):
        // those arrive as their own token ids, so accept anything
        // identifier-shaped rather than just T_STRING.
        if (! is_array($next) || preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $next[1]) !== 1) {
            // Closure at statement level; its body is consumed by the caller.
            return null;
        }
        $this->nextSignificant();
        $name = $next[1];

        $signatureTokens = [];

        // Parameter list.
        while (($token = $this->advance()) !== null && $token !== '(') {
        }
        $signatureTokens[] = '(';
        $depth = 1;
        $paramModifier = null;
        $paramStart = count($signatureTokens);
        $pendingPromoted = null;
        while ($depth > 0 && ($token = $this->advance()) !== null) {
            if ($token === '(') {
                $depth++;
            } elseif ($token === ')') {
                $depth--;
            }
            $this->collectSignificant($signatureTokens, $token);
            if (! is_array($token)) {
                // A parameter ends at a top-level `,` or at the closing `)`;
                // its token slice is the promoted property's declaration hash.
                if (($token === ',' && $depth === 1) || $depth === 0) {
                    if ($pendingPromoted !== null && $decl !== null) {
                        $slice = array_slice($signatureTokens, $paramStart, count($signatureTokens) - $paramStart - 1);
                        $decl['members'][$pendingPromoted]['hash'] = sha1(implode("\x1f", $slice));
                        $pendingPromoted = null;
                    }
                    $paramStart = count($signatureTokens);
                }
                continue;
            }
            if ($depth !== 1) {
                continue;
            }
            if (in_array($token[0], [T_PUBLIC, T_PROTECTED, T_PRIVATE], true)) {
                $paramModifier = strtolower($token[1]);
            } elseif ($token[0] === T_READONLY) {
                $paramModifier ??= 'public';
            } elseif ($token[0] === T_VARIABLE) {
                if ($paramModifier !== null && $decl !== null) {
                    $pendingPromoted = count($decl['members']);
                    $decl['members'][] = $this->member(substr($token[1], 1), 'property', $paramModifier, $this->freshModifiers(), null, [$token[2], $token[2]], []);
                }
                $paramModifier = null;
            } elseif ($token[0] === T_ATTRIBUTE) {
                $this->skipAttribute();
                array_pop($signatureTokens);
            }
        }

        // Return type, then `;` (abstract/interface) or `{ body }`.
        $bodyTokens = [];
        $hasBody = false;
        while (($token = $this->advance()) !== null) {
            if ($token === ';') {
                break;
            }
            if ($token === '{') {
                $hasBody = true;
                $depth = 1;
                while ($depth > 0 && ($token = $this->advance()) !== null) {
                    if ($token === '{' || $this->opensCurly($token)) {
                        $depth++;
                    } elseif ($token === '}') {
                        $depth--;
                        if ($depth === 0) {
                            break;
                        }
                    }
                    $this->collectSignificant($bodyTokens, $token);
                }
                break;
            }
            $this->collectSignificant($signatureTokens, $token);
        }

        $endLine = $this->line;
        $hash = null;
        if ($hasBody) {
            $hash = sha1(implode("\x1f", array_merge($signatureTokens, ['{'], $bodyTokens)));
        }

        $mods = $modifiers ?? $this->freshModifiers();
        $member = $this->member($name, $modifiers === null ? 'function' : 'method', $mods['visibility'] ?? 'public', $mods, $hash, [$startLine, $endLine], []);
        $member['bodyNames'] = $this->nameTokens($bodyTokens);

        return $member;
    }

    /** @param list<string> $bucket */
    private function collectSignificant(array &$bucket, array|string $token): void
    {
        if (is_array($token)) {
            if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                return;
            }
            $bucket[] = $token[1];

            return;
        }
        $bucket[] = $token;
    }

    /**
     * Name-like body tokens for the vendor-deps scan, resolved later against
     * the file's imports.
     *
     * @param list<string> $tokens
     * @return list<string>
     */
    private function nameTokens(array $tokens): array
    {
        $names = [];
        foreach ($tokens as $text) {
            if ($text !== '' && (preg_match('/^\\\\?[A-Za-z_][A-Za-z0-9_]*(\\\\[A-Za-z_][A-Za-z0-9_]*)*$/', $text) === 1)) {
                $names[] = $text;
            }
        }

        return array_values(array_unique($names));
    }
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/** @var array<string, FileSurface> */
$parsedVendorFiles = [];

function parseFileCached(string $path, array &$cache): ?FileSurface
{
    $normalized = normalizePath($path);
    if (isset($cache[$normalized])) {
        return $cache[$normalized];
    }
    if (! is_file($normalized)) {
        return null;
    }
    $code = file_get_contents($normalized);
    if ($code === false) {
        return null;
    }

    return $cache[$normalized] = (new Parser($code))->parse();
}

function resolveName(string $name, FileSurface $surface): string
{
    if ($name === '') {
        return '';
    }
    if ($name[0] === '\\' || str_starts_with($name, '\\')) {
        return ltrim($name, '\\');
    }
    $parts = explode('\\', $name);
    if (isset($surface->imports[$parts[0]])) {
        $parts[0] = $surface->imports[$parts[0]];

        return implode('\\', $parts);
    }

    return $surface->namespace === '' ? $name : $surface->namespace . '\\' . $name;
}

function rootNamespace(string $fqcn): string
{
    $pos = strpos($fqcn, '\\');

    return $pos === false ? $fqcn : substr($fqcn, 0, $pos);
}

/** @param array<string, list<string>> $psr4 */
function psr4Resolve(string $fqcn, array $psr4): ?string
{
    $best = null;
    foreach ($psr4 as $prefix => $dirs) {
        if (str_starts_with($fqcn, $prefix) && ($best === null || strlen($prefix) > strlen($best))) {
            $best = $prefix;
        }
    }
    if ($best === null) {
        return null;
    }
    $relative = str_replace('\\', '/', substr($fqcn, strlen($best))) . '.php';
    foreach ($psr4[$best] as $dir) {
        $candidate = normalizePath($dir) . '/' . $relative;
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    return null;
}

/**
 * Vendor deps of a method: imported/fully-qualified names in its body that
 * resolve outside both Illuminate and the global (builtin) namespace.
 *
 * @param list<string> $bodyNames
 * @return list<string>
 */
function vendorDeps(array $bodyNames, FileSurface $surface): array
{
    $deps = [];
    foreach ($bodyNames as $name) {
        if (str_starts_with($name, '\\')) {
            $fqcn = ltrim($name, '\\');
            if (str_contains($fqcn, '\\') && rootNamespace($fqcn) !== 'Illuminate') {
                $deps[$fqcn] = true;
            }
            continue;
        }
        $parts = explode('\\', $name);
        if (! isset($surface->imports[$parts[0]])) {
            continue;
        }
        $parts[0] = $surface->imports[$parts[0]];
        $fqcn = implode('\\', $parts);
        if (str_contains($fqcn, '\\') && rootNamespace($fqcn) !== 'Illuminate') {
            $deps[$fqcn] = true;
        }
    }
    $deps = array_keys($deps);
    sort($deps);

    return $deps;
}

/**
 * Absorbs public/protected members of a vendor class (and its vendor parents
 * and traits, transitively) into $members, tagging their origin.
 *
 * @param array<string, array<string, mixed>> $members name => member
 * @param array<string, FileSurface> $cache
 * @param array<string, list<string>> $psr4
 * @param list<string> $notes
 */
function absorbVendor(string $fqcn, array &$members, array &$cache, array $psr4, string $vendorRoot, array &$notes, array &$seen): void
{
    if ($fqcn === '' || isset($seen[$fqcn])) {
        return;
    }
    $seen[$fqcn] = true;

    if (rootNamespace($fqcn) === 'Illuminate') {
        return; // has its own file pair on the framework side
    }

    $file = psr4Resolve($fqcn, $psr4);
    if ($file === null) {
        $notes[] = 'unresolved:' . $fqcn;

        return;
    }

    $surface = parseFileCached($file, $cache);
    if ($surface === null) {
        $notes[] = 'unresolved:' . $fqcn;

        return;
    }

    $shortName = ($pos = strrpos($fqcn, '\\')) === false ? $fqcn : substr($fqcn, $pos + 1);
    $relFile = substr(normalizePath($file), strlen($vendorRoot) + 1);

    foreach ($surface->declarations as $decl) {
        if ($decl['name'] !== $shortName) {
            continue;
        }
        foreach ($decl['members'] as $member) {
            if ($member['visibility'] === 'private') {
                continue;
            }
            $key = $member['kind'] . ':' . $member['name'];
            if (isset($members[$key])) {
                continue; // child override wins
            }
            $member['origin'] = 'vendor:' . $fqcn;
            $member['file'] = $relFile;
            $member['vendorDeps'] = isset($member['bodyNames']) ? vendorDeps($member['bodyNames'], $surface) : [];
            unset($member['bodyNames']);
            $members[$key] = $member;
        }
        foreach ($decl['uses'] as $trait) {
            absorbVendor(resolveName($trait, $surface), $members, $cache, $psr4, $vendorRoot, $notes, $seen);
        }
        foreach ($decl['extends'] as $parent) {
            absorbVendor(resolveName($parent, $surface), $members, $cache, $psr4, $vendorRoot, $notes, $seen);
        }
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

$files = [];
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($srcRoot, FilesystemIterator::SKIP_DOTS));
$paths = [];
foreach ($iterator as $info) {
    if ($info->isFile() && $info->getExtension() === 'php') {
        $paths[] = normalizePath($info->getPathname());
    }
}
sort($paths);

$vendorCache = [];

foreach ($paths as $path) {
    $relPath = substr($path, strlen($srcRoot) + 1);
    $code = file_get_contents($path);
    if ($code === false) {
        continue;
    }
    $surface = (new Parser($code))->parse();

    $declarations = [];
    foreach ($surface->declarations as $decl) {
        $notes = [];
        /** @var array<string, array<string, mixed>> $members */
        $members = [];
        foreach ($decl['members'] as $member) {
            $member['vendorDeps'] = isset($member['bodyNames']) ? vendorDeps($member['bodyNames'], $surface) : [];
            unset($member['bodyNames']);
            // PHP lets a property and a method share a name ($finally and
            // finally() coexist in Pipeline), so the key must carry the kind.
            $key = $member['kind'] . ':' . $member['name'];
            if (! isset($members[$key])) {
                $members[$key] = $member;
            }
        }

        $seen = [];
        foreach ($decl['extends'] as $parent) {
            absorbVendor(resolveName($parent, $surface), $members, $vendorCache, $psr4, $vendorRoot, $notes, $seen);
        }
        foreach ($decl['uses'] as $trait) {
            absorbVendor(resolveName($trait, $surface), $members, $vendorCache, $psr4, $vendorRoot, $notes, $seen);
        }

        $declarations[] = [
            'name' => $decl['name'],
            'kind' => $decl['kind'],
            'abstract' => $decl['abstract'],
            'extends' => array_map(static fn (string $name): string => resolveName($name, $surface), $decl['extends']),
            'implements' => array_map(static fn (string $name): string => resolveName($name, $surface), $decl['implements']),
            'uses' => array_map(static fn (string $name): string => resolveName($name, $surface), $decl['uses']),
            'notes' => $notes,
            'members' => array_values($members),
        ];
    }

    if ($surface->functions !== []) {
        $functionMembers = [];
        foreach ($surface->functions as $fn) {
            $fn['vendorDeps'] = isset($fn['bodyNames']) ? vendorDeps($fn['bodyNames'], $surface) : [];
            unset($fn['bodyNames']);
            $functionMembers[] = $fn;
        }
        $declarations[] = [
            'name' => '(functions)',
            'kind' => 'functions',
            'abstract' => false,
            'extends' => [],
            'implements' => [],
            'uses' => [],
            'notes' => [],
            'members' => $functionMembers,
        ];
    }

    $files[$relPath] = [
        'namespace' => $surface->namespace,
        'declarations' => $declarations,
    ];
}

$out = json_encode(['files' => $files], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($out === false) {
    fwrite(STDERR, "json_encode failed: " . json_last_error_msg() . "\n");
    exit(1);
}
file_put_contents($outPath, $out);
fwrite(STDOUT, count($files) . " PHP files extracted\n");
