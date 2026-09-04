<?php /** @noinspection ALL */
// Locates a PHP class/trait/interface via Composer's autoloader (so it
// resolves regardless of any mismatch between namespace and file layout -
// e.g. Illuminate\Support\Traits\Conditionable physically lives under
// .upstream's Illuminate/Conditionable/, not Illuminate/Support/) and lists
// its own (non-inherited) methods and properties with their exact source
// line spans, plus a full token dump of the file for the caller to slice.
//
// Or, for a helpers file (Illuminate/Support/helpers.php and the like -
// global functions, no class to autoload): lists every function that file
// defines, the same way. Composer's `files` autoload has already loaded
// every such file by the time the autoloader returns, so the functions are
// simply the user-defined ones whose ReflectionFunction points back at the
// requested file.
//
// Usage: php extract-php.php <upstream-root> <FQCN>
//        php extract-php.php <upstream-root> --functions=<path relative to upstream-root>
// Output: JSON { file, members: [{name, kind, static, visibility, startLine, endLine}], tokens: [...] }
//         (function members carry only name, kind, startLine, endLine)

[, $upstreamRoot, $target] = $argv;

require $upstreamRoot . '/vendor/autoload.php';

$members = [];

if (str_starts_with($target, '--functions=')) {
    $fileName = realpath($upstreamRoot . '/' . substr($target, strlen('--functions=')));

    if ($fileName === false) {
        fwrite(STDERR, "No such upstream file: {$target}\n");
        exit(1);
    }

    foreach (get_defined_functions()['user'] as $name) {
        $function = new ReflectionFunction($name);

        if (realpath($function->getFileName()) !== $fileName) {
            continue;
        }

        $members[] = [
            'name' => $function->getShortName(),
            'kind' => 'function',
            'startLine' => $function->getStartLine(),
            'endLine' => $function->getEndLine(),
        ];
    }

    usort($members, fn ($a, $b) => $a['startLine'] <=> $b['startLine']);
} else {
    $className = $target;

    if (!class_exists($className) && !interface_exists($className) && !trait_exists($className)) {
        fwrite(STDERR, "Could not autoload {$className}\n");
        exit(1);
    }

    $reflection = new ReflectionClass($className);
    $fileName = $reflection->getFileName();

    foreach ($reflection->getMethods() as $method) {
        if ($method->getDeclaringClass()->getName() !== $className) {
            continue;
        }

        $members[] = [
            'name' => $method->getName(),
            'kind' => 'method',
            'static' => $method->isStatic(),
            'visibility' => $method->isPublic() ? 'public' : ($method->isProtected() ? 'protected' : 'private'),
            'startLine' => $method->getStartLine(),
            'endLine' => $method->getEndLine(),
        ];
    }
}

$source = file_get_contents($fileName);
$tokens = token_get_all($source);

if (isset($reflection)) {
    // ReflectionProperty has no getStartLine()/getEndLine() - find each
    // property's declaration by scanning tokens for its T_VARIABLE, since
    // property declarations in this codebase are always single statements
    // (`[modifiers] $name[ = default];`) that don't span multiple lines.
    $propertyNames = [];
    foreach ($reflection->getProperties() as $property) {
        if ($property->getDeclaringClass()->getName() !== $className) {
            continue;
        }

        $propertyNames[$property->getName()] = [
            'name' => $property->getName(),
            'kind' => 'property',
            'static' => $property->isStatic(),
            'visibility' => $property->isPublic() ? 'public' : ($property->isProtected() ? 'protected' : 'private'),
            'startLine' => null,
            'endLine' => null,
        ];
    }

    $depth = 0;
    foreach ($tokens as $index => $token) {
        if (!is_array($token)) {
            continue;
        }

        if ($token[0] === T_VARIABLE) {
            $name = ltrim($token[1], '$');
            if (isset($propertyNames[$name]) && $propertyNames[$name]['startLine'] === null) {
                // Only a property *declaration* - the previous non-whitespace
                // token must be a visibility/static modifier, not `->` (a use)
                // or `(`/`,` (a parameter).
                for ($j = $index - 1; $j >= 0; $j--) {
                    $prev = $tokens[$j];
                    if (is_array($prev) && in_array($prev[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                        continue;
                    }
                    $isDeclaration = is_array($prev) && in_array($prev[0], [T_PUBLIC, T_PROTECTED, T_PRIVATE, T_STATIC, T_VAR], true);
                    if ($isDeclaration) {
                        $propertyNames[$name]['startLine'] = $token[2];
                        $propertyNames[$name]['endLine'] = $token[2];
                    }
                    break;
                }
            }
        }
    }

    foreach ($propertyNames as $property) {
        $members[] = $property;
    }
}

// A flat token dump (text + line) so the caller can slice by a member's
// [startLine, endLine] without re-tokenizing a bare fragment (token_get_all
// needs the full `<?php ...` source to make sense of context; a method
// body alone isn't valid PHP on its own). Line tracked by hand, from each
// token's own text, rather than trusting token_get_all's line field -
// that's only attached to array-form tokens, and a single-char token
// (`;`, `{`, ...) right after a *multi-line* whitespace gap would otherwise
// borrow the wrong line if the fallback just copied the previous token's.
$flatTokens = [];
$line = 1;
foreach ($tokens as $token) {
    $text = is_array($token) ? $token[1] : $token;
    $flatTokens[] = ['text' => $text, 'line' => $line];
    $line += substr_count($text, "\n");
}

echo json_encode([
    'file' => $fileName,
    'members' => $members,
    'tokens' => $flatTokens,
], JSON_UNESCAPED_SLASHES);
